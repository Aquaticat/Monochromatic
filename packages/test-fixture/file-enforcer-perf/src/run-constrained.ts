/**
 * Builds a podman container and runs file-enforcer benchmarks under
 * VPS-like resource contention. Launches multiple containers, each
 * pinned to the same CPU core via taskset inside the container,
 * creating natural scheduling contention that simulates a shared VPS
 * without CFS bandwidth throttling artifacts.
 *
 * Uses taskset (process-level CPU affinity) instead of cgroup cpuset
 * because rootless podman on systemd-managed cgroups v2 does not
 * delegate the cpuset controller to user slices. taskset inside the
 * container achieves the same pinning effect without requiring sudo
 * or systemd configuration changes.
 *
 * Validates constraints by:
 * 1. Running sysbench on host (baseline)
 * 2. Launching N containers on the same CPU core simultaneously
 * 3. Ensuring PEAK container sysbench stays below the real VPS baseline
 *    of 1605 events/sec
 * 4. Running file-enforcer benchmarks under natural CPU contention
 */

import { resolve, } from 'node:path';

/** Absolute path to the monorepo root */
const MONOREPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

/** Containerfile location */
const CONTAINERFILE = resolve(import.meta.dirname, '..', 'Containerfile');

/** Container image name */
const IMAGE_NAME = 'file-enforcer-perf';

/**
 * The user's cheapest VPS scored 1605 events/sec in sysbench cpu.
 * Even the PEAK score across all contending containers must stay below this.
 */
const VPS_SYSBENCH_BASELINE = 1_605;

/**
 * Number of containers to run simultaneously on the same CPU core.
 * With 5+ containers sharing 1 core of a Ryzen 7 8700F (~5300 events/sec),
 * each gets ~20% throughput (~1060 events/sec), well below the 1605 baseline.
 * Extra containers ensure peak performance during brief idle windows
 * (when some containers are between benchmark phases) stays below baseline.
 */
const CONTAINER_COUNT = 5;

/**
 * CPU core to pin all containers to via taskset inside the container.
 * All containers compete for this single core via EEVDF scheduler,
 * creating contention at sub-millisecond timeslice granularity
 * rather than CFS bandwidth throttling's 10-100ms stall periods.
 */
const CPUSET_CPU = '0';

/**
 * Block device that backs the volume mount.
 * Determined by tracing /var/home -> LUKS dm-0 -> nvme0n1p6 -> nvme0n1.
 * IO throttle cgroup rules apply at the device mapper level.
 */
const BLOCK_DEVICE = '/dev/dm-0';

/**
 * HDD-like IO limits.
 * Cheap shared HDD: ~75-150 random IOPS, ~80-120 MB/s sequential.
 * Using conservative end: 100 IOPS, 80 MB/s.
 */
const READ_BPS = '80mb';
const WRITE_BPS = '80mb';
const READ_IOPS = '100';
const WRITE_IOPS = '100';

/**
 * Podman flags for memory and IO constraints.
 * CPU pinning is done via taskset inside the container rather than
 * --cpuset-cpus, avoiding the need for sudo or cpuset delegation.
 */
const RESOURCE_FLAGS = [
  '--memory=1g',
  `--device-read-bps=${BLOCK_DEVICE}:${READ_BPS}`,
  `--device-write-bps=${BLOCK_DEVICE}:${WRITE_BPS}`,
  `--device-read-iops=${BLOCK_DEVICE}:${READ_IOPS}`,
  `--device-write-iops=${BLOCK_DEVICE}:${WRITE_IOPS}`,
] as const;

/**
 * Spawns a process, captures stdout. Stderr is captured and only
 * displayed on failure to avoid interleaved output from parallel containers.
 * @param cmd - Command and arguments
 * @param label - Label for error messages and logging
 * @returns Stdout content
 * @throws When the process exits with a non-zero code
 */
async function runCapture(cmd: readonly string[], label: string): Promise<string> {
  console.log(`[constrained] ${label}...`);
  const proc = Bun.spawn([...cmd], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`[constrained] stderr from ${label}:\n${stderr}`);
    throw new Error(`${label} failed with exit code ${String(exitCode)}`);
  }
  return stdout;
}

/**
 * Parses JSON from the last non-empty line of a string.
 * Library console.log calls may precede the structured JSON on stdout.
 * @param output - Full stdout content potentially containing non-JSON prefix lines
 * @returns Parsed JSON value
 * @throws When no valid JSON line is found
 */
function parseLastJsonLine(output: string): unknown {
  const lines = output.trim().split('\n').filter((line) => line.trim().length > 0);
  // Walk backwards to find the JSON line -- it starts with '{'
  // let needed: iterating from the end until valid JSON found
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex] as string;
    if (line.trim().startsWith('{')) {
      return JSON.parse(line);
    }
  }
  throw new Error(`No JSON object found in output:\n${output.slice(0, 500)}`);
}

/**
 * Spawns a process with inherited stdout and stderr.
 * @param cmd - Command and arguments
 * @param label - Label for error messages
 * @throws When the process exits with a non-zero code
 */
