/**
 * Builds a podman container and runs file-enforcer benchmarks under
 * VPS-like resource constraints (0.5 vCPU, 1GB RAM, HDD-like IO).
 *
 * Uses --cpus=0.3 because cheap "1 vCPU" VPS providers commonly
 * allocate only 0.25 of a physical core. The host CPU (Ryzen 7 8700F)
 * has ~1.7x the IPC of a typical VPS Xeon, so 0.5 CPU still exceeds
 * the VPS baseline -- 0.3 CPU brings sysbench below 1605 events/sec.
 * IO throttling simulates a shared HDD (100 IOPS, 80 MB/s bandwidth).
 *
 * Validates constraints by:
 * 1. Running sysbench on host (baseline) and in container
 * 2. Ensuring container sysbench is slower than the user's real
 *    cheapest-VPS baseline of 1605 events/sec
 * 3. Verifying cgroup limits are correctly set
 * 4. Running file-enforcer benchmarks under all constraints
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
 * The container must score below this to be a valid simulation.
 */
const VPS_SYSBENCH_BASELINE = 1605;

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

/** Common podman flags for resource-constrained runs */
const RESOURCE_FLAGS = [
  '--cpus=0.3',
  '--memory=1g',
  `--device-read-bps=${BLOCK_DEVICE}:${READ_BPS}`,
  `--device-write-bps=${BLOCK_DEVICE}:${WRITE_BPS}`,
  `--device-read-iops=${BLOCK_DEVICE}:${READ_IOPS}`,
  `--device-write-iops=${BLOCK_DEVICE}:${WRITE_IOPS}`,
] as const;

/**
 * Spawns a process and captures its stdout as a string.
 * Stderr is inherited so diagnostic messages appear in the terminal.
 * @param cmd - Command and arguments
 * @param label - Label for error messages
 * @returns Stdout content
 * @throws When the process exits with a non-zero code
 */
