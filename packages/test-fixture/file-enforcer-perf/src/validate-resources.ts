/**
 * Runs CPU (serial + parallel), memory, sysbench, and IO benchmarks,
 * reads cgroup limits. Outputs structured JSON to stdout for comparison
 * between host and container. Diagnostic messages go to stderr.
 *
 * Usage:
 *   Host:      bun validate-resources.ts
 *   Container: podman run ... bun validate-resources.ts
 */

import { readFile, } from 'node:fs/promises';

import {
  round1,
  runIoBenchmark,
  runMemoryBenchmark,
  runParallelCpuBenchmark,
  runSerialCpuBenchmark,
  runSysbench,
} from './validate-benchmarks.ts';

//region Cgroup limit detection

// let needed: cgroup reads may fail on host or non-cgroup-v2 systems
let cpuMax = 'max 100000';
try {
  cpuMax = (await readFile('/sys/fs/cgroup/cpu.max', 'utf8')).trim();
} catch {
  // Not in a cgroup v2 container or no read access
}

// let needed: same fallback reason as cpuMax
let memoryMax = 'max';
try {
  memoryMax = (await readFile('/sys/fs/cgroup/memory.max', 'utf8')).trim();
} catch {
  // Not in a cgroup v2 container or no read access
}

//endregion Cgroup limit detection

//region Sysbench CPU benchmark

console.error('[validate] running sysbench cpu...');
const sysbenchEventsPerSec = await runSysbench();
console.error(`[validate] sysbench: ${String(sysbenchEventsPerSec.toFixed(1))} events/sec`);

//endregion Sysbench CPU benchmark

//region Serial CPU benchmark -- SHA-256 hashing, single-threaded

/** Number of SHA-256 hashes to compute sequentially */
const SERIAL_HASH_COUNT = 200_000;
console.error(`[validate] serial CPU: ${String(SERIAL_HASH_COUNT)} SHA-256 hashes...`);

const serialResult = runSerialCpuBenchmark(SERIAL_HASH_COUNT);
console.error(`[validate] serial CPU: ${serialResult.ms.toFixed(1)}ms`);

//endregion Serial CPU benchmark

//region Parallel CPU benchmark -- 8 workers each computing hashes

/**
 * Number of parallel worker processes to spawn.
 * On a 16-core host, these all run truly parallel.
 * In a container with --cpus=0.3, they share 0.3 of a core equivalent.
 */
const WORKER_COUNT = 8;
/** SHA-256 hashes per worker */
const HASHES_PER_WORKER = 50_000;

console.error(`[validate] parallel CPU: ${String(WORKER_COUNT)} workers * ${String(HASHES_PER_WORKER)} hashes...`);

const parallelMs = await runParallelCpuBenchmark(WORKER_COUNT, HASHES_PER_WORKER);
console.error(`[validate] parallel CPU: ${parallelMs.toFixed(1)}ms`);

//endregion Parallel CPU benchmark

//region Memory benchmark -- allocate and fill 256 MB

/** Allocation size in megabytes */
const ALLOC_MB = 256;
console.error(`[validate] memory: allocating ${String(ALLOC_MB)}MB...`);

const memResult = runMemoryBenchmark(ALLOC_MB);
console.error(`[validate] memory: ${memResult.ms.toFixed(1)}ms`);

//endregion Memory benchmark

//region IO benchmark -- write + read small files to detect throttling

/**
 * Number of small files to write and read back for IO benchmarking.
 * Tests random IO patterns similar to file-enforcer workload.
 */
const IO_FILE_COUNT = 50;

console.error(`[validate] IO: ${String(IO_FILE_COUNT)} file write/read cycles...`);

const ioResult = await runIoBenchmark(IO_FILE_COUNT);
console.error(`[validate] IO: ${ioResult.ms.toFixed(1)}ms (${(IO_FILE_COUNT / ioResult.ms * 1_000).toFixed(0)} files/sec)`);

//endregion IO benchmark

//region Output structured JSON

/** Prevent JIT dead code elimination of benchmark results */
const _sink = memResult.sinkByte;

const result = {
  limits: {
    cpuMax,
    memoryMax,
  },
  sysbench: {
    eventsPerSec: round1(sysbenchEventsPerSec),
  },
  serial: {
    iterations: SERIAL_HASH_COUNT,
    ms: round1(serialResult.ms),
    hashesPerSec: Math.round(SERIAL_HASH_COUNT / serialResult.ms * 1_000),
  },
  parallel: {
    workers: WORKER_COUNT,
    hashesPerWorker: HASHES_PER_WORKER,
    totalHashes: WORKER_COUNT * HASHES_PER_WORKER,
    ms: round1(parallelMs),
    hashesPerSec: Math.round((WORKER_COUNT * HASHES_PER_WORKER) / parallelMs * 1_000),
  },
  memory: {
    allocatedMB: ALLOC_MB,
    ms: round1(memResult.ms),
    mbPerSec: Math.round(ALLOC_MB / memResult.ms * 1_000),
  },
  io: {
    fileCount: IO_FILE_COUNT,
    ms: round1(ioResult.ms),
    filesPerSec: Math.round(IO_FILE_COUNT / ioResult.ms * 1_000),
  },
};

// JSON to stdout (parseable), diagnostics already went to stderr
console.log(JSON.stringify(result));

//endregion Output structured JSON