async function runInherit(cmd: readonly string[], label: string): Promise<void> {
  console.log(`[constrained] ${label}...`);
  const proc = Bun.spawn([...cmd], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${String(exitCode)}`);
  }
}

/** Result shape from bench-in-container.ts */
type ContainerBenchResult = {
  readonly limits: {
    readonly cpuAffinity: string;
    readonly memoryMax: string;
    readonly cpuAffinityValid: boolean;
    readonly memoryValid: boolean;
  };
  readonly sysbench: { readonly eventsPerSec: number };
  readonly timings: readonly { readonly label: string; readonly ms: number }[];
};

/**
 * Computes the median of a non-empty numeric array.
 * @param values - Array of numbers (must be non-empty)
 * @returns Median value
 * @throws When array is empty
 */
function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute median of empty array');
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Indices guaranteed in-bounds: length > 0 ensures mid >= 0,
  // and mid < length by construction of Math.floor(length / 2).
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

/**
 * Collects timing values from all containers for a label or label prefix.
 * @param results - All container bench results
 * @param labelOrPrefix - Exact label match, or prefix for labels like "warm-0", "warm-1", ...
 * @returns Array of ms values across all containers
 */
function collectTimings(
  results: readonly ContainerBenchResult[],
  labelOrPrefix: string,
): number[] {
  return results.flatMap((result) =>
    result.timings
      .filter((entry) => entry.label === labelOrPrefix || entry.label.startsWith(`${labelOrPrefix}-`))
      .map((entry) => entry.ms),
  );
}

/**
 * Formats a summary line for one timing category.
 * @param label - Category name (e.g. "cold", "warm")
 * @param values - All ms values for this category
 * @returns Formatted summary string
 */
function formatTimingSummary(label: string, values: readonly number[]): string {
  const min = Math.min(...values);
  const med = median(values);
  const max = Math.max(...values);
  /** Pad label to 16 chars for aligned output */
  const LABEL_PAD = 16;
  return `  ${label.padEnd(LABEL_PAD)} min=${min.toFixed(1)}ms  median=${med.toFixed(1)}ms  max=${max.toFixed(1)}ms  (n=${String(values.length)})`;
}

//region Host baseline

console.log('=== HOST BASELINE ===');
const hostJson = await runCapture(
  ['bun', resolve(import.meta.dirname, 'validate-resources.ts')],
  'Running host baseline benchmark',
);
const hostResult = JSON.parse(hostJson) as {
  sysbench: { eventsPerSec: number };
  serial: { ms: number };
  parallel: { ms: number };
  io: { ms: number; filesPerSec: number };
};
console.log(`Host sysbench: ${String(hostResult.sysbench.eventsPerSec)} events/sec`);
console.log(`Host serial CPU: ${String(hostResult.serial.ms)}ms`);
console.log(`Host parallel CPU: ${String(hostResult.parallel.ms)}ms`);
console.log(`Host IO: ${String(hostResult.io.ms)}ms (${String(hostResult.io.filesPerSec)} files/sec)`);

//endregion Host baseline

//region Container build

console.log('\n=== CONTAINER BUILD ===');
await runInherit(
  ['podman', 'build', '-t', IMAGE_NAME, '-f', CONTAINERFILE, MONOREPO_ROOT],
  'Building container image',
);

//endregion Container build

//region Parallel contention benchmark

console.log(`\n=== PARALLEL CONTENTION BENCHMARK (${String(CONTAINER_COUNT)} containers on core ${CPUSET_CPU}) ===`);

const containerResults = await Promise.all(
  Array.from({ length: CONTAINER_COUNT }, async (_, containerIndex) => {
    const output = await runCapture(
      [
        'podman', 'run', '--rm',
        // Disable SELinux labeling: the :Z volume flag relabels files for
        // one container's context, conflicting when multiple containers
        // mount the same volume simultaneously.
        '--security-opt', 'label=disable',
        ...RESOURCE_FLAGS,
        '-v', `${MONOREPO_ROOT}:/app`,
        IMAGE_NAME,
        'taskset', '-c', CPUSET_CPU,
        'bun', 'packages/fixture/file-enforcer-perf/src/bench-in-container.ts',
      ],
      `Container ${String(containerIndex)}`,
    );
    return parseLastJsonLine(output) as ContainerBenchResult;
  }),
);

//endregion Parallel contention benchmark

//region Sysbench validation

console.log('\n=== SYSBENCH VALIDATION ===');
containerResults.forEach((result, containerIndex) => {
  console.log(`  Container ${String(containerIndex)}: ${String(result.sysbench.eventsPerSec)} events/sec`);
});

const peakSysbench = Math.max(...containerResults.map((result) => result.sysbench.eventsPerSec));
console.log(`  Peak: ${String(peakSysbench)} events/sec`);
console.log(`  VPS baseline: ${String(VPS_SYSBENCH_BASELINE)} events/sec`);

if (peakSysbench <= VPS_SYSBENCH_BASELINE) {
  console.log(`  PASS: peak (${String(peakSysbench)}) <= baseline (${String(VPS_SYSBENCH_BASELINE)})`);
} else {
  console.warn(
    `  WARNING: peak sysbench (${String(peakSysbench)})`
    + ` exceeds VPS baseline (${String(VPS_SYSBENCH_BASELINE)}).`
    + ' Add more containers or verify contention is sufficient.',
  );
}

//endregion Sysbench validation

//region Cgroup limit verification

containerResults.forEach((result, containerIndex) => {
  if (!result.limits.cpuAffinityValid) {
    console.warn(`  WARNING: Container ${String(containerIndex)} CPU affinity unexpected: "${result.limits.cpuAffinity}"`);
  }
  if (!result.limits.memoryValid) {
    console.warn(`  WARNING: Container ${String(containerIndex)} memory unexpected: "${result.limits.memoryMax}"`);
  }
});

//endregion Cgroup limit verification

//region Benchmark results

console.log('\n=== BENCHMARK RESULTS ===');

/** Timing categories to aggregate: label prefix maps to display name */
const TIMING_CATEGORIES = ['cold', 'warm', 'source-changed', 'dest-changed'] as const;

TIMING_CATEGORIES.forEach((category) => {
  const values = collectTimings(containerResults, category);
  if (values.length > 0) {
    console.log(formatTimingSummary(category, values));
  }
});

//endregion Benchmark results

console.log('\n=== COMPLETE ===');
