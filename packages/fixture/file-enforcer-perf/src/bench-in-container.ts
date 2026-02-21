/**
 * Runs inside the podman container. Validates that resource limits
 * are enforced, creates the benchmark fixture, and times multiple
 * perf.config.ts executions under constrained resources.
 *
 * Outputs a JSON summary to stdout for parsing by run-constrained.ts.
 * All diagnostic messages go to stderr.
 */

import { resolve, } from 'node:path';
import { invalidatePaths, } from '@monochromatic-dev/dev-script-file-enforcer/ts';

//region Resource limit validation

// let needed: cgroup reads may fail outside a container
let cpuMax = 'unknown';
try {
  cpuMax = (await Bun.file('/sys/fs/cgroup/cpu.max').text()).trim();
} catch {
  // Not in a cgroup v2 environment
}

// let needed: same fallback reason as cpuMax
let memoryMax = 'unknown';
try {
  memoryMax = (await Bun.file('/sys/fs/cgroup/memory.max').text()).trim();
} catch {
  // Not in a cgroup v2 environment
}

console.error(`[container] CPU limit (cpu.max): ${cpuMax}`);
console.error(`[container] Memory limit (memory.max): ${memoryMax}`);

/**
 * Expected pattern for --cpus=0.3:
 * cpu.max format is "quota period" where quota/period = cpu fraction.
 * --cpus=0.3 means quota=30000, period=100000.
 */
const CPU_LIMIT_PATTERN = /^30000\s+100000$/;
const EXPECTED_MEMORY_BYTES = '1073741824';

const cpuValid = CPU_LIMIT_PATTERN.test(cpuMax);
const memoryValid = memoryMax === EXPECTED_MEMORY_BYTES;

if (!cpuValid) {
  console.error(`[container] WARNING: CPU limit unexpected. Got "${cpuMax}", expected "30000 100000"`);
}
if (!memoryValid) {
  console.error(`[container] WARNING: Memory limit unexpected. Got "${memoryMax}", expected "${EXPECTED_MEMORY_BYTES}"`);
}

//endregion Resource limit validation

//region Sysbench CPU baseline comparison

console.error('[container] running sysbench cpu...');
const sysbenchProc = Bun.spawn(['sysbench', 'cpu', '--threads=1', 'run'], {
  stdout: 'pipe',
  stderr: 'pipe',
});
const sysbenchStdout = await new Response(sysbenchProc.stdout).text();
await sysbenchProc.exited;

const sysbenchMatch = /events per second:\s+([\d.]+)/.exec(sysbenchStdout);
const sysbenchEventsPerSec = sysbenchMatch !== null ? Number.parseFloat(sysbenchMatch[1]!) : -1;
console.error(`[container] sysbench: ${sysbenchEventsPerSec.toFixed(1)} events/sec`);

//endregion Sysbench CPU baseline comparison

//region Fixture setup

console.error('[container] creating fixture...');
await import(resolve(import.meta.dirname, 'setup-fixture.ts'));

//endregion Fixture setup

//region Timed config runs

const CONFIG_PATH = resolve(import.meta.dirname, 'perf.config.ts');

/** Timing entry for one config execution */
type TimingEntry = { readonly label: string; readonly ms: number };

// Mutable array: benchmark results accumulated sequentially because each
// run must complete before the next starts (some modify files between runs).
const timings: TimingEntry[] = [];

// Cold run -- all destination files written fresh
const coldStart = performance.now();
await import(`${CONFIG_PATH}?v=cold`);
const coldMs = performance.now() - coldStart;
timings.push({ label: 'cold', ms: coldMs });
console.error(`[container] cold run: ${coldMs.toFixed(1)}ms`);

// Warm runs -- content unchanged, all writes skipped
const WARM_RUN_COUNT = 3;
// Sequential execution required: each warm run must complete before the
// next to measure individual run timing accurately.
for (let warmIndex = 0; warmIndex < WARM_RUN_COUNT; warmIndex++) {
  const warmStart = performance.now();
  // eslint-disable-next-line no-await-in-loop -- sequential benchmark timing required
  await import(`${CONFIG_PATH}?v=warm-${String(warmIndex)}`);
  const warmMs = performance.now() - warmStart;
  timings.push({ label: `warm-${String(warmIndex)}`, ms: warmMs });
  console.error(`[container] warm run ${String(warmIndex)}: ${warmMs.toFixed(1)}ms`);
}

// 1 source changed -- modify one source file, invalidate its cache entry, re-run.
// This mirrors what watch mode does: it knows exactly which file changed.
const sourceFile = '/tmp/file-enforcer-perf/src/pkg-00/docs/readme.md';
const sourceContent = await Bun.file(sourceFile).text();
await Bun.write(sourceFile, `${sourceContent}\n# Modified for benchmark`);
invalidatePaths([sourceFile]);
const srcChangedStart = performance.now();
await import(`${CONFIG_PATH}?v=src-changed`);
const srcChangedMs = performance.now() - srcChangedStart;
timings.push({ label: 'source-changed', ms: srcChangedMs });
console.error(`[container] 1 source changed: ${srcChangedMs.toFixed(1)}ms`);

// 1 dest changed -- modify one dest file externally, invalidate its cache entry, re-run.
// Simulates watch mode detecting an external edit to a managed destination.
const destFile = '/tmp/file-enforcer-perf/dest/combined-0.md';
const destContent = await Bun.file(destFile).text();
await Bun.write(destFile, `${destContent}\n# Externally modified`);
invalidatePaths([destFile]);
const destChangedStart = performance.now();
await import(`${CONFIG_PATH}?v=dest-changed`);
const destChangedMs = performance.now() - destChangedStart;
timings.push({ label: 'dest-changed', ms: destChangedMs });
console.error(`[container] 1 dest changed: ${destChangedMs.toFixed(1)}ms`);

//endregion Timed config runs

//region Output JSON results

/** Rounds to one decimal place */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const results = {
  limits: { cpuMax, memoryMax, cpuValid, memoryValid },
  sysbench: { eventsPerSec: round1(sysbenchEventsPerSec) },
  timings: timings.map(({ label, ms }) => ({ label, ms: round1(ms) })),
};

// JSON to stdout for parsing by run-constrained.ts
console.log(JSON.stringify(results));

//endregion Output JSON results
