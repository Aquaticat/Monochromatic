#!/usr/bin/env node
/** Verify native wrapper modules against the selected real Git in an isolated source snapshot. */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Concurrent worktrees set GIT_POLICY_NATIVE_IMAGE_TAG so one snapshot never runs another's image. */
const testImage = `localhost/git-policy-native-test:${process.env.GIT_POLICY_NATIVE_IMAGE_TAG ?? 'development'}`;

/** Failed setup or execution cannot masquerade as native verification. */
class NativeVerificationError extends Error {}

/** Run complete argument arrays with no shell interpretation. */
function run({ command, args, capture = false }) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new NativeVerificationError('Native verification command could not start.', { cause: result.error });
  if (result.status !== 0) throw new NativeVerificationError(`${command} ${args[0]} exited ${result.status}: ${result.stderr ?? ''}`);
  return result.stdout ?? '';
}

/** Build one mount-free source image, then run tests and Clippy against that exact image identity. */
async function main() {
  const context = await mkdtemp(join(tmpdir(), 'cli-git-native-test-'));
  const evidenceRoot = resolve('target/verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'native-'));
  // The audited Git 2.56.0 image is the rewrite's selected native consumer baseline.
  const base = '6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a';
  try {
    const subject = join(context, 'package/git-policy/cli');
    for (const name of ['Cargo.toml', 'Cargo.lock', 'README.md'])
      await cp(resolve(name), join(subject, name));
    await cp(resolve('src/native'), join(subject, 'src/native'), { recursive: true });
    for (const name of ['Cargo.toml', 'Cargo.lock', 'src', 'fixtures'])
      await cp(resolve('../../rust-module/jsonc-edit', name), join(context, 'package/rust-module/jsonc-edit', name), { recursive: true });
    await cp(resolve('../../../clippy.toml'), join(context, 'clippy.toml'));
    await writeFile(join(context, 'Containerfile'), [
      `FROM ${base}`,
      'COPY package /work/package',
      'COPY clippy.toml /work/clippy.toml',
      'RUN ["mkdir", "--parents", "/home/tester/.cargo"]',
      'RUN ["chown", "--recursive", "1000:1000", "/work/package", "/home/tester"]',
      'ENV HOME=/home/tester CARGO_HOME=/home/tester/.cargo CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2 CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0',
      'USER 1000:1000',
      'WORKDIR /work/package/git-policy/cli',
      'CMD ["cargo", "test", "--offline", "--locked", "--all-targets", "--", "--test-threads=2"]',
      '',
    ].join('\n'));
    run({ command: 'podman', args: ['build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', testImage, context] });
    const image = run({ command: 'podman', args: ['image', 'inspect', testImage, '--format', '{{.Id}}'], capture: true }).trim();
    const limits = ['--rm', '--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128'];
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({ base, image, limits, user: '1000:1000' }, null, 2) + '\n');
    console.log(`Native wrapper verification evidence: ${evidence}`);
    run({ command: 'podman', args: ['run', ...limits, image] });
    const compiler = run({ command: 'rustc', args: ['--print', 'sysroot'], capture: true }).trim();
    run({ command: 'podman', args: [
      'run', ...limits, '--security-opt', 'label=disable', '--volume', `${compiler}:/toolchain:ro`,
      '--env', 'PATH=/toolchain/bin:/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      '--env', 'RUSTC=/toolchain/bin/rustc', '--env', 'RUSTDOC=/toolchain/bin/rustdoc',
      image, '/toolchain/bin/cargo', 'clippy', '--offline', '--locked', '--all-targets', '--', '-D', 'warnings',
    ] });
    await writeFile(join(evidence, 'passed.json'), JSON.stringify({ tests: true, clippy: true }) + '\n');
  } finally {
    await rm(context, { recursive: true, force: true });
  }
}

await main();
