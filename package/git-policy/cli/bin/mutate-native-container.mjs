#!/usr/bin/env node
/**
 * Mutation-test the native wrapper inside disposable, bounded containers.
 *
 * Phase 1 plants known guard removals and requires the named control to fail,
 * proving the harness can observe a missing guard before any mutation result is trusted.
 * Phase 2 runs cargo-mutants over the already tested source snapshot.
 * Source mutation and compilation stay inside containers; only reports leave them.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Concurrent worktrees set GIT_POLICY_NATIVE_IMAGE_TAG so one snapshot never mutates another's image. */
const imageTag = process.env.GIT_POLICY_NATIVE_IMAGE_TAG ?? 'development';
/** Already tested source snapshot this campaign mutates; built by bin/test-native-container.mjs. */
const testImage = `localhost/git-policy-native-test:${imageTag}`;
/** Campaign image layered over the tested snapshot. */
const mutationImage = `localhost/git-policy-native-mutation:${imageTag}`;
/** Same bounds as the test gate: no network, 2 GiB, 2 CPUs, 128 PIDs. */
const limits = ['--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128'];
/** Source directory inside the tested image. */
const containerSource = '/work/package/git-policy/cli';
/** Report directory inside the container; the tester's home is the only writable place outside the package. */
const containerReport = '/home/tester/mutation-report';

/** Verification failures keep the failing operation visible. */
class VerificationError extends Error {}

/**
 * Guard removals with the control that must notice each one.
 * `from` must occur exactly once in the current source, so a control cannot silently stop applying.
 */
const plantedControls = [
  {
    name: 'self-exclusion by identity and content',
    file: 'src/native/real_git_candidate.rs',
    from: 'if same_file(candidate, own_executable) || identical_content(candidate, own_executable) {',
    to: 'if false {',
    failing: 'resolution::wrapper_never_selects_itself_or_a_copy_of_itself',
  },
  {
    name: 'forward-target marker check',
    file: 'src/native/entry.rs',
    from: '&& same_file(Path::new(&target), inputs.own_executable.as_path())',
    to: '&& false',
    failing: 'resolution::different_wrapper_build_stops_instead_of_looping',
  },
  {
    name: 'fail-closed policy stage',
    file: 'src/native/entry.rs',
    from: '|| classify_config_loading(arguments) == ConfigLoading::Skip',
    to: '|| true',
    failing: 'policy::repository_changing_commands_are_not_run',
  },
  {
    name: 'unknown top-level key rejection',
    file: 'src/native/config_parse.rs',
    from: 'return Err(unknown_top_level_key(key.as_str()));',
    to: 'continue;',
    failing: 'config_parse::tests::unknown_and_retired_top_level_keys_are_named',
  },
  {
    name: 'legacy configuration migration diagnostic',
    file: 'src/native/config_file.rs',
    from: 'return Err(migration_required(first.as_path(), source.as_path()));',
    to: 'let _ = first;',
    failing: 'config_file::tests::legacy_configuration_alone_requires_migration',
  },
];

/** Execute one shell-free container-management command. */
function podman({ args, capture = false, allowFailure = false }) {
  const result = spawnSync('podman', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error)
    throw new VerificationError('Container command could not start.', { cause: result.error });
  if (!allowFailure && result.status !== 0)
    throw new VerificationError(`Container command failed: ${args[0]} (status ${result.status}, signal ${result.signal}). ${result.stderr ?? ''}`);
  return result;
}

/** Accept only repeated `--file <glob>` scopes; anything else is a usage error. */
function parseScopes(options) {
  const scopes = [];
  for (let index = 0; index < options.length; index += 2) {
    if (options[index] !== '--file' || options[index + 1] === undefined)
      throw new VerificationError('Only repeated --file <glob> options are accepted.');
    if (!/^src\/native\/[A-Za-z0-9_*?.-]+\.rs$/u.test(options[index + 1]))
      throw new VerificationError(`--file must be a src/native/*.rs glob, got ${options[index + 1]}.`);
    scopes.push(options[index + 1]);
  }
  return scopes;
}

