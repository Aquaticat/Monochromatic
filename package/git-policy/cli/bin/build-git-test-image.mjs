#!/usr/bin/env node
/** Build the selected latest-stable Git into the already used Rust verification image. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** A verification prerequisite must fail rather than silently run an older Git. */
class GitImageError extends Error {}

/** Execute complete native argv without creating a shell command string. */
function run({ command, args, cwd = process.cwd(), capture = false }) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new GitImageError('Verification command could not start.', { cause: result.error });
  if (result.status !== 0) throw new GitImageError(`${command} ${args[0]} exited ${result.status}: ${result.stderr ?? ''}`);
  return result.stdout ?? '';
}

/** Copy an audited release tree into a mount-free build, retaining exact source and image identities. */
async function main() {
  const [sourceArgument, ...extra] = process.argv.slice(2);
  if (!sourceArgument || extra.length)
    throw new GitImageError('Provide the audited git/git v2.56.0 source checkout path.');
  const source = resolve(sourceArgument);
  // This is the latest stable release selected for the rewrite on 2026-10-04, not an older-version matrix.
  const revision = 'a018953688f1b10bddf91bff8747068f5f4746a4';
  const actual = run({ command: 'git', args: ['rev-parse', 'HEAD'], cwd: source, capture: true }).trim();
  if (actual !== revision) throw new GitImageError('The checkout is not the inspected Git 2.56.0 revision.');
  const context = await mkdtemp(join(tmpdir(), 'cli-git-native-image-'));
  const evidenceRoot = resolve('target/verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'git-image-'));
  const base = '84f24e75017a7d8afa1c69e51c52f37e7d8d644cd2597a01f4732ad0b386dc20';
  const outputTag = 'localhost/cli-git-test-rust:git-2.56.0';
  let container;
  try {
    const archive = join(context, 'git-source.tar');
    run({ command: 'git', args: ['archive', '--format=tar', `--output=${archive}`, revision], cwd: source });
    const sourceSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
    await writeFile(join(context, 'Containerfile'), [
      '# The compiler image was previously verified; Git source is an exact upstream release archive.',
      `FROM ${base}`,
      'ADD git-source.tar /work/git-source/',
      'WORKDIR /work/git-source',
      'ENV CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2',
      '',
    ].join('\n'));
    run({ command: 'podman', args: [
      'build', '--network=none', '--http-proxy=false', '--pull=never',
      '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000',
      '--tag', 'localhost/cli-git-native-source:git-2.56.0', context,
    ] });
    // CLI tests use English diagnostics and no Tk UI. Perl/Python, curl, fsmonitor and Git's default Rust support remain enabled.
    const make = ['make', '--jobs=2', 'prefix=/usr', 'NO_GETTEXT=YesPlease', 'NO_TCLTK=YesPlease', 'PYTHON_PATH=/usr/bin/python3', 'CARGO_ARGS=--offline --release', 'install'];
    const limits = ['--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128', '--ulimit', 'nofile=4096:4096'];
    container = run({ command: 'podman', args: ['create', ...limits, 'localhost/cli-git-native-source:git-2.56.0', ...make], capture: true }).trim();
    if (!/^[a-f0-9]{64}$/u.test(container)) throw new GitImageError('Container identity was not returned.');
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({ revision, sourceSha256, base, make, limits, container, outputTag }, null, 2) + '\n');
    run({ command: 'podman', args: ['start', '--attach', container] });
    run({ command: 'podman', args: ['commit', '--change', 'WORKDIR /work', container, outputTag] });
    const image = run({ command: 'podman', args: ['image', 'inspect', outputTag, '--format', '{{.Id}}'], capture: true }).trim();
    const version = run({ command: 'podman', args: ['run', '--rm', ...limits, image, '/usr/bin/git', '--version'], capture: true }).trim();
    if (version !== 'git version 2.56.0') throw new GitImageError(`Built image returned an unexpected Git version: ${version}`);
    await writeFile(join(evidence, 'result.json'), JSON.stringify({ image, version }, null, 2) + '\n');
    console.log(`Latest-stable Git test image: ${image}; evidence ${evidence}`);
  } finally {
    if (container) run({ command: 'podman', args: ['rm', '--force', container], capture: true });
    await rm(context, { recursive: true, force: true });
  }
}

await main();
