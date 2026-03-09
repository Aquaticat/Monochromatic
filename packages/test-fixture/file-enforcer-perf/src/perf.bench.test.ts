/**
 * Micro-benchmarks for file-enforcer core operations using performance.now().
 *
 * IMPORTANT -- MICRO-BENCHMARK LIMITATIONS:
 *
 * These benchmarks are inherently unreliable due to:
 * - JIT compilation: hot loops may be optimized away or inlined
 * - Dead code elimination: unused results are candidates for removal
 * - Garbage collection pauses: can cause 10-100ms spikes
 * - OS scheduler jitter: other processes compete for CPU time
 * - Memory caching: repeated access patterns benefit from CPU cache
 * - Bun-specific optimizations: built-in APIs may fast-path certain patterns
 *
 * Mitigations applied:
 * - Results are consumed (accumulated/returned) to prevent elimination
 * - Multiple iterations amortize JIT warmup
 * - Generous pass thresholds (10-50x normal expected time)
 *
 * These tests detect GROSS regressions (10x+ slowdowns), not subtle differences.
 * For reliable end-to-end numbers, use run-e2e.ts with hyperfine instead.
 */

import { join, } from 'node:path';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  cat,
  classifyEvent,
  dedup,
  expandGlob,
  getProperty,
  mirrorGlobPath,
  overwrite,
  reset,
  trackDest,
  trackRead,
  trackWriteTime,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

/** Iterations for fast in-memory operations (string manipulation) */
const FAST_ITERATIONS = 100;

/** Iterations for I/O-bound operations (file reads/writes, glob expansion) */
const IO_ITERATIONS = 50;

/** Iterations for expensive operations (glob + read all files) */
const EXPENSIVE_ITERATIONS = 10;

/** Maximum ms for the entire iteration set -- generous to avoid CI flakes */
const MAX_FAST_MS = 500;
const MAX_IO_MS = 2_000;
const MAX_EXPENSIVE_MS = 5_000;

/**
 * Times a synchronous function.
 * @param fn - Function to benchmark
 * @returns Elapsed time in milliseconds
 */
function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/**
 * Times an async function.
 * @param fn - Async function to benchmark
 * @returns Elapsed time in milliseconds
 */
