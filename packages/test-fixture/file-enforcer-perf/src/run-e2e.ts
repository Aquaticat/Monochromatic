/**
 * Orchestrates end-to-end performance benchmarks using hyperfine.
 * Runs four scenarios: cold run, warm run (all unchanged),
 * 1 source changed, and 1 dest changed.
 *
 * Requires hyperfine to be installed (managed via mise).
 */

import { mkdir, rm, } from 'node:fs/promises';
import { resolve, } from 'node:path';

//region Setup

console.log('[e2e] setting up fixture...');
await import(resolve(import.meta.dirname, 'setup-fixture.ts'));

/** Absolute path to the perf config */
const CONFIG = resolve(import.meta.dirname, 'perf.config.ts');

/** Fixture root and subdirectories */
const FIXTURE_DIR = '/tmp/file-enforcer-perf';
const DEST_DIR = `${FIXTURE_DIR}/dest`;

/** Files modified by hyperfine --prepare for changed-file scenarios */
const SOURCE_FILE = `${FIXTURE_DIR}/src/pkg-00/docs/readme.md`;
const DEST_FILE = `${DEST_DIR}/combined-0.md`;

//endregion Setup

//region Hyperfine runner

/**
 * Runs a hyperfine benchmark with the given arguments.
 * @param label - Human-readable scenario name for logging
 * @param args - Arguments passed to hyperfine
 * @throws When hyperfine exits with a non-zero code
 */
async function runHyperfine(label: string, args: readonly string[]): Promise<void> {
  console.log(`\n--- ${label} ---`);
  const proc = Bun.spawn(['hyperfine', ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`hyperfine "${label}" exited with code ${String(exitCode)}`);
  }
}

//endregion Hyperfine runner

//region Benchmark scenarios

// 1. Cold run: dest dir empty, everything written fresh
await runHyperfine('Cold run (all files written)', [
  '--runs', '5',
  '--prepare', `rm -rf ${DEST_DIR} && mkdir -p ${DEST_DIR}`,
  `bun ${CONFIG}`,
]);

// 2. Warm run: populate dest first, then re-run (all content-based skips)
console.log('\n[e2e] populating dest for warm runs...');
await rm(DEST_DIR, { recursive: true, force: true });
await mkdir(DEST_DIR, { recursive: true });
const warmSetup = Bun.spawn(['bun', CONFIG], { stdout: 'pipe', stderr: 'pipe' });
await warmSetup.exited;

await runHyperfine('Warm run (all unchanged)', [
  '--warmup', '2',
  '--runs', '10',
  `bun ${CONFIG}`,
]);

// 3. One source file modified between runs (forces re-read + re-write of affected dests)
await runHyperfine('1 source changed', [
  '--warmup', '2',
  '--runs', '10',
  '--prepare', `echo "# Modified at $(date +%s%N)" >> ${SOURCE_FILE}`,
  `bun ${CONFIG}`,
]);

// 4. One dest file modified between runs (simulates external edit, triggers re-write)
await runHyperfine('1 dest changed', [
  '--warmup', '2',
  '--runs', '10',
  '--prepare', `echo "# Externally modified at $(date +%s%N)" >> ${DEST_FILE}`,
  `bun ${CONFIG}`,
]);

//endregion Benchmark scenarios

console.log('\n[e2e] all benchmarks complete.');