/** Plant each guard removal in its own container and require the named control to fail. */
async function runPlantedControls({ base, context, evidence }) {
  const results = [];
  for (const control of plantedControls) {
    const original = await readFile(resolve(control.file), 'utf8');
    const occurrences = original.split(control.from).length - 1;
    if (occurrences !== 1)
      throw new VerificationError(`Planted control "${control.name}" matches ${occurrences} times in ${control.file}; it must match exactly once.`);
    const planted = join(context, `planted-${results.length}.rs`);
    await writeFile(planted, original.replace(control.from, control.to));
    // Unit tests notice these removals first; `--no-fail-fast` keeps Cargo going so the named control also runs.
    const container = podman({
      args: ['create', ...limits, base, 'cargo', 'test', '--offline', '--locked', '--all-targets', '--no-fail-fast', '--', '--test-threads=2'],
      capture: true,
    }).stdout.trim();
    try {
      podman({ args: ['cp', planted, `${container}:${containerSource}/${control.file}`], capture: true });
      const run = podman({ args: ['start', '--attach', container], capture: true, allowFailure: true });
      const output = `${run.stdout}\n${run.stderr}`;
      const noticed = run.status !== 0 && output.includes(`test ${control.failing} ... FAILED`);
      results.push({ ...control, status: run.status, noticed });
      await writeFile(join(evidence, `planted-${results.length - 1}.log`), output);
      console.log(`Planted control "${control.name}": ${noticed ? 'noticed' : 'NOT noticed'} by ${control.failing}`);
    } finally {
      podman({ args: ['rm', '--force', container], capture: true });
    }
  }
  await writeFile(join(evidence, 'planted-controls.json'), JSON.stringify(results, null, 2) + '\n');
  const unnoticed = results.filter(result => !result.noticed);
  if (unnoticed.length > 0)
    throw new VerificationError(`Planted guard removals were not noticed: ${unnoticed.map(result => result.name).join('; ')}. Mutation results cannot be trusted; inspect ${evidence}.`);
}

/** Build and run the tool over an immutable input image, then retain its complete report. */
async function main() {
  const scopes = parseScopes(process.argv.slice(2));
  const context = await mkdtemp(join(tmpdir(), 'cli-git-native-mutation-'));
  const evidenceRoot = join(process.cwd(), 'target', 'verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'native-mutation-'));
  let container;
  try {
    const base = podman({
      args: ['image', 'inspect', testImage, '--format', '{{.Id}}'],
      capture: true,
    }).stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(base))
      throw new VerificationError('Test image did not resolve to a full content-addressed image ID; run native:test:container first.');
    console.log(`Mutation evidence: ${evidence}`);
    await runPlantedControls({ base, context, evidence });
    const tool = join(process.env.CARGO_HOME ?? join(homedir(), '.cargo'), 'bin', 'cargo-mutants');
    const toolBytes = await readFile(tool);
    const toolSha256 = createHash('sha256').update(toolBytes).digest('hex');
    await copyFile(tool, join(context, 'cargo-mutants'));
    const command = [
      'cargo', 'mutants', '--in-place', '--baseline', 'run',
      // Binary-level controls bound each wrapped command to 5 seconds, so a looping mutant fails well inside this limit.
      '--build-timeout', '300', '--timeout', '90',
      '--no-config', '--no-shuffle', '--output', containerReport,
      '--cargo-arg=--offline', '--cargo-arg=--locked',
    ];
    // Scoped runs are evidence for the named files only. The unmutated baseline still runs over everything.
    for (const scope of scopes)
      command.push('--file', scope);
    await writeFile(join(context, 'Containerfile'), [
      '# The tested image ID binds this campaign to an exact source snapshot.',
      `FROM ${base}`,
      'COPY cargo-mutants /usr/local/cargo/bin/cargo-mutants',
      'RUN ["cargo", "mutants", "--version"]',
      'ENV CARGO_NET_OFFLINE=true',
      `CMD ${JSON.stringify(command)}`,
      '',
    ].join('\n'));
    podman({
      args: [
        'build', '--network=none', '--http-proxy=false', '--pull=never',
        '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000',
        '--tag', mutationImage, context,
      ],
    });
    container = podman({ args: ['create', ...limits, mutationImage], capture: true }).stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(container))
      throw new VerificationError('Container creation did not return a complete container ID.');
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({
      baseImage: base,
      toolSha256,
      container,
      command,
      scopes,
      limits: { memory: '2g', cpus: 2, pids: 128, buildTimeoutSeconds: 300, testTimeoutSeconds: 90 },
    }, null, 2) + '\n');
    const result = podman({ args: ['start', '--attach', container], allowFailure: true });
    // Preserve evidence even when missed mutants correctly make the campaign nonzero.
    const copy = podman({ args: ['cp', `${container}:${containerReport}/.`, evidence], capture: true, allowFailure: true });
    await writeFile(join(evidence, 'exit.json'), JSON.stringify({
      status: result.status, signal: result.signal, reportCopied: copy.status === 0,
      reportCopyError: copy.status === 0 ? undefined : copy.stderr,
    }, null, 2) + '\n');
    if (result.status !== 0)
      throw new VerificationError(`Mutation campaign exited ${result.status}; report ${copy.status === 0 ? 'copied' : 'not generated or not copied'}; inspect ${evidence}.`);
    if (copy.status !== 0)
      throw new VerificationError(`Mutation campaign passed but its report was not copied: ${copy.stderr}`);
  } finally {
    if (container)
      podman({ args: ['rm', '--force', container], capture: true });
    await rm(context, { recursive: true, force: true });
  }
}

await main();