async function measureAsync(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe('perf: micro-benchmarks', () => {
  /** Temp directory created fresh for each test */
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fe-perf-'));
    reset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('expandGlob: 200 files across 20 directories', async () => {
    expect.assertions(2);
    const DIR_COUNT = 20;
    const FILES_PER_DIR = 10;

    await Promise.all(
      Array.from({ length: DIR_COUNT }, async (_, dirIndex) => {
        const dir = join(tempDir, `dir-${String(dirIndex).padStart(2, '0')}`);
        await mkdir(dir, { recursive: true });
        await Promise.all(
          Array.from({ length: FILES_PER_DIR }, (_, fileIndex) =>
            writeFile(join(dir, `file-${String(fileIndex)}.ts`), `content-${String(dirIndex)}-${String(fileIndex)}`),
          ),
        );
      }),
    );

    let resultCount = 0;
    const elapsed = await measureAsync(async () => {
      // Sequential: measure per-iteration latency, not throughput
      for (let iterIndex = 0; iterIndex < IO_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark timing required
        const matches = await expandGlob(join(tempDir, '**/*.ts'));
        resultCount += matches.length;
      }
    });

    console.log(`expandGlob (200 files, ${String(IO_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / IO_ITERATIONS).toFixed(2)}ms/call`);
    expect(resultCount).toBe(DIR_COUNT * FILES_PER_DIR * IO_ITERATIONS);
    expect(elapsed).toBeLessThan(MAX_EXPENSIVE_MS);
  });

  test('cat(string[]): concatenate 20 files', async () => {
    expect.assertions(1);
    const FILE_COUNT = 20;
    const paths = await Promise.all(
      Array.from({ length: FILE_COUNT }, async (_, index) => {
        const path = join(tempDir, `file-${String(index)}.txt`);
        await writeFile(path, `content of file ${String(index)}\n`.repeat(50));
        return path;
      }),
    );

    let totalLength = 0;
    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < IO_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        const result = await cat(paths);
        totalLength += result.length;
      }
    });

    console.log(`cat(string[20]) (${String(IO_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / IO_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_IO_MS);
  });

  test('cat(string): glob-read 60 files', async () => {
    expect.assertions(2);
    const DIR_COUNT = 20;
    const FILES_PER_DIR = 3;

    await Promise.all(
      Array.from({ length: DIR_COUNT }, async (_, dirIndex) => {
        const dir = join(tempDir, `pkg-${String(dirIndex).padStart(2, '0')}`, 'lib');
        await mkdir(dir, { recursive: true });
        await Promise.all(
          ['index', 'utils', 'helpers'].map((name) =>
            writeFile(join(dir, `${name}.ts`), `pkg${String(dirIndex)} ${name}`),
          ),
        );
      }),
    );

    let totalFiles = 0;
    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < EXPENSIVE_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        const results = await cat(join(tempDir, 'pkg-*/lib/*.ts'));
        totalFiles += results.length;
      }
    });

    console.log(`cat(glob) 60 files (${String(EXPENSIVE_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / EXPENSIVE_ITERATIONS).toFixed(2)}ms/call`);
    expect(totalFiles).toBe(DIR_COUNT * FILES_PER_DIR * EXPENSIVE_ITERATIONS);
    expect(elapsed).toBeLessThan(MAX_EXPENSIVE_MS);
  });

  test('overwrite: skip path (content unchanged)', async () => {
    expect.assertions(1);
    const filePath = join(tempDir, 'skip-target.txt');
    const content = 'known content '.repeat(100);
    await writeFile(filePath, content);

    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < IO_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        await overwrite(filePath, content);
      }
    });

    console.log(`overwrite skip (${String(IO_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / IO_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_IO_MS);
  });

  test('overwrite: write path (content different each time)', async () => {
    expect.assertions(1);
    const filePath = join(tempDir, 'write-target.txt');

    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < IO_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        await overwrite(filePath, `iteration ${String(iterIndex)}`);
      }
    });

    console.log(`overwrite write (${String(IO_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / IO_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_IO_MS);
  });

  test('mirrorGlobPath: 1000 path transformations', () => {
    expect.assertions(1);
    const MIRROR_ITERATIONS = 1_000;
    let resultLength = 0;

    const elapsed = measure(() => {
      // Imperative loop: pure computation, functional alternative would
      // allocate intermediate arrays that distort the string-manipulation benchmark
      for (let iterIndex = 0; iterIndex < MIRROR_ITERATIONS; iterIndex++) {
        const result = mirrorGlobPath(
          'packages/*/src/*.ts',
          'output/*/lib/*.ts',
          `packages/pkg-${String(iterIndex % 20).padStart(2, '0')}/src/index.ts`,
        );
        resultLength += result.length;
      }
    });

    console.log(`mirrorGlobPath (${String(MIRROR_ITERATIONS)} calls): ${elapsed.toFixed(1)}ms, avg ${(elapsed / MIRROR_ITERATIONS).toFixed(3)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_FAST_MS);
  });

  test('dedup: 2000-line content with 50% duplicates', () => {
    expect.assertions(1);
    const LINE_COUNT = 2_000;
    const DEDUP_MODULO = 1_000;
    const content = Array.from(
      { length: LINE_COUNT },
      (_, lineIndex) => `line ${String(lineIndex % DEDUP_MODULO)}`,
    ).join('\n');

    let resultLength = 0;
    const elapsed = measure(() => {
      for (let iterIndex = 0; iterIndex < FAST_ITERATIONS; iterIndex++) {
        resultLength += dedup(content).length;
      }
    });

    console.log(`dedup (${String(LINE_COUNT)} lines, ${String(FAST_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / FAST_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_FAST_MS);
  });

  test('getProperty: extract from 1KB JSON', () => {
    expect.assertions(1);
    const ARRAY_SIZE = 50;
    const jsonContent = JSON.stringify({
      deeply: { nested: { property: { value: 'found-it' } } },
      array: Array.from({ length: ARRAY_SIZE }, (_, index) => ({
        id: index,
        name: `item-${String(index)}`,
      })),
    }, null, 2);

    let resultLength = 0;
    const elapsed = measure(() => {
      for (let iterIndex = 0; iterIndex < FAST_ITERATIONS; iterIndex++) {
        resultLength += getProperty('.deeply.nested.property.value', jsonContent).length;
      }
    });

    console.log(`getProperty (1KB JSON, ${String(FAST_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / FAST_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_FAST_MS);
  });

  test('classifyEvent + stat: 100 classifications', async () => {
    expect.assertions(1);
    const trackedFile = join(tempDir, 'tracked.txt');
    await writeFile(trackedFile, 'content');
    trackRead(trackedFile);
    trackDest(trackedFile);
    trackWriteTime(trackedFile);

    let classificationCount = 0;
    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < FAST_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        const kind = await classifyEvent('tracked.txt', tempDir, join(tempDir, 'config.ts'));
        if (kind !== 'ignore') classificationCount++;
      }
    });

    console.log(`classifyEvent+stat (${String(FAST_ITERATIONS)} calls): ${elapsed.toFixed(1)}ms, avg ${(elapsed / FAST_ITERATIONS).toFixed(2)}ms/call, ${String(classificationCount)} non-ignore`);
    expect(elapsed).toBeLessThan(MAX_IO_MS);
  });

  test('deep glob: expand 6-level nested paths across 20 dirs', async () => {
    expect.assertions(2);
    const DIR_COUNT = 20;

    await Promise.all(
      Array.from({ length: DIR_COUNT }, async (_, dirIndex) => {
        const deepDir = join(
          tempDir,
          `pkg-${String(dirIndex).padStart(2, '0')}`,
          'lib', 'deep', 'nested', 'very', 'deep',
        );
        await mkdir(deepDir, { recursive: true });
        await writeFile(join(deepDir, 'module.ts'), `deep-content-${String(dirIndex)}`);
      }),
    );

    let matchCount = 0;
    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < EXPENSIVE_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        const matches = await expandGlob(join(tempDir, 'pkg-*/lib/deep/nested/very/deep/module.ts'));
        matchCount += matches.length;
      }
    });

    console.log(`deep glob (6 levels, ${String(EXPENSIVE_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / EXPENSIVE_ITERATIONS).toFixed(2)}ms/call`);
    expect(matchCount).toBe(DIR_COUNT * EXPENSIVE_ITERATIONS);
    expect(elapsed).toBeLessThan(MAX_EXPENSIVE_MS);
  });

  test('multiple overlapping globs: 5 patterns across 20 dirs', async () => {
    expect.assertions(1);
    const DIR_COUNT = 20;

    await Promise.all(
      Array.from({ length: DIR_COUNT }, async (_, dirIndex) => {
        const pkgDir = join(tempDir, `pkg-${String(dirIndex).padStart(2, '0')}`);
        await mkdir(join(pkgDir, 'lib'), { recursive: true });
        await mkdir(join(pkgDir, 'src'), { recursive: true });
        await mkdir(join(pkgDir, 'test'), { recursive: true });
        await Promise.all([
          writeFile(join(pkgDir, 'lib', 'index.ts'), `lib-${String(dirIndex)}`),
          writeFile(join(pkgDir, 'src', 'main.ts'), `src-${String(dirIndex)}`),
          writeFile(join(pkgDir, 'test', 'spec.ts'), `test-${String(dirIndex)}`),
        ]);
      }),
    );

    /** Five different glob patterns that partially overlap */
    const patterns = [
      join(tempDir, 'pkg-*/lib/*.ts'),
      join(tempDir, 'pkg-*/src/*.ts'),
      join(tempDir, 'pkg-*/test/*.ts'),
      join(tempDir, 'pkg-0*/lib/*.ts'),
      join(tempDir, 'pkg-1*/lib/*.ts'),
    ];

    let totalMatches = 0;
    const elapsed = await measureAsync(async () => {
      for (let iterIndex = 0; iterIndex < EXPENSIVE_ITERATIONS; iterIndex++) {
        // eslint-disable-next-line no-await-in-loop -- sequential benchmark
        const results = await Promise.all(patterns.map(expandGlob));
        totalMatches += results.reduce((sum, matches) => sum + matches.length, 0);
      }
    });

    const GLOB_COUNT = 5;
    console.log(`${String(GLOB_COUNT)} overlapping globs (${String(EXPENSIVE_ITERATIONS)} iters): ${elapsed.toFixed(1)}ms, avg ${(elapsed / EXPENSIVE_ITERATIONS).toFixed(2)}ms/call`);
    expect(elapsed).toBeLessThan(MAX_EXPENSIVE_MS);
  });
});
