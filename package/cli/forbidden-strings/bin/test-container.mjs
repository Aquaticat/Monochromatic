#!/usr/bin/env node
/** Verify the scanner and its embedded API in an unprivileged, mount-free Git 2.56.0 fixture. */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** An incomplete artifact or failed child command is not a test pass. */
class ScannerVerificationError extends Error {}

/** Execute native argv while retaining captured setup diagnostics on failure. */
function run({ command, args, capture = false }) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new ScannerVerificationError('Verification command could not start.', { cause: result.error });
  if (result.status !== 0) throw new ScannerVerificationError(`${command} ${args[0]} exited ${result.status}: ${result.stderr ?? ''}`);
  return result.stdout ?? '';
}

/** Build one immutable source snapshot and run real binary/library consumer tests with no host state. */
async function main() {
  const options = process.argv.slice(2);
  if (options.length > 1 || (options.length === 1 && options[0] !== '--clippy'))
    throw new ScannerVerificationError('Only --clippy is accepted.');
  const command = options[0] === '--clippy'
    ? ['cargo', 'clippy', '--offline', '--locked', '--all-targets', '--all-features', '--', '-D', 'warnings']
    : ['cargo', 'test', '--offline', '--locked', '--all-targets', '--', '--test-threads=1'];
  const context = await mkdtemp(join(tmpdir(), 'forbidden-strings-test-'));
  const evidenceRoot = resolve('target/verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'container-'));
  // Built from the inspected Git 2.56.0 release; no older Git is used for this rewrite's verification.
  const base = '6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a';
  const imageTag = 'localhost/forbidden-strings-native-test:development';
  try {
    const packages = [
      { source: process.cwd(), destination: 'package/cli/forbidden-strings', files: ['Cargo.toml', 'Cargo.lock', 'build.rs', 'src', 'tests', 'data'] },
      { source: resolve('../../rust-module/forbidden-regex'), destination: 'package/rust-module/forbidden-regex', files: ['Cargo.toml', 'Cargo.lock', 'src'] },
    ];
    for (const item of packages) {
      for (const file of item.files)
        await cp(join(item.source, file), join(context, item.destination, file), { recursive: true });
    }
    // An existing compiler conformance test includes the tracked repository appendix, not its private local extension.
    await cp(resolve('../../../forbidden-strings.append.txt'), join(context, 'forbidden-strings.append.txt'));
    await cp(resolve('../../../clippy.toml'), join(context, 'clippy.toml'));
    const vendor = join(context, 'vendor');
    const configuration = run({ command: 'cargo', args: ['vendor', '--offline', '--locked', '--versioned-dirs', vendor], capture: true });
    const mapped = configuration.replaceAll(JSON.stringify(vendor), '"/work/vendor"');
    if (!mapped.includes('directory = "/work/vendor"'))
      throw new ScannerVerificationError('Cargo vendor did not provide the expected offline source mapping.');
    await mkdir(join(context, 'cargo-config'), { recursive: true });
    await writeFile(join(context, 'cargo-config/config.toml'), mapped);
    await writeFile(join(context, 'Containerfile'), [
      `FROM ${base}`,
      'COPY package /work/package',
      'COPY vendor /work/vendor',
      'COPY cargo-config /work/.cargo',
      'COPY forbidden-strings.append.txt clippy.toml /work/',
      'RUN ["mkdir", "--parents", "/home/tester/.cargo"]',
      'RUN ["chown", "--recursive", "1000:1000", "/work", "/home/tester"]',
      'ENV HOME=/home/tester CARGO_HOME=/home/tester/.cargo CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0 RAYON_NUM_THREADS=2',
      'USER 1000:1000',
      'WORKDIR /work/package/cli/forbidden-strings',
      // Serial in-process tests preserve existing test fixtures that alter process-global panic hooks.
      `CMD ${JSON.stringify(command)}`,
      '',
    ].join('\n'));
    run({ command: 'podman', args: ['build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', imageTag, context] });
    const image = run({ command: 'podman', args: ['image', 'inspect', imageTag, '--format', '{{.Id}}'], capture: true }).trim();
    const limits = ['--rm', '--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128', '--ulimit', 'nofile=4096:4096'];
    const version = run({ command: 'podman', args: ['run', ...limits, image, '/usr/bin/git', '--version'], capture: true }).trim();
    if (version !== 'git version 2.56.0') throw new ScannerVerificationError(`Wrong Git in scanner fixture: ${version}`);
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({ base, image, version, limits, user: '1000:1000', command }, null, 2) + '\n');
    console.log(`Scanner verification evidence: ${evidence}`);
    run({ command: 'podman', args: ['run', ...limits, image] });
    await writeFile(join(evidence, 'passed.json'), JSON.stringify({ tests: true }) + '\n');
  } finally {
    await rm(context, { recursive: true, force: true });
  }
}

await main();
