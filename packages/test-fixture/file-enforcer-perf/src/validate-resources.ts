/**
 * Runs CPU (serial + parallel), memory, sysbench, and IO benchmarks,
 * reads cgroup limits. Outputs structured JSON to stdout for comparison
 * between host and container. Diagnostic messages go to stderr.
 *
 * Usage:
 *   Host:      bun validate-resources.ts
 *   Container: podman run ... bun validate-resources.ts
 */

import { createHash } from 'node:crypto';
import { readFile, } from 'node:fs/promises';
import { resolve, } from 'node:path';

import spawn from 'nano-spawn';

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

/**
 * Runs sysbench cpu benchmark and parses events per second.
 * Falls back to -1 if sysbench is not installed.
 * @returns Events per second from sysbench cpu run
 */
async function runSysbench(): Promise<number> {
  try {
    const { stdout } = await spawn('sysbench', ['cpu', '--threads=1', 'run']);

    /** Parse "events per second: NNNN.NN" from sysbench output */
    const match = /events per second:\s+([\d.]+)/.exec(stdout);
    if (match !== null) {
      return Number.parseFloat(match[1]!);
    }
    return -1;
  } catch {
    // sysbench not installed
    return -1;
  }
}

console.error('[validate] running sysbench cpu...');
const sysbenchEventsPerSec = await runSysbench();
console.error(`[validate] sysbench: ${String(sysbenchEventsPerSec.toFixed(1))} events/sec`);

//endregion Sysbench CPU benchmark

//region Serial CPU benchmark -- SHA-256 hashing, single-threaded

/** Number of SHA-256 hashes to compute sequentially */
const SERIAL_HASH_COUNT = 200_000;
console.error(`[validate] serial CPU: ${String(SERIAL_HASH_COUNT)} SHA-256 hashes...`);

const serialStart = performance.now();
/** Accumulator consumed at the end to prevent JIT dead code elimination */
let serialAccumulator = 0;
// Imperative loop required: sequential hash computation for timing accuracy.
for (let hashIndex = 0; hashIndex < SERIAL_HASH_COUNT; hashIndex++) {
  const hasher = createHash('sha256');
  hasher.update(`benchmark-serial-${String(hashIndex)}`);
  serialAccumulator += hasher.digest('hex').length;
}
const serialMs = performance.now() - serialStart;
console.error(`[validate] serial CPU: ${serialMs.toFixed(1)}ms`);

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

/** Inline script executed by each worker process using node:crypto */
const workerScript = [
  'const { createHash } = require("node:crypto");',
  'let acc = 0;',
  `for (let i = 0; i < ${String(HASHES_PER_WORKER)}; i++) {`,
  '  const h = createHash("sha256");',
  '  h.update("parallel-" + String(i));',
  '  acc += h.digest("hex").length;',
  '}',
].join('\n');

console.error(`[validate] parallel CPU: ${String(WORKER_COUNT)} workers * ${String(HASHES_PER_WORKER)} hashes...`);

const parallelStart = performance.now();
await Promise.all(
  Array.from({ length: WORKER_COUNT }, async () => {
    await spawn(process.execPath, ['-e', workerScript]);
  }),
);
const parallelMs = performance.now() - parallelStart;
console.error(`[validate] parallel CPU: ${parallelMs.toFixed(1)}ms`);

//endregion Parallel CPU benchmark

//region Memory benchmark -- allocate and fill 256 MB

/** Allocation size in megabytes */
const ALLOC_MB = 256;
const ALLOC_BYTES = ALLOC_MB * 1024 * 1024;
console.error(`[validate] memory: allocating ${String(ALLOC_MB)}MB...`);

const memStart = performance.now();
const buffer = new Uint8Array(ALLOC_BYTES);
buffer.fill(42);
const memMs = performance.now() - memStart;
console.error(`[validate] memory: ${memMs.toFixed(1)}ms`);

//endregion Memory benchmark

//region IO benchmark -- write + read small files to detect throttling

/**
 * Number of small files to write and read back for IO benchmarking.
 * Tests random IO patterns similar to file-enforcer workload.
 */
const IO_FILE_COUNT = 50;
const IO_DIR = '/tmp/fe-io-bench';

console.error(`[validate] IO: ${String(IO_FILE_COUNT)} file write/read cycles...`);

const { mkdir, rm, writeFile, } = await import('node:fs/promises');
const { join, } = await import('node:path');

await rm(IO_DIR, { recursive: true, force: true });
await mkdir(IO_DIR, { recursive: true });

const ioStart = performance.now();
// Sequential write + read to measure per-operation latency
for (let fileIndex = 0; fileIndex < IO_FILE_COUNT; fileIndex++) {
  const filePath = join(IO_DIR, `file-${String(fileIndex)}.txt`);
  // eslint-disable-next-line no-await-in-loop -- sequential IO benchmark
  await writeFile(filePath, `content-${String(fileIndex)}-padding`.repeat(10));
  // eslint-disable-next-line no-await-in-loop -- sequential IO benchmark
  await readFile(filePath, 'utf8');
}
const ioMs = performance.now() - ioStart;
await rm(IO_DIR, { recursive: true, force: true });
console.error(`[validate] IO: ${ioMs.toFixed(1)}ms (${(IO_FILE_COUNT / ioMs * 1000).toFixed(0)} files/sec)`);

//endregion IO benchmark

//region Output structured JSON

/** Prevent JIT dead code elimination of benchmark results */
const _sink = serialAccumulator + buffer[0];

/** Rounds to one decimal place for readable output */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

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
    ms: round1(serialMs),
    hashesPerSec: Math.round(SERIAL_HASH_COUNT / serialMs * 1000),
  },
  parallel: {
    workers: WORKER_COUNT,
    hashesPerWorker: HASHES_PER_WORKER,
    totalHashes: WORKER_COUNT * HASHES_PER_WORKER,
    ms: round1(parallelMs),
    hashesPerSec: Math.round((WORKER_COUNT * HASHES_PER_WORKER) / parallelMs * 1000),
  },
  memory: {
    allocatedMB: ALLOC_MB,
    ms: round1(memMs),
    mbPerSec: Math.round(ALLOC_MB / memMs * 1000),
  },
  io: {
    fileCount: IO_FILE_COUNT,
    ms: round1(ioMs),
    filesPerSec: Math.round(IO_FILE_COUNT / ioMs * 1000),
  },
};

// JSON to stdout (parseable), diagnostics already went to stderr
console.log(JSON.stringify(result));

//endregion Output structured JSON
