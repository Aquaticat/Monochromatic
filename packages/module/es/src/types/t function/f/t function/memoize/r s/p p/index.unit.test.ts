import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.function.from.function.memoize.sync.positional.$;

describe($, () => {
  test('returns computed value on first call', () => {
    const fn = (x: number,): number => x * 2;
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    expect(memoized(5,),).toBe(10,);
  });

  test('returns cached value on subsequent calls with same args', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    expect(memoized(5,),).toBe(10,);
    expect(memoized(5,),).toBe(10,);
    expect(callCount,).toBe(1,);
  });

  test('computes separately for different args', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    expect(memoized(5,),).toBe(10,);
    expect(memoized(6,),).toBe(12,);
    expect(callCount,).toBe(2,);
  });

  test('different salt produces different cache entries', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };

    const memoized1 = $(fn, (x: number,) => String(x), 'v1',);
    const memoized2 = $(fn, (x: number,) => String(x), 'v2',);

    memoized1(5,);
    memoized2(5,);
    expect(callCount,).toBe(2,);
  });

  test('multi-arg keyFn works correctly', () => {
    let callCount = 0;
    const fn = (a: number, b: number,): number => {
      callCount += 1;
      return a + b;
    };
    const memoized = $(fn, (a: number, b: number,) => `${String(a)}:${String(b)}`, 'v1',);

    expect(memoized(1, 2,),).toBe(3,);
    expect(memoized(1, 2,),).toBe(3,);
    expect(memoized(2, 1,),).toBe(3,);
    expect(callCount,).toBe(2,);
  });

  test('.size reflects cache size', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    expect(memoized.size,).toBe(0,);
    memoized(1,);
    expect(memoized.size,).toBe(1,);
    memoized(2,);
    expect(memoized.size,).toBe(2,);
    memoized(1,);
    expect(memoized.size,).toBe(2,);
  });

  test('.clear() empties the cache', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    memoized(1,);
    memoized(2,);
    expect(memoized.size,).toBe(2,);
    memoized.clear();
    expect(memoized.size,).toBe(0,);
  });

  test('.delete() removes a specific entry', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x), 'v1',);

    memoized(1,);
    memoized(2,);
    expect(memoized.size,).toBe(2,);
    memoized.delete('1:v1',);
    expect(memoized.size,).toBe(1,);
  });

  test('.store provides access to the underlying SyncStore', () => {
    const fn = (x: number,): number => x * 3;
    const memoized = $(fn, (x: number,) => String(x), 's',);

    memoized(7,);
    expect(memoized.store.get<number>('7:s',),).toBe(21,);
  });

  test('LRU eviction removes oldest entry at capacity', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x;
    };
    const memoized = $(fn, (x: number,) => String(x), 'v1', 3,);

    memoized(1,);
    memoized(2,);
    memoized(3,);
    expect(memoized.size,).toBe(3,);

    memoized(4,);
    expect(memoized.size,).toBe(3,);
    expect(memoized.store.get('1:v1',),).toBeUndefined();
    expect(memoized.store.get('4:v1',),).toBeDefined();
  });

  test('LRU access refreshes entry position', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x), 'v1', 3,);

    memoized(1,);
    memoized(2,);
    memoized(3,);

    // Access 1 to refresh it
    memoized(1,);

    // Now add 4 -- should evict 2 (oldest after refresh), not 1
    memoized(4,);
    expect(memoized.store.get('1:v1',),).toBeDefined();
    expect(memoized.store.get('2:v1',),).toBeUndefined();
  });

  test('numeric salt works', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x;
    };
    const memoized = $(fn, (x: number,) => String(x), 42,);

    memoized(1,);
    memoized(1,);
    expect(callCount,).toBe(1,);
  });

  test('custom store is used when provided', () => {
    const customStore = types.object.store.from.store.sync.named.$({ storeId: 'custom', },);
    const fn = (x: number,): number => x * 2;
    const memoized = $(fn, (x: number,) => String(x), 'v1', undefined, customStore,);

    memoized(5,);
    expect(customStore.get<number>('5:v1',),).toBe(10,);
    expect(memoized.store,).toBe(customStore,);
  });
});
