#!/usr/bin/env node
/** Build instrumented targets with a read-only compiler, then fuzz without host mounts. */
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, copyFile, cp, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

/** Same installed Rust runtime image as the linter's fuzz sidecar; the targets are pure and need no Git. */
const baseImage = '62ba2f7ce22ba9bc501110d3452c7ae814fba367c46f7eea3629a79286353884';
/** Concurrent worktrees set GIT_POLICY_NATIVE_IMAGE_TAG so one snapshot never runs another's image. */
const imageTag = process.env.GIT_POLICY_NATIVE_IMAGE_TAG ?? 'development';
const buildImage = `localhost/git-policy-cli-fuzz-build:${imageTag}`;
const runImage = `localhost/git-policy-cli-fuzz-run:${imageTag}`;
/** Registered targets and the dictionary each one uses. */
const targets = [
  { name: 'global_arguments', dictionary: 'arguments.dict' },
  { name: 'config_loading', dictionary: 'arguments.dict' },
  { name: 'config_schema', dictionary: 'config_schema.dict' },
  { name: 'wrapper_controls', dictionary: 'controls.dict' },
  { name: 'batch_reply', dictionary: 'batch_reply.dict' },
  { name: 'dependent_version', dictionary: 'dependent_version.dict' },
];
const secondsPerTarget = 30;
const maxInputBytes = 4096;

/** Preserve the failed verification boundary rather than masking it with a later copy error. */
class FuzzVerificationError extends Error {}

/** Run one shell-free command, capturing metadata only when requested. */
function execute({ command, args, cwd = process.cwd(), capture = false, allowFailure = false }) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error)
    throw new FuzzVerificationError(`${command} could not start.`, { cause: result.error });
  if (!allowFailure && result.status !== 0)
    throw new FuzzVerificationError(`${command} ${args[0]} exited ${result.status}: ${result.stderr ?? ''}`);
  return result;
}

/** Resolve the actual PATH-selected tool rather than an older unrelated Cargo-home installation. */
async function executable(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = resolve(directory, name);
    try {
      await access(candidate, constants.X_OK);
      if ((await stat(candidate)).isFile())
        return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR' && error.code !== 'EACCES')
        throw error;
    }
  }
  throw new FuzzVerificationError(`Executable ${name} was not found on PATH.`);
}

/** Copy only package inputs, never caches, dependencies, TypeScript sources or machine-local files. */
async function copyInputs({ source, context }) {
  const fuzz = join(context, 'package/git-policy/cli.fuzz');
  for (const name of ['Cargo.toml', 'Cargo.lock', 'src', 'fuzz_targets'])
    await cp(join(source, name), join(fuzz, name), { recursive: true });
  const subject = join(context, 'package/git-policy/cli');
  for (const name of ['Cargo.toml', 'Cargo.lock', 'README.md'])
    await cp(resolve(source, '../cli', name), join(subject, name));
  await cp(resolve(source, '../cli/src/native'), join(subject, 'src/native'), { recursive: true });
  const jsonc = join(context, 'package/rust-module/jsonc-edit');
  for (const name of ['Cargo.toml', 'Cargo.lock', 'src', 'fixtures'])
    await cp(resolve(source, '../../rust-module/jsonc-edit', name), join(jsonc, name), { recursive: true });
  // The subject links the scanner; `build.rs` and `data` hold the embedded baseline its library compiles in.
  const scanner = join(context, 'package/cli/forbidden-strings');
  for (const name of ['Cargo.toml', 'Cargo.lock', 'build.rs', 'src', 'data'])
    await cp(resolve(source, '../../cli/forbidden-strings', name), join(scanner, name), { recursive: true });
  const engine = join(context, 'package/rust-module/forbidden-regex');
  for (const name of ['Cargo.toml', 'Cargo.lock', 'src'])
    await cp(resolve(source, '../../rust-module/forbidden-regex', name), join(engine, name), { recursive: true });
}

