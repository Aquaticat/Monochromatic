#!/usr/bin/env node
/**
 * Run cargo-mutants against an already tested, disposable container snapshot.
 * Source mutation and compilation stay inside the container; only reports leave it.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** Concurrent worktrees set MONOCHROMATIC_LINT_IMAGE_TAG so one snapshot never runs another's image. */
const imageTag = process.env.MONOCHROMATIC_LINT_IMAGE_TAG ?? 'development';
/** Already tested source snapshot this campaign mutates. */
const testImage = `localhost/monochromatic-lint-test:${imageTag}`;
/** Campaign image layered over the tested snapshot. */
const mutationImage = `localhost/monochromatic-lint-mutation:${imageTag}`;

/** Verification failures keep the failing operation visible. */
class VerificationError extends Error {}

/** Execute one shell-free container-management command. */
function podman({ args, capture = false, allowFailure = false }) {
  const result = spawnSync('podman', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error)
    throw new VerificationError('Container command could not start.', { cause: result.error });
  if (!allowFailure && result.status !== 0)
    throw new VerificationError(`Container command failed: ${args[0]} (status ${result.status}, signal ${result.signal}). ${result.stderr ?? ''}`);
  return result;
}

/** Build and run the tool over an immutable input image, then retain its complete report. */
async function main() {
  const options = process.argv.slice(2);
  if (options.length > 1 || (options.length === 1 && !['--rust-style', '--markdown', '--processors', '--inferred-constants'].includes(options[0])))
    throw new VerificationError('Only --rust-style, --markdown, --processors or --inferred-constants is accepted.');
  const rustStyle = options[0] === '--rust-style';
  const markdown = options[0] === '--markdown';
  const processors = options[0] === '--processors';
  const inferredConstants = options[0] === '--inferred-constants';
  const context = await mkdtemp(join(tmpdir(), 'monochromatic-lint-mutation-'));
  const evidenceRoot = join(process.cwd(), 'target', 'verification');
  await mkdir(evidenceRoot, { recursive: true });
  const evidence = await mkdtemp(join(evidenceRoot, 'mutation-'));
  let container;
  try {
    const base = podman({
      args: ['image', 'inspect', testImage, '--format', '{{.Id}}'],
      capture: true,
    }).stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(base))
      throw new VerificationError('Test image did not resolve to a full content-addressed image ID.');
    const tool = join(process.env.CARGO_HOME ?? join(homedir(), '.cargo'), 'bin', 'cargo-mutants');
    const toolBytes = await readFile(tool);
    const toolSha256 = createHash('sha256').update(toolBytes).digest('hex');
    await copyFile(tool, join(context, 'cargo-mutants'));
    const command = [
      'cargo', 'mutants', '--in-place', '--baseline', 'run',
      // The combined semantic/Markdown consumer build took 83 seconds in the bounded container.
      '--build-timeout', '300', '--timeout', '180',
      '--no-config', '--no-shuffle', '--output', '/work/mutation-report',
      '--cargo-arg=--offline', '--cargo-arg=--locked',
    ];
    if (rustStyle)
      command.push('--file', 'src/rust_no_anonymous_functions.rs', '--cargo-test-arg=rust_no_anonymous_functions');
    // This is scoped evidence, not a replacement for full-rule mutation. The baseline still runs.
    if (markdown)
      command.push('--file', 'src/markdown_*.rs', '--cargo-test-arg=markdown');
    // Every processor module, not only the planted guard removals of the mutation:processors task.
    if (processors)
      command.push('--file', 'src/processors*.rs', '--cargo-test-arg=processors');
    // No test filter: the semantic conformance suite in other test modules also exercises this resolver.
    if (inferredConstants)
      command.push('--file', 'src/rust_inferred_constants.rs');
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
    container = podman({
      args: [
        'create', '--init', '--network=none', '--memory=2g', '--cpus=2',
        '--pids-limit=128', mutationImage,
      ],
      capture: true,
    }).stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(container))
      throw new VerificationError('Container creation did not return a complete container ID.');
    await writeFile(join(evidence, 'manifest.json'), JSON.stringify({
      baseImage: base,
      toolSha256,
      container,
      command,
      limits: { memory: '2g', cpus: 2, pids: 128, buildTimeoutSeconds: 300, testTimeoutSeconds: 180 },
    }, null, 2) + '\n');
    console.log(`Mutation evidence: ${evidence}`);
    const result = podman({ args: ['start', '--attach', container], allowFailure: true });
    // Preserve evidence even when missed mutants correctly make the campaign nonzero.
    const copy = podman({ args: ['cp', `${container}:/work/mutation-report/.`, evidence], capture: true, allowFailure: true });
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
