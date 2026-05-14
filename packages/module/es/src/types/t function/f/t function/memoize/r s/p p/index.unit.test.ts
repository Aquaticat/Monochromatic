// oxlint-disable unicorn/prefer-native-coercion-functions -- keyFn wrappers intentionally narrow parameter types

import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const { $, } = types.function.from.function.memoize.sync.positional;
const createSyncStore = types.object.store.from.store.sync.named.$;

await describe({
  name: $.name,
  children: [
    it({
      name: 'returns computed value on first call',
      fn: async () => {
        const fn = (x: number,): number => x * 2;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
      },
    },),
    it({
      name: 'returns cached value on subsequent calls with same args and salt',
      fn: async () => {
        let callCount = 0;
        const fn = (x: number,): number => {
          callCount += 1;
          return x * 2;
        };
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
        expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
        expect(callCount,).toBe(1,);
      },
    },),
    it({
      name: 'computes separately for different args',
      fn: async () => {
        let callCount = 0;
        const fn = (x: number,): number => {
          callCount += 1;
          return x * 2;
        };
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        expect(memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
        expect(memoized({ args: [6,], salt: 'v1', },),).toBe(12,);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: 'different salt produces different cache entries',
      fn: async () => {
        let callCount = 0;
        const fn = (x: number,): number => {
          callCount += 1;
          return x * 2;
        };
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        memoized({ args: [5,], salt: 'v1', },);
        memoized({ args: [5,], salt: 'v2', },);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: 'multi-arg keyFn works correctly',
      fn: async () => {
        let callCount = 0;
        const fn = (a: number, b: number,): number => {
          callCount += 1;
          return a + b;
        };
        const memoized = $({
          fn,
          keyFn: (a: number, b: number,) => `${String(a,)}:${String(b,)}`,
        },);

        expect(memoized({ args: [1, 2,], salt: 'v1', },),).toBe(3,);
        expect(memoized({ args: [1, 2,], salt: 'v1', },),).toBe(3,);
        expect(memoized({ args: [2, 1,], salt: 'v1', },),).toBe(3,);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: '.size reflects cache size',
      fn: async () => {
        const fn = (x: number,): number => x;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        expect(memoized.size,).toBe(0,);
        memoized({ args: [1,], salt: 'v1', },);
        expect(memoized.size,).toBe(1,);
        memoized({ args: [2,], salt: 'v1', },);
        expect(memoized.size,).toBe(2,);
        memoized({ args: [1,], salt: 'v1', },);
        expect(memoized.size,).toBe(2,);
      },
    },),
    it({
      name: '.clear() empties the cache',
      fn: async () => {
        const fn = (x: number,): number => x;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        memoized({ args: [1,], salt: 'v1', },);
        memoized({ args: [2,], salt: 'v1', },);
        expect(memoized.size,).toBe(2,);
        memoized.clear();
        expect(memoized.size,).toBe(0,);
      },
    },),
    it({
      name: '.delete() removes a specific entry',
      fn: async () => {
        const fn = (x: number,): number => x;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        memoized({ args: [1,], salt: 'v1', },);
        memoized({ args: [2,], salt: 'v1', },);
        expect(memoized.size,).toBe(2,);
        memoized.delete('1:v1',);
        expect(memoized.size,).toBe(1,);
      },
    },),
    it({
      name: '.store provides access to the underlying SyncStore',
      fn: async () => {
        const fn = (x: number,): number => x * 3;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        memoized({ args: [7,], salt: 's', },);
        expect(memoized.store.get<number>('7:s',),).toBe(21,);
      },
    },),
    it({
      name: 'LRU eviction removes oldest entry at capacity',
      fn: async () => {
        let callCount = 0;
        const fn = (x: number,): number => {
          callCount += 1;
          return x;
        };
        const store = createSyncStore({
          storeId: 'lru-test',
          eviction: [{ policy: 'lru', maxSize: 3, },],
        },);
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), store, },);

        memoized({ args: [1,], salt: 'v1', },);
        memoized({ args: [2,], salt: 'v1', },);
        memoized({ args: [3,], salt: 'v1', },);
        expect(memoized.size,).toBe(3,);

        memoized({ args: [4,], salt: 'v1', },);
        expect(memoized.size,).toBe(3,);
        expect(memoized.store.get('1:v1',),).toBeUndefined();
        expect(memoized.store.get('4:v1',),).toBeDefined();
      },
    },),
    it({
      name: 'LRU access refreshes entry position',
      fn: async () => {
        const fn = (x: number,): number => x;
        const store = createSyncStore({
          storeId: 'lru-refresh-test',
          eviction: [{ policy: 'lru', maxSize: 3, },],
        },);
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), store, },);

        memoized({ args: [1,], salt: 'v1', },);
        memoized({ args: [2,], salt: 'v1', },);
        memoized({ args: [3,], salt: 'v1', },);

        // Access 1 to refresh it
        memoized({ args: [1,], salt: 'v1', },);

        // Now add 4; should evict 2 (oldest after refresh), not 1
        memoized({ args: [4,], salt: 'v1', },);
        expect(memoized.store.get('1:v1',),).toBeDefined();
        expect(memoized.store.get('2:v1',),).toBeUndefined();
      },
    },),
    it({
      name: 'same args with different salt are cached independently',
      fn: async () => {
        let callCount = 0;
        const fn = (x: number,): number => {
          callCount += 1;
          return x;
        };
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), },);

        memoized({ args: [1,], salt: 'a', },);
        memoized({ args: [1,], salt: 'a', },);
        memoized({ args: [1,], salt: 'b', },);
        memoized({ args: [1,], salt: 'b', },);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: 'custom store is used when provided',
      fn: async () => {
        const customStore = createSyncStore({ storeId: 'custom', },);
        const fn = (x: number,): number => x * 2;
        const memoized = $({ fn, keyFn: (x: number,) => String(x,), store: customStore, },);

        memoized({ args: [5,], salt: 'v1', },);
        expect(customStore.get<number>('5:v1',),).toBe(10,);
        expect(memoized.store,).toBe(customStore,);
      },
    },),
  ],
},);
