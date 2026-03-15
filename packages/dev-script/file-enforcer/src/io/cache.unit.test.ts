import {
  afterEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import {
  invalidatePaths,
  readCache,
  readCached,
  updateCache,
} from './cache.ts';

/** Fresh temp directory for each test */
async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'file-enforcer-cache-',),);
}

afterEach(() => {
  readCache.clear();
},);

describe('readCached', () => {
  test('reads file from disk on first call', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'a.txt',);
    await Bun.write(file, 'hello',);
    expect(await readCached(file,),).toBe('hello',);
    await rm(dir, { recursive: true, },);
  });

  test('returns cached content on subsequent calls without re-reading', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'a.txt',);
    await Bun.write(file, 'original',);
    expect(await readCached(file,),).toBe('original',);
    // Modify file on disk -- cache should still return old content
    await Bun.write(file, 'modified',);
    expect(await readCached(file,),).toBe('original',);
    await rm(dir, { recursive: true, },);
  });

  test('caches by absolute path', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'b.txt',);
    await Bun.write(file, 'content',);
    await readCached(file,);
    expect(readCache.has(resolve(file,),),).toBe(true,);
    await rm(dir, { recursive: true, },);
  });
});

describe('invalidatePaths', () => {
  test('removes specific path from cache', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'c.txt',);
    await Bun.write(file, 'v1',);
    await readCached(file,);
    expect(readCache.size,).toBe(1,);
    invalidatePaths([file,],);
    expect(readCache.size,).toBe(0,);
    await rm(dir, { recursive: true, },);
  });

  test('re-reads file after invalidation picks up new content', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'd.txt',);
    await Bun.write(file, 'v1',);
    expect(await readCached(file,),).toBe('v1',);
    await Bun.write(file, 'v2',);
    invalidatePaths([file,],);
    expect(await readCached(file,),).toBe('v2',);
    await rm(dir, { recursive: true, },);
  });

  test('does not affect other cached entries', async () => {
    const dir = await makeTmpDir();
    const fileA = join(dir, 'a.txt',);
    const fileB = join(dir, 'b.txt',);
    await Bun.write(fileA, 'aaa',);
    await Bun.write(fileB, 'bbb',);
    await readCached(fileA,);
    await readCached(fileB,);
    invalidatePaths([fileA,],);
    expect(readCache.has(resolve(fileB,),),).toBe(true,);
    await rm(dir, { recursive: true, },);
  });
});

describe('updateCache', () => {
  test('sets cache entry without reading from disk', () => {
    updateCache('/fake/path.txt', 'injected',);
    expect(readCache.get(resolve('/fake/path.txt',),),).toBe('injected',);
  });

  test('subsequent readCached returns the updated content', async () => {
    const dir = await makeTmpDir();
    const file = join(dir, 'e.txt',);
    await Bun.write(file, 'disk-content',);
    // Pre-populate cache with different content (simulates post-write update)
    updateCache(file, 'written-content',);
    expect(await readCached(file,),).toBe('written-content',);
    await rm(dir, { recursive: true, },);
  });
});
