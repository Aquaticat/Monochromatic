// oxlint-disable unicorn/prefer-native-coercion-functions -- keyFn wrappers intentionally narrow parameter types

import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const { $, } = types.function.from.function.memoize.sync.positional;
const createSyncStore = types.object.store.from.store.sync.named.$;

describe($, () => {
  test('returns computed value on first call', () => {
    const fn = (x: number,): number => x * 2;
    const memoized = $(fn, (x: number,) => String(x,),);

    expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
  });

  test('returns cached value on subsequent calls with same args and salt', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };
    const memoized = $(fn, (x: number,) => String(x,),);

    expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
    expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
    expect(callCount,).toBe(1,);
  });

  test('computes separately for different args', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };
    const memoized = $(fn, (x: number,) => String(x,),);

    expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
    expect(memoized({ args: [6,], salt: 'v1', },),).toBe(12,);
    expect(callCount,).toBe(2,);
  });

  test('different salt produces different cache entries', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x * 2;
    };
    const memoized = $(fn, (x: number,) => String(x,),);

    memoized({ args: [5,], salt: 'v1', },);
    memoized({ args: [5,], salt: 'v2', },);
    expect(callCount,).toBe(2,);
  });

  test('multi-arg keyFn works correctly', () => {
    let callCount = 0;
    const fn = (a: number, b: number,): number => {
      callCount += 1;
      return a + b;
    };
    const memoized = $(fn, (a: number, b: number,) => `${String(a,)}:${String(b,)}`,);

    expect(memoized({ args: [1, 2,], salt: 'v1', },),).toBe(3,);
    expect(memoized({ args: [1, 2,], salt: 'v1', },),).toBe(3,);
    expect(memoized({ args: [2, 1,], salt: 'v1', },),).toBe(3,);
    expect(callCount,).toBe(2,);
  });

  test('.size reflects cache size', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x,),);

    expect(memoized.size,).toBe(0,);
    memoized({ args: [1,], salt: 'v1', },);
    expect(memoized.size,).toBe(1,);
    memoized({ args: [2,], salt: 'v1', },);
    expect(memoized.size,).toBe(2,);
    memoized({ args: [1,], salt: 'v1', },);
    expect(memoized.size,).toBe(2,);
  });

  test('.clear() empties the cache', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x,),);

    memoized({ args: [1,], salt: 'v1', },);
    memoized({ args: [2,], salt: 'v1', },);
    expect(memoized.size,).toBe(2,);
    memoized.clear();
    expect(memoized.size,).toBe(0,);
  });

  test('.delete() removes a specific entry', () => {
    const fn = (x: number,): number => x;
    const memoized = $(fn, (x: number,) => String(x,),);

    memoized({ args: [1,], salt: 'v1', },);
    memoized({ args: [2,], salt: 'v1', },);
    expect(memoized.size,).toBe(2,);
    memoized.delete('1:v1',);
    expect(memoized.size,).toBe(1,);
  });

  test('.store provides access to the underlying SyncStore', () => {
    const fn = (x: number,): number => x * 3;
    const memoized = $(fn, (x: number,) => String(x,),);

    memoized({ args: [7,], salt: 's', },);
    expect(memoized.store.get<number>('7:s',),).toBe(21,);
  });

  test('LRU eviction removes oldest entry at capacity', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x;
    };
    const store = createSyncStore({
      storeId: 'lru-test',
      eviction: [{ policy: 'lru', maxSize: 3, },],
    },);
    const memoized = $(fn, (x: number,) => String(x,), store,);

    memoized({ args: [1,], salt: 'v1', },);
    memoized({ args: [2,], salt: 'v1', },);
    memoized({ args: [3,], salt: 'v1', },);
    expect(memoized.size,).toBe(3,);

    memoized({ args: [4,], salt: 'v1', },);
    expect(memoized.size,).toBe(3,);
    expect(memoized.store.get('1:v1',),).toBeUndefined();
    expect(memoized.store.get('4:v1',),).toBeDefined();
  });

  test('LRU access refreshes entry position', () => {
    const fn = (x: number,): number => x;
    const store = createSyncStore({
      storeId: 'lru-refresh-test',
      eviction: [{ policy: 'lru', maxSize: 3, },],
    },);
    const memoized = $(fn, (x: number,) => String(x,), store,);

    memoized({ args: [1,], salt: 'v1', },);
    memoized({ args: [2,], salt: 'v1', },);
    memoized({ args: [3,], salt: 'v1', },);

    // Access 1 to refresh it
    memoized({ args: [1,], salt: 'v1', },);

    // Now add 4 -- should evict 2 (oldest after refresh), not 1
    memoized({ args: [4,], salt: 'v1', },);
    expect(memoized.store.get('1:v1',),).toBeDefined();
    expect(memoized.store.get('2:v1',),).toBeUndefined();
  });

  test('same args with different salt are cached independently', () => {
    let callCount = 0;
    const fn = (x: number,): number => {
      callCount += 1;
      return x;
    };
    const memoized = $(fn, (x: number,) => String(x,),);

    memoized({ args: [1,], salt: 'a', },);
    memoized({ args: [1,], salt: 'a', },);
    memoized({ args: [1,], salt: 'b', },);
    memoized({ args: [1,], salt: 'b', },);
    expect(callCount,).toBe(2,);
  });

  test('custom store is used when provided', () => {
    const customStore = createSyncStore({ storeId: 'custom', },);
    const fn = (x: number,): number => x * 2;
    const memoized = $(fn, (x: number,) => String(x,), customStore,);

    memoized({ args: [5,], salt: 'v1', },);
    expect(customStore.get<number>('5:v1',),).toBe(10,);
    expect(memoized.store,).toBe(customStore,);
  });
},);
