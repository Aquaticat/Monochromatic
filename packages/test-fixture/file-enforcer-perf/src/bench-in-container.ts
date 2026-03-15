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

import { readFile, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, resolve, } from 'node:path';

import { invalidatePaths, } from '@monochromatic-dev/dev-script-file-enforcer/ts';
import spawn from 'nano-spawn';

/** Pattern to extract CPU affinity from /proc/self/status */
const CPU_AFFINITY_PATTERN = /Cpus_allowed_list:\s+(.+)/;

/** Pattern to extract events per second from sysbench output */
const SYSBENCH_EVENTS_PATTERN = /events per second:\s+([\d.]+)/;

//region Resource limit validation

/**
 * Reads the Cpus_allowed_list from /proc/self/status to verify that
 * taskset successfully pinned this process to the expected core.
 *
 * @returns CPU affinity string (e.g. "0" for single core, "0-15" for all)
 */
async function readCpuAffinity(): Promise<string> {
  const status = await readFile('/proc/self/status', 'utf8');
  const match = status.match(CPU_AFFINITY_PATTERN);
  return match !== null && match[1] !== undefined ? match[1].trim() : 'unknown';
}

/** Current process CPU affinity read from /proc/self/status */
const cpuAffinity = await readCpuAffinity();

/**
 * Cgroup memory limit, defaults to 'unknown' when cgroup reads fail outside a container.
 * let needed: cgroup reads may fail outside a container.
 */
let memoryMax = 'unknown';
try {
  memoryMax = (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim();
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
/** Expected memory limit in bytes (1 GiB) for the container */
const EXPECTED_MEMORY_BYTES = '1073741824';

/** Whether CPU affinity matches the expected single-core pinning */
const cpuAffinityValid = cpuAffinity === EXPECTED_CPU_AFFINITY;
/** Whether memory limit matches the expected 1 GiB container limit */
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
/** Sysbench stdout output for parsing events per second */
const sysbenchStdout = (await spawn('sysbench', ['cpu', '--threads=1', 'run'])).stdout;

/** Regex match result for sysbench events per second */
const sysbenchMatch = sysbenchStdout.match(SYSBENCH_EVENTS_PATTERN);
/** Parsed sysbench events per second, or -1 if parsing failed */
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

/** Absolute path to the benchmark configuration file */
const CONFIG_PATH = resolve(import.meta.dirname, 'perf.config.ts');

/** Timing entry for one config execution */
type TimingEntry = { readonly label: string; readonly ms: number };

/**
 * Mutable array: benchmark results accumulated sequentially because each
 * run must complete before the next starts (some modify files between runs).
 */
const timings: TimingEntry[] = [];

// Cold run -- all destination files written fresh
/** Timestamp before the cold run starts */
const coldStart = performance.now();
await import(`${CONFIG_PATH}?v=cold`);
/** Duration of the cold run in milliseconds */
const coldMs = performance.now() - coldStart;
timings.push({ label: 'cold', ms: coldMs });
console.error(`[container] cold run: ${coldMs.toFixed(1)}ms`);

// Warm runs -- content unchanged, all writes skipped.
// 10 iterations provide enough samples per container; with N containers
// running simultaneously, the aggregate dataset has N*10 warm data points.
/** Number of warm run iterations per container */
const WARM_RUN_COUNT = 10;
// Sequential execution required: each warm run must complete before the
// next to measure individual run timing accurately.
for (let warmIndex = 0; warmIndex < WARM_RUN_COUNT; warmIndex++) {
  const warmStart = performance.now();
  // oxlint-disable-next-line no-await-in-loop -- sequential benchmark timing required
  await import(`${CONFIG_PATH}?v=warm-${String(warmIndex)}`);
  const warmMs = performance.now() - warmStart;
  timings.push({ label: `warm-${String(warmIndex)}`, ms: warmMs });
  console.error(`[container] warm run ${String(warmIndex)}: ${warmMs.toFixed(1)}ms`);
}

// 1 source changed -- modify one source file, invalidate its cache entry, re-run.
// This mirrors what watch mode does: it knows exactly which file changed.
/** Absolute path to the fixture root directory */
const fixtureDir = join(tmpdir(), 'file-enforcer-perf');
/** Path to the source file modified for the source-changed benchmark */
const sourceFile = join(fixtureDir, 'src', 'pkg-00', 'docs', 'readme.md');
/** Original content of the source file before modification */
const sourceContent = await readFile(sourceFile, 'utf8');
await writeFile(sourceFile, `${sourceContent}\n# Modified for benchmark`);
invalidatePaths([sourceFile]);
/** Timestamp before the source-changed run starts */
const srcChangedStart = performance.now();
await import(`${CONFIG_PATH}?v=src-changed`);
/** Duration of the source-changed run in milliseconds */
const srcChangedMs = performance.now() - srcChangedStart;
timings.push({ label: 'source-changed', ms: srcChangedMs });
console.error(`[container] 1 source changed: ${srcChangedMs.toFixed(1)}ms`);

// 1 dest changed -- modify one dest file externally, invalidate its cache entry, re-run.
// Simulates watch mode detecting an external edit to a managed destination.
/** Path to the destination file modified for the dest-changed benchmark */
const destFile = join(fixtureDir, 'dest', 'combined-0.md');
/** Original content of the destination file before modification */
const destContent = await readFile(destFile, 'utf8');
await writeFile(destFile, `${destContent}\n# Externally modified`);
invalidatePaths([destFile]);
/** Timestamp before the dest-changed run starts */
const destChangedStart = performance.now();
await import(`${CONFIG_PATH}?v=dest-changed`);
/** Duration of the dest-changed run in milliseconds */
const destChangedMs = performance.now() - destChangedStart;
timings.push({ label: 'dest-changed', ms: destChangedMs });
console.error(`[container] 1 dest changed: ${destChangedMs.toFixed(1)}ms`);

//endregion Timed config runs

//region Output JSON results

/**
 * Rounds to one decimal place.
 *
 * @param value - Number to round
 *
 * @returns Rounded value
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Rounds a timing entry's ms value to one decimal place.
 *
 * @param entry - Timing entry with label and ms
 *
 * @returns New timing entry with rounded ms
 */
function roundTimingEntry(entry: TimingEntry): { label: string; ms: number } {
  return { label: entry.label, ms: round1(entry.ms) };
}

/** Structured benchmark results for JSON output */
const results = {
  limits: { cpuAffinity, memoryMax, cpuAffinityValid: cpuAffinityValid, memoryValid },
  sysbench: { eventsPerSec: round1(sysbenchEventsPerSec) },
  timings: timings.map(function roundEntry(entry) { return roundTimingEntry(entry); }),
};

// JSON to stdout for parsing by run-constrained.ts
console.log(JSON.stringify(results));

//endregion Output JSON results
