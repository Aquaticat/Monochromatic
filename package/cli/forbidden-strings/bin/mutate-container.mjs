#!/usr/bin/env node
/** Mutate the embedding owners inside a mount-free source snapshot; preserve every outcome and diff. */
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, snapshot, ScannerVerificationError } from './container-snapshot.mjs';

/** Each optional scope narrows only the mutated files; every scope runs the same baseline and complete consumer suite. */
const SCOPES = {
  '--startup': { name: 'startup-mutation', files: ['main.rs'] },
  // Pathname normalization, native prefix counting and component masking, mutated without the other embedding owners.
  '--pathname': { name: 'pathname-mutation', files: ['path_scan.rs', 'path_name_bytes.rs'] },
};

/** Scoped mutations retain the baseline, all policy branches and the complete scanner consumer suite. */
async function main() {
  const options = process.argv.slice(2);
  if (options.length > 1 || (options.length === 1 && !Object.hasOwn(SCOPES, options[0])))
    throw new ScannerVerificationError(`Only one of ${Object.keys(SCOPES).join(', ')} is accepted.`);
  const scope = options.length === 1 ? SCOPES[options[0]] : undefined;
  const command = [
    'cargo', 'mutants', '--in-place', '--all-features', '--baseline', 'run', '--no-config', '--no-shuffle', '--colors=never',
    '--build-timeout', '300', '--timeout', '120', '--output', '/work/mutation-report',
    '--cargo-arg=--offline', '--cargo-arg=--locked',
    '--cargo-test-arg=--', '--cargo-test-arg=--test-threads=1',
    // These two pre-existing baseline compiler conformance tests recompile the shipped corpus.
    // Their source is not mutated here; exported baseline loading and binary consumers still run.
    '--cargo-test-arg=--skip=rule::frx::compile_tests::builtin_ported_all_compile',
    '--cargo-test-arg=--skip=rule::frx::compile_tests::append_ported_compiles_end_to_end',
  ];
  const files = scope ? scope.files : [
    'scanner.rs', 'load_request.rs', 'scan_finding.rs', 'frx_scan.rs', 'path_scan.rs', 'path_name_bytes.rs',
    'frx_load.rs', 'process_boundary.rs', 'main.rs', 'runtime_cache/mod.rs', 'runtime_cache/warning.rs',
  ];
  for (const file of files) command.push('--file', `src/${file}`);
  const fixture = await snapshot({ command, name: scope ? scope.name : 'mutation', tool: 'cargo-mutants' });
  let container;
  let reportPreserved = false;
  try {
    container = run({ command: 'podman', args: ['create', ...fixture.limits, fixture.image], capture: true }).stdout.trim();
    const result = run({ command: 'podman', args: ['start', '--attach', container], allowFailure: true, transcript: fixture.evidence });
    const report = run({ command: 'podman', args: ['cp', `${container}:/work/mutation-report/.`, fixture.evidence], capture: true, allowFailure: true });
    reportPreserved = report.status === 0;
    await writeFile(join(fixture.evidence, 'exit.json'), JSON.stringify({ status: result.status, signal: result.signal, reportCopied: report.status === 0, reportCopyError: report.stderr }, null, 2) + '\n');
    if (result.status !== 0 || report.status !== 0)
      throw new ScannerVerificationError(`Mutation exited ${result.status}; report-copy status ${report.status}; inspect ${fixture.evidence}.`);
  } finally {
    if (container && reportPreserved) run({ command: 'podman', args: ['rm', '--force', container], capture: true });
    else if (container) console.error(`Report retrieval failed; disposable container retained for recovery: ${container}`);
    await rm(fixture.context, { recursive: true, force: true });
  }
}

await main();
