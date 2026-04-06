// oxlint-disable unicorn/prefer-native-coercion-functions -- keyFn wrappers intentionally narrow parameter types
// oxlint-disable typescript/require-await -- async test callbacks and arrow functions

import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const { $, } = types.function.from.function.memoize.async.positional;
const createStore = types.object.store.from.store.async.named.$;

await describe({
  name: $.name,
  children: [
    it({
      name: 'returns computed value on first call',
      fn: async () => {
        const fn = async (x: number,): Promise<number> => x * 2;
        const memoized = await $(fn, (x: number,) => String(x,),);

        expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
      },
    },),
    it({
      name: 'returns cached value on subsequent calls',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x * 2;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
        expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
        expect(callCount,).toBe(1,);
      },
    },),
    it({
      name: 'deduplicates concurrent in-flight calls',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          await new Promise(function delayResolve(resolve,) {
            setTimeout(resolve, 50,);
          },);
          return x * 2;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        const [result1, result2,] = await Promise.all([
          memoized({ args: [5,], salt: 'v1', },),
          memoized({ args: [5,], salt: 'v1', },),
        ],);
        expect(result1,).toBe(10,);
        expect(result2,).toBe(10,);
        expect(callCount,).toBe(1,);
      },
    },),
    it({
      name: 'evicts cache entry on rejection and retries',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          if (callCount === 1)
            throw new Error('first call fails',);
          return x * 2;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        await expect(memoized({ args: [5,], salt: 'v1', },),).rejects.toThrow(
          'first call fails',
        );

        const result = await memoized({ args: [5,], salt: 'v1', },);
        expect(result,).toBe(10,);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: 'different salt recomputes for same args',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        expect(await memoized({ args: [1,], salt: 'a', },),).toBe(1,);
        expect(await memoized({ args: [1,], salt: 'a', },),).toBe(1,);
        expect(await memoized({ args: [1,], salt: 'b', },),).toBe(1,);
        expect(await memoized({ args: [1,], salt: 'b', },),).toBe(1,);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: '.clear() empties the cache',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        await memoized({ args: [1,], salt: 'v1', },);
        await memoized.clear();

        await memoized({ args: [1,], salt: 'v1', },);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: '.delete() removes a specific entry',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        await memoized({ args: [1,], salt: 'v1', },);
        await memoized.delete('1:v1',);

        await memoized({ args: [1,], salt: 'v1', },);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: '.store provides access to the underlying Store',
      fn: async () => {
        const fn = async (x: number,): Promise<number> => x;
        const memoized = await $(fn, (x: number,) => String(x,),);

        expect(memoized.store,).toBeDefined();
        expect(memoized.store.storeId,).toBeDefined();
      },
    },),
    it({
      name: 'different args produce separate cache entries',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x * 2;
        };
        const memoized = await $(fn, (x: number,) => String(x,),);

        expect(await memoized({ args: [1,], salt: 'v1', },),).toBe(2,);
        expect(await memoized({ args: [2,], salt: 'v1', },),).toBe(4,);
        expect(callCount,).toBe(2,);
      },
    },),
    it({
      name: 'LRU eviction at capacity',
      fn: async () => {
        let callCount = 0;
        const fn = async (x: number,): Promise<number> => {
          callCount += 1;
          return x;
        };
        const store = await createStore({
          storeId: 'lru-async-test',
          eviction: [{ policy: 'lru', maxSize: 2, },],
        },);
        const memoized = await $(fn, (x: number,) => String(x,), store,);

        await memoized({ args: [1,], salt: 'v1', },);
        await memoized({ args: [2,], salt: 'v1', },);
        await memoized({ args: [3,], salt: 'v1', },);

        callCount = 0;
        await memoized({ args: [1,], salt: 'v1', },);
        expect(callCount,).toBe(1,);
      },
    },),
  ],
},);