async function runCapture(cmd: readonly string[], label: string): Promise<string> {
  console.log(`[constrained] ${label}...`);
  const proc = Bun.spawn([...cmd], {
    stdout: 'pipe',
    stderr: 'inherit',
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${String(exitCode)}`);
  }
  return stdout;
}

/**
 * Parses JSON from the last non-empty line of a string.
 * Needed because library console.log calls (from file-enforcer write operations)
 * may precede the structured JSON output on stdout.
 * @param output - Full stdout content potentially containing non-JSON prefix lines
 * @returns Parsed JSON value
 * @throws When no valid JSON line is found
 */
function parseLastJsonLine(output: string): unknown {
  /** Non-empty lines, last one should be the JSON output */
  const lines = output.trim().split('\n').filter((line) => line.trim().length > 0);
  // Walk backwards to find the JSON line -- it starts with '{'
  // let needed: iterating from the end until we find valid JSON
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex]!.trim();
    if (line.startsWith('{')) {
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

//region Host baseline

console.log('=== HOST BASELINE ===');
const hostJson = await runCapture(
  ['bun', resolve(import.meta.dirname, 'validate-resources.ts')],
  'Running host baseline benchmark',
);
const hostResult = JSON.parse(hostJson) as {
  sysbench: { eventsPerSec: number };
  serial: { ms: number; hashesPerSec: number };
  parallel: { ms: number; hashesPerSec: number };
  memory: { ms: number; mbPerSec: number };
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

//region Container resource validation

console.log('\n=== CONTAINER RESOURCE VALIDATION ===');
const containerValidJson = await runCapture(
  [
    'podman', 'run', '--rm',
    ...RESOURCE_FLAGS,
    '-v', `${MONOREPO_ROOT}:/app:Z`,
    IMAGE_NAME,
    'bun', 'packages/fixture/file-enforcer-perf/src/validate-resources.ts',
  ],
  'Running container validation benchmark',
);
const containerValid = JSON.parse(containerValidJson) as {
  limits: { cpuMax: string; memoryMax: string };
  sysbench: { eventsPerSec: number };
  serial: { ms: number; hashesPerSec: number };
  parallel: { ms: number; hashesPerSec: number };
  io: { ms: number; filesPerSec: number };
};

//endregion Container resource validation

//region Verification

console.log('\n=== RESOURCE LIMIT VERIFICATION ===');

// Sysbench comparison against real VPS baseline
console.log(`Container sysbench: ${String(containerValid.sysbench.eventsPerSec)} events/sec`);
console.log(`VPS baseline: ${String(VPS_SYSBENCH_BASELINE)} events/sec`);
if (containerValid.sysbench.eventsPerSec <= VPS_SYSBENCH_BASELINE) {
  console.log(`PASS: container (${String(containerValid.sysbench.eventsPerSec)}) <= VPS baseline (${String(VPS_SYSBENCH_BASELINE)})`);
} else {
  console.warn(
    `WARNING: container sysbench (${String(containerValid.sysbench.eventsPerSec)})`
    + ` is faster than VPS baseline (${String(VPS_SYSBENCH_BASELINE)}).`
    + ' CPU throttle may need tightening.',
  );
}

// Parallel CPU slowdown
const parallelSlowdown = containerValid.parallel.ms / hostResult.parallel.ms;
console.log(
  `Parallel CPU slowdown: ${parallelSlowdown.toFixed(1)}x`
  + ` (container ${String(containerValid.parallel.ms)}ms vs host ${String(hostResult.parallel.ms)}ms)`,
);

// IO slowdown
const ioSlowdown = containerValid.io.ms / hostResult.io.ms;
console.log(
  `IO slowdown: ${ioSlowdown.toFixed(1)}x`
  + ` (container ${String(containerValid.io.ms)}ms vs host ${String(hostResult.io.ms)}ms)`,
);

// Memory limit
const EXPECTED_MEMORY_BYTES = 1073741824;
const memoryLimitBytes = Number.parseInt(containerValid.limits.memoryMax, 10);
if (memoryLimitBytes === EXPECTED_MEMORY_BYTES) {
  console.log(`PASS: memory limit is 1GB (${String(memoryLimitBytes)} bytes).`);
} else {
  console.warn(`WARNING: memory limit is ${String(memoryLimitBytes)} bytes, expected ${String(EXPECTED_MEMORY_BYTES)}.`);
}

// CPU limit (--cpus=0.3 -> quota=30000, period=100000)
const EXPECTED_CPU_MAX = '30000 100000';
if (containerValid.limits.cpuMax === EXPECTED_CPU_MAX) {
  console.log(`PASS: cpu.max is "${containerValid.limits.cpuMax}" (--cpus=0.3).`);
} else {
  console.warn(`WARNING: cpu.max is "${containerValid.limits.cpuMax}", expected "${EXPECTED_CPU_MAX}".`);
}

//endregion Verification

//region File-enforcer benchmarks in container

console.log('\n=== FILE-ENFORCER BENCHMARKS (CONSTRAINED) ===');
const benchJson = await runCapture(
  [
    'podman', 'run', '--rm',
    ...RESOURCE_FLAGS,
    '-v', `${MONOREPO_ROOT}:/app:Z`,
    IMAGE_NAME,
    'bun', 'packages/fixture/file-enforcer-perf/src/bench-in-container.ts',
  ],
  'Running file-enforcer benchmarks in container',
);
const benchResult = parseLastJsonLine(benchJson) as {
  limits: { cpuValid: boolean; memoryValid: boolean };
  sysbench: { eventsPerSec: number };
  timings: ReadonlyArray<{ label: string; ms: number }>;
};

console.log(`\nContainer sysbench (during bench): ${String(benchResult.sysbench.eventsPerSec)} events/sec`);
console.log('\nConstrained benchmark results:');
benchResult.timings.forEach((entry) => {
  console.log(`  ${entry.label}: ${String(entry.ms)}ms`);
});

console.log(`\nCgroup limits valid: CPU=${String(benchResult.limits.cpuValid)}, Memory=${String(benchResult.limits.memoryValid)}`);

//endregion File-enforcer benchmarks in container

console.log('\n=== COMPLETE ===');
