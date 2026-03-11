/**
 * Runs inside the podman container under CPU contention from sibling
 * containers pinned to the same core via taskset. Validates that CPU
 * affinity and memory limits are enforced, creates the benchmark fixture,
 * and times multiple perf.config.ts executions under natural scheduling
 * contention.
 *
 * Outputs a JSON summary to stdout for parsing by run-constrained.ts.
 * All diagnostic messages go to stderr.
 */

import { readFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, resolve, } from 'node:path';

import { invalidatePaths, } from '@monochromatic-dev/dev-script-file-enforcer/ts';
import spawn from 'nano-spawn';

//region Resource limit validation

/**
 * Reads the Cpus_allowed_list from /proc/self/status to verify that
 * taskset successfully pinned this process to the expected core.
 * @returns CPU affinity string (e.g. "0" for single core, "0-15" for all)
 */
async function readCpuAffinity(): Promise<string> {
  const status = await readFile('/proc/self/status', 'utf8');
  const match = /Cpus_allowed_list:\s+(.+)/.exec(status);
  return match !== null && match[1] !== undefined ? match[1].trim() : 'unknown';
}

const cpuAffinity = await readCpuAffinity();

// let needed: cgroup reads may fail outside a container
let memoryMax = 'unknown';
try {
  memoryMax = (await Bun.file('/sys/fs/cgroup/memory.max').text()).trim();
} catch {
  // Not in a cgroup v2 environment
}

console.error(`[container] CPU affinity (Cpus_allowed_list): ${cpuAffinity}`);
console.error(`[container] Memory limit (memory.max): ${memoryMax}`);

/**
 * Expected CPU affinity: pinned to a single core (e.g., "0") by taskset.
 * All containers share this core via EEVDF scheduling rather than
 * CFS bandwidth throttling, avoiding artificial sawtooth latency.
 */
const EXPECTED_CPU_AFFINITY = '0';
const EXPECTED_MEMORY_BYTES = '1073741824';

const cpuAffinityValid = cpuAffinity === EXPECTED_CPU_AFFINITY;
const memoryValid = memoryMax === EXPECTED_MEMORY_BYTES;

if (!cpuAffinityValid) {
  console.error(`[container] WARNING: CPU affinity unexpected. Got "${cpuAffinity}", expected "${EXPECTED_CPU_AFFINITY}"`);
}
if (!memoryValid) {
  console.error(`[container] WARNING: Memory limit unexpected. Got "${memoryMax}", expected "${EXPECTED_MEMORY_BYTES}"`);
}

//endregion Resource limit validation

//region Sysbench CPU baseline comparison

console.error('[container] running sysbench cpu...');
const { stdout: sysbenchStdout } = await spawn('sysbench', ['cpu', '--threads=1', 'run']);

const sysbenchMatch = /events per second:\s+([\d.]+)/.exec(sysbenchStdout);
const sysbenchEventsPerSec = sysbenchMatch !== null && sysbenchMatch[1] !== undefined
  ? Number.parseFloat(sysbenchMatch[1])
  : -1;
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

// Warm runs -- content unchanged, all writes skipped.
// 10 iterations provide enough samples per container; with N containers
// running simultaneously, the aggregate dataset has N*10 warm data points.
const WARM_RUN_COUNT = 10;
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
const fixtureDir = join(tmpdir(), 'file-enforcer-perf');
const sourceFile = join(fixtureDir, 'src', 'pkg-00', 'docs', 'readme.md');
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
const destFile = join(fixtureDir, 'dest', 'combined-0.md');
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
  limits: { cpuAffinity, memoryMax, cpuAffinityValid: cpuAffinityValid, memoryValid },
  sysbench: { eventsPerSec: round1(sysbenchEventsPerSec) },
  timings: timings.map(({ label, ms }) => ({ label, ms: round1(ms) })),
};

// JSON to stdout for parsing by run-constrained.ts
console.log(JSON.stringify(results));

//endregion Output JSON results
