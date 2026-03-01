import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.function.from.function.memoize.async.positional.$;

describe($, () => {
  test('returns computed value on first call', async () => {
    const fn = async (x: number,): Promise<number> => x * 2;
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    expect(await memoized(5,),).toBe(10,);
  });

  test('returns cached value on subsequent calls', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x * 2;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    expect(await memoized(5,),).toBe(10,);
    expect(await memoized(5,),).toBe(10,);
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
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    const [result1, result2,] = await Promise.all([memoized(5,), memoized(5,),],);
    expect(result1,).toBe(10,);
    expect(result2,).toBe(10,);
    expect(callCount,).toBe(1,);
  });

  test('evicts cache entry on rejection and retries', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('first call fails',);
      }
      return x * 2;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    await expect(memoized(5,),).rejects.toThrow('first call fails',);

    const result = await memoized(5,);
    expect(result,).toBe(10,);
    expect(callCount,).toBe(2,);
  });

  test('salt can be a Promise', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x;
    };
    const memoized = await $(fn, (x: number,) => String(x), Promise.resolve('async-salt',),);

    expect(await memoized(1,),).toBe(1,);
    expect(await memoized(1,),).toBe(1,);
    expect(callCount,).toBe(1,);
  });

  test('.clear() empties the cache', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    await memoized(1,);
    await memoized.clear();

    await memoized(1,);
    expect(callCount,).toBe(2,);
  });

  test('.delete() removes a specific entry', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    await memoized(1,);
    await memoized.delete('1:v1',);

    await memoized(1,);
    expect(callCount,).toBe(2,);
  });

  test('.store provides access to the underlying Store', async () => {
    const fn = async (x: number,): Promise<number> => x;
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    expect(memoized.store,).toBeDefined();
    expect(memoized.store.storeId,).toBeDefined();
  });

  test('different args produce separate cache entries', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x * 2;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1',);

    expect(await memoized(1,),).toBe(2,);
    expect(await memoized(2,),).toBe(4,);
    expect(callCount,).toBe(2,);
  });

  test('LRU eviction at capacity', async () => {
    let callCount = 0;
    const fn = async (x: number,): Promise<number> => {
      callCount += 1;
      return x;
    };
    const memoized = await $(fn, (x: number,) => String(x), 'v1', 2,);

    await memoized(1,);
    await memoized(2,);
    await memoized(3,);

    callCount = 0;
    await memoized(1,);
    expect(callCount,).toBe(1,);
  });
});
