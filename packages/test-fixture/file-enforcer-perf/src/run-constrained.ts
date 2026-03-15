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

import type { ContainerBenchResult } from './run-constrained-utils.ts';
import {
  collectTimings,
  formatTimingSummary,
  parseLastJsonLine,
  runCapture,
  runInherit,
} from './run-constrained-utils.ts';

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
