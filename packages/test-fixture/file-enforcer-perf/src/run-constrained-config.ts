/**
 * Configuration constants for the constrained benchmark runner.
 * Defines container resource limits, device paths, and tuning parameters.
 */

import { resolve, } from 'node:path';

/** Absolute path to the monorepo root */
export const MONOREPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');

/** Containerfile location */
export const CONTAINERFILE = resolve(import.meta.dirname, '..', 'Containerfile');

/** Container image name */
export const IMAGE_NAME = 'file-enforcer-perf';

/**
 * The user's cheapest VPS scored 1605 events/sec in sysbench cpu.
 * Even the PEAK score across all contending containers must stay below this.
 */
export const VPS_SYSBENCH_BASELINE = 1_605;

/**
 * Number of containers to run simultaneously on the same CPU core.
 * With 5+ containers sharing 1 core of a Ryzen 7 8700F (~5300 events/sec),
 * each gets ~20% throughput (~1060 events/sec), well below the 1605 baseline.
 * Extra containers ensure peak performance during brief idle windows
 * (when some containers are between benchmark phases) stays below baseline.
 */
export const CONTAINER_COUNT = 5;

/**
 * CPU core to pin all containers to via taskset inside the container.
 * All containers compete for this single core via EEVDF scheduler,
 * creating contention at sub-millisecond timeslice granularity
 * rather than CFS bandwidth throttling's 10-100ms stall periods.
 */
export const CPUSET_CPU = '0';

/**
 * Block device that backs the volume mount.
 * Determined by tracing /var/home -\> LUKS dm-0 -\> nvme0n1p6 -\> nvme0n1.
 * IO throttle cgroup rules apply at the device mapper level.
 */
const BLOCK_DEVICE = '/dev/dm-0';

/**
 * HDD-like IO limits.
 * Cheap shared HDD: ~75-150 random IOPS, ~80-120 MB/s sequential.
 * Using conservative end: 100 IOPS, 80 MB/s.
 */
const READ_BPS = '80mb';
/** Write bytes per second limit for HDD-like IO simulation */
const WRITE_BPS = '80mb';
/** Read IOPS limit for HDD-like IO simulation */
const READ_IOPS = '100';
/** Write IOPS limit for HDD-like IO simulation */
const WRITE_IOPS = '100';

/**
 * Podman flags for memory and IO constraints.
 * CPU pinning is done via taskset inside the container rather than
 * --cpuset-cpus, avoiding the need for sudo or cpuset delegation.
 */
export const RESOURCE_FLAGS = [
  '--memory=1g',
  `--device-read-bps=${BLOCK_DEVICE}:${READ_BPS}`,
  `--device-write-bps=${BLOCK_DEVICE}:${WRITE_BPS}`,
  `--device-read-iops=${BLOCK_DEVICE}:${READ_IOPS}`,
  `--device-write-iops=${BLOCK_DEVICE}:${WRITE_IOPS}`,
] as const;
