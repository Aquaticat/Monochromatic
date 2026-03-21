import {
  afterEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { resolve, } from 'node:path';
import {
  addWatchedPaths,
  reads,
  reset,
  trackDest,
  trackRead,
  trackWriteTime,
  writes,
  writeTimestamps,
} from './tracker.ts';

//region tracker basics

describe('tracker', () => {
  afterEach(() => {
    reset();
    writeTimestamps.clear();
  },);

  test('trackRead adds absolute path to reads set', () => {
    trackRead('./some/file.ts',);
    expect(reads.has(resolve('./some/file.ts',),),).toBe(true,);
  });

  test('trackDest adds absolute path to writes set', () => {
    trackDest('./output/file.ts',);
    expect(writes.has(resolve('./output/file.ts',),),).toBe(true,);
  });

  test('trackDest does not record a write timestamp', () => {
    trackDest('./output/file.ts',);
    expect(writeTimestamps.has(resolve('./output/file.ts',),),).toBe(false,);
  });

  test('reset clears reads and writes but preserves writeTimestamps', () => {
    trackRead('./r.ts',);
    trackDest('./w.ts',);
    trackWriteTime('./w.ts',);

    reset();

    expect(reads.size,).toBe(0,);
    /** writeTimestamps must survive across re-runs for echo detection */
    expect(writeTimestamps.size,).toBe(1,);
  });

  test('trackRead resolves relative paths to absolute', () => {
    trackRead('relative/path.ts',);
    const allAbsolute = [...reads,].every(path => path.startsWith('/',));
    expect(allAbsolute,).toBe(true,);
  });

  test('deduplicates identical paths', () => {
    trackRead('./same.ts',);
    trackRead('./same.ts',);
    trackRead('./same.ts',);
    expect(reads.size,).toBe(1,);
  });

  test('handles absolute paths without double-resolving', () => {
    const absolutePath = '/absolute/path/file.ts';
    trackRead(absolutePath,);
    expect(reads.has(absolutePath,),).toBe(true,);
  });

  test('tracks reads and writes independently', () => {
    trackRead('./input.ts',);
    trackDest('./output.ts',);
    expect(reads.has(resolve('./output.ts',),),).toBe(false,);
    expect(writes.has(resolve('./input.ts',),),).toBe(false,);
  });
});

//endregion tracker basics

//region writeTimestamps

describe('writeTimestamps', () => {
  afterEach(() => {
    reset();
    writeTimestamps.clear();
  },);

  test('trackWriteTime records a timestamp for the path', () => {
    trackWriteTime('./dest.md',);
    expect(writeTimestamps.has(resolve('./dest.md',),),).toBe(true,);
  });

  test('recorded timestamp is close to Date.now()', () => {
    /** Capture time before and after to bound the timestamp */
    const before = Date.now();
    trackWriteTime('./timed.md',);
    const after = Date.now();
    const recorded = writeTimestamps.get(resolve('./timed.md',),);
    /** Timestamp should be between the two captures */
    const MAX_DELTA = 100;
    expect(recorded,).toBeGreaterThanOrEqual(before,);
  });

  test('later writes overwrite the previous timestamp', () => {
    trackWriteTime('./updated.md',);
    /** First timestamp */
    const first = writeTimestamps.get(resolve('./updated.md',),);
    // Tiny delay to ensure a new timestamp
    trackWriteTime('./updated.md',);
    /** Second timestamp should be >= first */
    const second = writeTimestamps.get(resolve('./updated.md',),);
    expect(second,).toBeGreaterThanOrEqual(first ?? 0,);
  });

  test('resolves relative paths to absolute', () => {
    trackWriteTime('relative/out.ts',);
    const allAbsolute = [...writeTimestamps.keys(),].every(path => path.startsWith('/',));
    expect(allAbsolute,).toBe(true,);
  });
});

//endregion writeTimestamps

//region addWatchedPaths

describe('addWatchedPaths', () => {
  afterEach(() => {
    reset();
  },);

  test('adds all provided paths to the reads set', () => {
    addWatchedPaths(['./extra1.ts', './extra2.ts',],);
    expect(reads.has(resolve('./extra1.ts',),),).toBe(true,);
    expect(reads.has(resolve('./extra2.ts',),),).toBe(true,);
  });

  test('resolves relative paths to absolute', () => {
    addWatchedPaths(['relative/dep.json',],);
    const allAbsolute = [...reads,].every(path => path.startsWith('/',));
    expect(allAbsolute,).toBe(true,);
  });

  test('deduplicates with existing tracked reads', () => {
    trackRead('./shared.ts',);
    addWatchedPaths(['./shared.ts', './new.ts',],);
    expect(reads.size,).toBe(2,);
  });

  test('handles empty array without error', () => {
    addWatchedPaths([],);
    expect(reads.size,).toBe(0,);
  });
});

//endregion addWatchedPaths
