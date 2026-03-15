/**
 * Individual benchmark functions for resource validation.
 * Each benchmark returns structured results for JSON aggregation.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import spawn from 'nano-spawn';

/**
 * Runs sysbench cpu benchmark and parses events per second.
 * Falls back to -1 if sysbench is not installed.
 * @returns Events per second from sysbench cpu run
 */
export async function runSysbench(): Promise<number> {
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

/** Result from serial CPU benchmark */
export type SerialCpuResult = {
  /** Milliseconds elapsed */
  readonly ms: number;
  /** Number of hashes computed */
  readonly iterations: number;
};

/**
 * Runs serial CPU benchmark computing sequential SHA-256 hashes.
 * @param hashCount - Number of SHA-256 hashes to compute
 * @returns Elapsed time and iteration count
 */
export function runSerialCpuBenchmark(hashCount: number): SerialCpuResult {
  const start = performance.now();
  /** Accumulator consumed at the end to prevent JIT dead code elimination */
  let accumulator = 0;
  // Imperative loop required: sequential hash computation for timing accuracy.
  for (let hashIndex = 0; hashIndex < hashCount; hashIndex++) {
    const hasher = createHash('sha256');
    hasher.update(`benchmark-serial-${String(hashIndex)}`);
    accumulator += hasher.digest('hex').length;
  }
  const ms = performance.now() - start;
  /** Prevent dead code elimination by reading accumulator */
  void accumulator;
  return { ms, iterations: hashCount };
}

/**
 * Runs parallel CPU benchmark spawning multiple worker processes.
 * @param workerCount - Number of parallel worker processes
 * @param hashesPerWorker - SHA-256 hashes each worker computes
 * @returns Elapsed wall-clock time in milliseconds
 */
export async function runParallelCpuBenchmark(workerCount: number, hashesPerWorker: number): Promise<number> {
  /** Inline script executed by each worker process using node:crypto */
  const workerScript = [
    'const { createHash } = require("node:crypto");',
    'let acc = 0;',
    `for (let i = 0; i < ${String(hashesPerWorker)}; i++) {`,
    '  const h = createHash("sha256");',
    '  h.update("parallel-" + String(i));',
    '  acc += h.digest("hex").length;',
    '}',
  ].join('\n');

  const start = performance.now();
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await spawn(process.execPath, ['-e', workerScript]);
    }),
  );
  return performance.now() - start;
}

/** Result from memory benchmark */
export type MemoryBenchResult = {
  /** Milliseconds elapsed */
  readonly ms: number;
  /** First byte of buffer, consumed to prevent dead code elimination */
  readonly sinkByte: number;
};

/**
 * Runs memory benchmark allocating and filling a buffer.
 * @param allocMb - Megabytes to allocate
 * @returns Elapsed time and sink byte for dead code elimination prevention
 */
export function runMemoryBenchmark(allocMb: number): MemoryBenchResult {
  const allocBytes = allocMb * 1_024 * 1_024;
  const start = performance.now();
  const buffer = new Uint8Array(allocBytes);
  buffer.fill(42);
  const ms = performance.now() - start;
  return { ms, sinkByte: buffer[0] as number };
}

/** Result from IO benchmark */
export type IoBenchResult = {
  /** Milliseconds elapsed */
  readonly ms: number;
  /** Number of files written and read */
  readonly fileCount: number;
};

/**
 * Runs IO benchmark writing and reading small files sequentially.
 * @param fileCount - Number of files to write and read back
 * @returns Elapsed time and file count
 */
export async function runIoBenchmark(fileCount: number): Promise<IoBenchResult> {
  const ioDir = '/tmp/fe-io-bench';

  await rm(ioDir, { recursive: true, force: true });
  await mkdir(ioDir, { recursive: true });

  const start = performance.now();
  // Sequential write + read to measure per-operation latency
  for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
    const filePath = join(ioDir, `file-${String(fileIndex)}.txt`);
    // oxlint-disable-next-line no-await-in-loop -- sequential IO benchmark
    await writeFile(filePath, `content-${String(fileIndex)}-padding`.repeat(10));
    // oxlint-disable-next-line no-await-in-loop -- sequential IO benchmark
    await readFile(filePath, 'utf8');
  }
  const ms = performance.now() - start;
  await rm(ioDir, { recursive: true, force: true });

  return { ms, fileCount };
}

/**
 * Rounds to one decimal place for readable output.
 * @param value - Number to round
 * @returns Rounded value
 */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