/** Build and run within explicit container limits and retain discoveries before cleanup. */
async function main() {
  if (process.argv.slice(2).some(argument => argument !== '--build-only'))
    throw new FuzzVerificationError('Only --build-only is accepted.');
  const buildOnly = process.argv.includes('--build-only');
  const source = process.cwd();
  const compiler = execute({ command: 'rustc', args: ['--print', 'sysroot'], capture: true }).stdout.trim();
  const compilerVersion = execute({ command: 'rustc', args: ['--version'], capture: true }).stdout.trim();
  if (!compilerVersion.includes('nightly'))
    throw new FuzzVerificationError('Fuzz instrumentation requires the repository-managed nightly Rust toolchain.');
  const context = await mkdtemp(join(tmpdir(), 'git-policy-cli-fuzz-'));
  const outputRoot = join(source, 'target', 'verification');
  await mkdir(outputRoot, { recursive: true });
  const evidence = await mkdtemp(join(outputRoot, 'campaign-'));
  const containers = [];
  const limits = ['--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128'];
  try {
    await copyInputs({ source, context });
    const vendor = execute({ command: 'cargo', args: ['vendor', '--locked', '--offline', '--versioned-dirs', join(context, 'vendor')], capture: true });
    const config = vendor.stdout.replaceAll(JSON.stringify(join(context, 'vendor')), '"/work/vendor"');
    if (!config.includes('directory = "/work/vendor"'))
      throw new FuzzVerificationError('Cargo vendor did not emit the expected source directory mapping.');
    await mkdir(join(context, '.cargo'), { recursive: true });
    await writeFile(join(context, '.cargo/config.toml'), config);
    const cargoFuzz = await executable('cargo-fuzz');
    await copyFile(cargoFuzz, join(context, 'cargo-fuzz'));
    await writeFile(join(context, 'Containerfile'), [
      '# Installed Rust runtime image; the compiler is a separate read-only input.',
      `FROM ${baseImage}`,
      'COPY package /work/package',
      'COPY vendor /work/vendor',
      'COPY .cargo /work/.cargo',
      'COPY cargo-fuzz /usr/local/cargo/bin/cargo-fuzz',
      'RUN ["cargo-fuzz", "--version"]',
      'WORKDIR /work/package/git-policy/cli.fuzz',
      'ENV CARGO_BUILD_JOBS=2 CARGO_NET_OFFLINE=true CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0',
      'ENV PATH="/toolchain/bin:/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"',
      'ENV RUSTC="/toolchain/bin/rustc" RUSTDOC="/toolchain/bin/rustdoc"',
      '',
    ].join('\n'));
    execute({ command: 'podman', args: ['build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', buildImage, context] });
    // Compiler files retain their host labels. Do not relabel a shared Rust installation with :Z.
    // Only build containers disable label isolation; fuzz execution has no host mounts and keeps it enabled.
    const compilerMount = ['--security-opt', 'label=disable', '--volume', `${compiler}:/toolchain:ro`];
    // Generator controls prove the invariants are reached before any fuzzing result is trusted.
    execute({ command: 'podman', args: ['run', '--rm', ...limits, ...compilerMount, buildImage, 'cargo', 'test', '--lib', '--offline', '--locked', '--', '--test-threads=2'] });
    execute({ command: 'podman', args: ['run', '--rm', ...limits, ...compilerMount, buildImage, 'cargo', 'clippy', '--lib', '--offline', '--locked', '--', '-D', 'warnings'] });
    const buildContainer = execute({ command: 'podman', args: [
      'create', ...limits, ...compilerMount, buildImage,
      'cargo', 'fuzz', 'build', '--fuzz-dir', '.', '--sanitizer', 'address',
      '--target', 'x86_64-unknown-linux-gnu', '--target-dir', '/work/build',
    ], capture: true }).stdout.trim();
    containers.push(buildContainer);
    const built = execute({ command: 'podman', args: ['start', '--attach', buildContainer], allowFailure: true });
    const buildState = execute({ command: 'podman', args: ['inspect', '--format', '{{json .State}}', buildContainer], capture: true });
    await writeFile(join(evidence, 'build-state.json'), buildState.stdout);
    if (built.status !== 0)
      throw new FuzzVerificationError(`Instrumented build exited ${built.status}; container state retained in ${evidence}.`);
    await mkdir(join(context, 'bin'), { recursive: true });
    for (const target of targets)
      execute({ command: 'podman', args: ['cp', `${buildContainer}:/work/build/x86_64-unknown-linux-gnu/release/${target.name}`, join(context, 'bin', target.name)] });
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({ baseImage, compilerVersion, targets: targets.map(target => target.name), sanitizer: 'address', maxInputBytes, secondsPerTarget, memory: '2g', cpus: 2, pids: 128, compilerMount: 'read-only during compilation with container label isolation disabled; absent during fuzzing' }, null, 2) + '\n');
    if (buildOnly) {
      await cp(join(context, 'bin'), join(evidence, 'bin'), { recursive: true });
      console.log(`Instrumented binaries: ${evidence}`);
      return;
    }
    await cp(join(source, 'seed'), join(context, 'corpus'), { recursive: true });
    await cp(join(source, 'dictionary'), join(context, 'dictionary'), { recursive: true });
    await writeFile(join(context, 'Run.Containerfile'), [
      '# Fuzz execution has no compiler, registry, repository, home, or credential mounts.',
      `FROM ${baseImage}`,
      'COPY bin /fuzz/bin', 'COPY corpus /fuzz/corpus', 'COPY dictionary /fuzz/dictionary',
      `RUN ${JSON.stringify(['mkdir', '--parents', ...targets.map(target => `/fuzz/artifacts/${target.name}`)])}`,
      'WORKDIR /fuzz', '',
    ].join('\n'));
    execute({ command: 'podman', args: ['build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', runImage, '--file', join(context, 'Run.Containerfile'), context] });
    console.log(`Fuzz evidence: ${evidence}`);
    for (const target of targets) {
      const container = execute({ command: 'podman', args: [
        'create', ...limits, runImage,
        `/fuzz/bin/${target.name}`, `/fuzz/corpus/${target.name}`, `-max_total_time=${secondsPerTarget}`,
        `-max_len=${maxInputBytes}`, '-rss_limit_mb=1536', '-timeout=5', '-print_final_stats=1',
        `-artifact_prefix=/fuzz/artifacts/${target.name}/`, `-dict=/fuzz/dictionary/${target.dictionary}`,
      ], capture: true }).stdout.trim();
      containers.push(container);
      const result = execute({ command: 'podman', args: ['start', '--attach', container], capture: true, allowFailure: true });
      await mkdir(join(evidence, target.name), { recursive: true });
      await writeFile(join(evidence, target.name, 'stdout.log'), result.stdout);
      await writeFile(join(evidence, target.name, 'stderr.log'), result.stderr);
      execute({ command: 'podman', args: ['cp', `${container}:/fuzz/corpus/${target.name}`, join(evidence, target.name, 'corpus')] });
      execute({ command: 'podman', args: ['cp', `${container}:/fuzz/artifacts/${target.name}`, join(evidence, target.name, 'artifacts')] });
      const statistics = `${result.stdout}\n${result.stderr}`.match(/stat::number_of_executed_units:\s+(\d+)/u);
      const executedUnits = statistics ? Number(statistics[1]) : 0;
      await writeFile(join(evidence, target.name, 'exit.json'), JSON.stringify({ status: result.status, signal: result.signal, executedUnits }) + '\n');
      // Exit 0 alone is not evidence: a dictionary or corpus setup failure also ends quickly.
      if (result.status !== 0 || executedUnits < 1)
        throw new FuzzVerificationError(`${target.name} exited ${result.status} after ${executedUnits} verified executions; retained inputs and logs are in ${evidence}.`);
      console.log(`${target.name}: ${executedUnits} executions, exit 0; evidence ${join(evidence, target.name)}`);
    }
  } finally {
    for (const container of containers)
      execute({ command: 'podman', args: ['rm', '--force', container], capture: true });
    await rm(context, { recursive: true, force: true });
  }
}

await main();
