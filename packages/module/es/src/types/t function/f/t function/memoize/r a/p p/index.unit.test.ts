// oxlint-disable unicorn/prefer-native-coercion-functions -- keyFn wrappers intentionally narrow parameter types
// oxlint-disable typescript/require-await, typescript/no-misused-promises -- async test callbacks and arrow functions

import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const { $, } = types.function.from.function.memoize.async.positional;
const createStore = types.object.store.from.store.async.named.$;

describe($, () => {
  test('returns computed value on first call', async () => {
    const fn = async (x: number,): Promise<number> => x * 2;
    const memoized = await $(fn, (x: number,) => String(x,),);

    expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
  });

  test('returns cached value on subsequent calls', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x * 2;
    };
    const memoized = await $(fn, (x: number,) => String(x,),);

    expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
    expect(await memoized({ args: [5,], salt: 'v1', },),).toBe(10,);
    expect(callCount,).toBe(1,);
  });

  test('deduplicates concurrent in-flight calls', async () => {
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
  });

  test('evicts cache entry on rejection and retries', async () => {
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
  });

  test('different salt recomputes for same args', async () => {
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
  });

  test('.clear() empties the cache', async () => {
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
  });

  test('.delete() removes a specific entry', async () => {
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
  });

  test('.store provides access to the underlying Store', async () => {
    const fn = async (x: number,): Promise<number> => x;
    const memoized = await $(fn, (x: number,) => String(x,),);

    expect(memoized.store,).toBeDefined();
    expect(memoized.store.storeId,).toBeDefined();
  });

  test('different args produce separate cache entries', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x * 2;
    };
    const memoized = await $(fn, (x: number,) => String(x,),);

    expect(await memoized({ args: [1,], salt: 'v1', },),).toBe(2,);
    expect(await memoized({ args: [2,], salt: 'v1', },),).toBe(4,);
    expect(callCount,).toBe(2,);
  });

  test('LRU eviction at capacity', async () => {
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
  });
},);
