#!/usr/bin/env node
/** Run the embedding fuzzer with baked source, seeds and toolchain, retaining corpus and crash evidence. */
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, snapshot, ScannerVerificationError } from '../../forbidden-strings/bin/container-snapshot.mjs';

/** Bound both the fuzz campaign and every input while leaving reproducer evidence intact. */
async function main() {
  if (process.argv.length !== 2) throw new ScannerVerificationError('This task accepts no arguments.');
  const command = [
    'cargo', 'fuzz', 'run', '--fuzz-dir', '.', 'fuzz_embedding', '--sanitizer', 'address',
    '--target', 'x86_64-unknown-linux-gnu', '--codegen-units', '16', 'seed/fuzz_embedding', '--',
    '-max_total_time=120', '-max_len=20000', '-timeout=10', '-rss_limit_mb=1536', '-seed=94',
    '-dict=dictionary/forbidden-strings.dict',
  ];
  const fixture = await snapshot({ command, name: 'embedding-fuzz', toolchain: true, tool: 'cargo-fuzz', fuzzing: true });
  let container;
  let evidencePreserved = false;
  try {
    container = run({ command: 'podman', args: ['create', ...fixture.limits, fixture.image], capture: true }).stdout.trim();
    const result = run({ command: 'podman', args: ['start', '--attach', container], allowFailure: true, transcript: fixture.evidence });
    const copied = {};
    for (const directory of ['seed/fuzz_embedding', 'artifacts']) {
      const copy = run({ command: 'podman', args: ['cp', `${container}:/work/package/cli/forbidden-strings.fuzz/${directory}`, join(fixture.evidence, directory === 'artifacts' ? 'artifacts' : 'corpus')], capture: true, allowFailure: true });
      copied[directory] = { status: copy.status, stderr: copy.stderr };
    }
    evidencePreserved = copied['seed/fuzz_embedding'].status === 0 && copied.artifacts.status === 0;
    await writeFile(join(fixture.evidence, 'exit.json'), JSON.stringify({ status: result.status, signal: result.signal, copied }, null, 2) + '\n');
    if (result.status !== 0 || !evidencePreserved)
      throw new ScannerVerificationError(`Embedding fuzzing exited ${result.status}; inspect ${fixture.evidence}.`);
  } finally {
    if (container && evidencePreserved) run({ command: 'podman', args: ['rm', '--force', container], capture: true });
    else if (container) console.error(`Fuzz evidence retrieval failed; disposable container retained for recovery: ${container}`);
    await rm(fixture.context, { recursive: true, force: true });
  }
}

await main();
