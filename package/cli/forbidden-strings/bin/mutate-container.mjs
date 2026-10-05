#!/usr/bin/env node
/** Mutate the embedding owners inside a mount-free source snapshot; preserve every outcome and diff. */
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, snapshot, ScannerVerificationError } from './container-snapshot.mjs';

/** Scoped mutations retain the baseline, all policy branches and the complete scanner consumer suite. */
async function main() {
  if (process.argv.length !== 2) throw new ScannerVerificationError('This task accepts no arguments.');
  const command = [
    'cargo', 'mutants', '--in-place', '--baseline', 'run', '--no-config', '--no-shuffle', '--colors=never',
    '--build-timeout', '300', '--timeout', '120', '--output', '/work/mutation-report',
    '--cargo-arg=--offline', '--cargo-arg=--locked',
    '--cargo-test-arg=--', '--cargo-test-arg=--test-threads=1',
    // These two pre-existing baseline compiler conformance tests recompile the shipped corpus.
    // Their source is not mutated here; exported baseline loading and binary consumers still run.
    '--cargo-test-arg=--skip=rule::frx::compile_tests::builtin_ported_all_compile',
    '--cargo-test-arg=--skip=rule::frx::compile_tests::append_ported_compiles_end_to_end',
  ];
  for (const file of [
    'scanner.rs', 'load_request.rs', 'scan_finding.rs', 'frx_scan.rs', 'path_scan.rs', 'path_name_bytes.rs',
    'frx_load.rs', 'process_boundary.rs', 'runtime_cache/mod.rs', 'runtime_cache/warning.rs',
  ]) command.push('--file', `src/${file}`);
  const fixture = await snapshot({ command, name: 'mutation', tool: 'cargo-mutants' });
  let container;
  try {
    container = run({ command: 'podman', args: ['create', ...fixture.limits, fixture.image], capture: true }).stdout.trim();
    const result = run({ command: 'podman', args: ['start', '--attach', container], allowFailure: true });
    const report = run({ command: 'podman', args: ['cp', `${container}:/work/mutation-report/.`, fixture.evidence], capture: true, allowFailure: true });
    await writeFile(join(fixture.evidence, 'exit.json'), JSON.stringify({ status: result.status, signal: result.signal, reportCopied: report.status === 0, reportCopyError: report.stderr }, null, 2) + '\n');
    if (result.status !== 0 || report.status !== 0)
      throw new ScannerVerificationError(`Mutation exited ${result.status}; report-copy status ${report.status}; inspect ${fixture.evidence}.`);
  } finally {
    if (container) run({ command: 'podman', args: ['rm', '--force', container], capture: true });
    await rm(fixture.context, { recursive: true, force: true });
  }
}

await main();
