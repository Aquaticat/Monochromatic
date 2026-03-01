import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.object.store.from.store.async.named.$;

describe($, () => {
  test('creates a store with default configuration', async () => {
    const store = await $();
    expect(store.storeId,).toBeDefined();
    expect(store.backends.length,).toBe(1,);
    expect(store.lossyForCircular,).toBe(true,);
  });

  test('creates a store with custom storeId', async () => {
    const store = await $({ storeId: 'test-store', },);
    expect(store.storeId,).toBe('test-store',);
  });

  test('set and get round-trips a value', async () => {
    const store = await $({ storeId: 'roundtrip', },);
    await store.set('key1', { value: 42, },);
    const result = await store.get<{ value: number; }>('key1',);
    expect(result,).toEqual({ value: 42, },);
  });

  test('get returns undefined for missing keys', async () => {
    const store = await $({ storeId: 'missing', },);
    const result = await store.get('nonexistent',);
    expect(result,).toBeUndefined();
  });

  test('delete removes an entry', async () => {
    const store = await $({ storeId: 'delete-test', },);
    await store.set('to-delete', 'value',);
    expect(await store.get('to-delete',),).toBe('value',);
    await store.delete('to-delete',);
    expect(await store.get('to-delete',),).toBeUndefined();
  });

  test('clear removes all entries', async () => {
    const store = await $({ storeId: 'clear-test', },);
    await store.set('a', 1,);
    await store.set('b', 2,);
    await store.clear();
    expect(await store.get('a',),).toBeUndefined();
    expect(await store.get('b',),).toBeUndefined();
  });

  test('set returns the store for chaining', async () => {
    const store = await $({ storeId: 'chain', },);
    const returned = await store.set('k', 'v',);
    expect(returned,).toBe(store,);
  });

  test('handles multiple backends with consensus', async () => {
    const backend1 = new Map<string, string>();
    const backend2 = new Map<string, string>();
    const store = await $({
      storeId: 'consensus',
      backends: [backend1, backend2,],
    },);

    await store.set('shared', 'hello',);
    expect(backend1.has('shared',),).toBe(true,);
    expect(backend2.has('shared',),).toBe(true,);

    const result = await store.get<string>('shared',);
    expect(result,).toBe('hello',);
  });

  test('heals divergent backends to majority value', async () => {
    const backend1 = new Map<string, string>();
    const backend2 = new Map<string, string>();
    const backend3 = new Map<string, string>();
    const store = await $({
      storeId: 'heal',
      backends: [backend1, backend2, backend3,],
    },);

    await store.set('key', 'correct',);

    // Corrupt one backend
    const correctSerialized = backend1.get('key',) as string;
    backend2.set('key', '"corrupted"',);

    const result = await store.get<string>('key',);
    expect(result,).toBe('correct',);

    // backend2 should be healed
    expect(backend2.get('key',),).toBe(correctSerialized,);
  });

  test('throws TypeError for cyclic value when lossyForCircular is false', async () => {
    const store = await $({ storeId: 'cyclic', lossyForCircular: false, },);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(store.set('cyc', circular,),).rejects.toThrow(TypeError,);
  });

  test('stores decycled value when lossyForCircular is true', async () => {
    const store = await $({ storeId: 'cyclic-lossy', lossyForCircular: true, },);
    const circular: Record<string, unknown> = { data: 'test', };
    circular.self = circular;

    await store.set('cyc', circular,);
    const result = await store.get<Record<string, unknown>>('cyc',);
    expect(result,).toBeDefined();
    expect(result?.data,).toBe('test',);
  });

  test('handles primitive values', async () => {
    const store = await $({ storeId: 'primitives', },);
    await store.set('str', 'hello',);
    await store.set('num', 42,);
    await store.set('bool', true,);
    await store.set('null', null,);

    expect(await store.get<string>('str',),).toBe('hello',);
    expect(await store.get<number>('num',),).toBe(42,);
    expect(await store.get<boolean>('bool',),).toBe(true,);
    expect(await store.get<null>('null',),).toBeNull();
  });

  test('handles arrays and nested objects', async () => {
    const store = await $({ storeId: 'complex', },);
    const complex = { arr: [1, 2, 3,], nested: { deep: true, }, };
    await store.set('complex', complex,);
    expect(await store.get('complex',),).toEqual(complex,);
  });
});
