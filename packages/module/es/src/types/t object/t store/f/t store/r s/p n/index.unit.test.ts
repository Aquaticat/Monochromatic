import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

const $ = types.object.store.from.store.sync.named.$;

describe($, () => {
  test('creates a store with default configuration', () => {
    const store = $();
    expect(store.storeId,).toBeDefined();
    expect(store.backends.length,).toBe(1,);
    expect(store.lossyForCircular,).toBe(true,);
  });

  test('creates a store with custom storeId', () => {
    const store = $({ storeId: 'test-sync-store', },);
    expect(store.storeId,).toBe('test-sync-store',);
  });

  test('set and get round-trips a value', () => {
    const store = $({ storeId: 'roundtrip', },);
    store.set('key1', { value: 42, },);
    const result = store.get<{ value: number; }>('key1',);
    expect(result,).toEqual({ value: 42, },);
  });

  test('get returns undefined for missing keys', () => {
    const store = $({ storeId: 'missing', },);
    const result = store.get('nonexistent',);
    expect(result,).toBeUndefined();
  });

  test('delete removes an entry', () => {
    const store = $({ storeId: 'delete-test', },);
    store.set('to-delete', 'value',);
    expect(store.get('to-delete',),).toBe('value',);
    store.delete('to-delete',);
    expect(store.get('to-delete',),).toBeUndefined();
  });

  test('clear removes all entries', () => {
    const store = $({ storeId: 'clear-test', },);
    store.set('a', 1,);
    store.set('b', 2,);
    store.clear();
    expect(store.get('a',),).toBeUndefined();
    expect(store.get('b',),).toBeUndefined();
  });

  test('set returns the store for chaining', () => {
    const store = $({ storeId: 'chain', },);
    const returned = store.set('k', 'v',);
    expect(returned,).toBe(store,);
  });

  test('size reflects number of entries', () => {
    const store = $({ storeId: 'size-test', },);
    expect(store.size,).toBe(0,);
    store.set('a', 1,);
    expect(store.size,).toBe(1,);
    store.set('b', 2,);
    expect(store.size,).toBe(2,);
    store.delete('a',);
    expect(store.size,).toBe(1,);
    store.clear();
    expect(store.size,).toBe(0,);
  });

  test('handles multiple backends with consensus', () => {
    const backend1 = new Map<string, string>();
    const backend2 = new Map<string, string>();
    const store = $({
      storeId: 'consensus',
      backends: [backend1, backend2,],
    },);

    store.set('shared', 'hello',);
    expect(backend1.has('shared',),).toBe(true,);
    expect(backend2.has('shared',),).toBe(true,);

    const result = store.get<string>('shared',);
    expect(result,).toBe('hello',);
  });

  test('heals divergent backends to majority value', () => {
    const backend1 = new Map<string, string>();
    const backend2 = new Map<string, string>();
    const backend3 = new Map<string, string>();
    const store = $({
      storeId: 'heal',
      backends: [backend1, backend2, backend3,],
    },);

    store.set('key', 'correct',);

    // Corrupt one backend
    const correctSerialized = backend1.get('key',) as string;
    backend2.set('key', '"corrupted"',);

    const result = store.get<string>('key',);
    expect(result,).toBe('correct',);

    // backend2 should be healed
    expect(backend2.get('key',),).toBe(correctSerialized,);
  });

  test('throws TypeError for cyclic value when lossyForCircular is false', () => {
    const store = $({ storeId: 'cyclic', lossyForCircular: false, },);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => store.set('cyc', circular,),).toThrow(TypeError,);
  });

  test('stores decycled value when lossyForCircular is true', () => {
    const store = $({ storeId: 'cyclic-lossy', lossyForCircular: true, },);
    const circular: Record<string, unknown> = { data: 'test', };
    circular.self = circular;

    store.set('cyc', circular,);
    const result = store.get<Record<string, unknown>>('cyc',);
    expect(result,).toBeDefined();
    expect(result?.data,).toBe('test',);
  });

  test('handles primitive values', () => {
    const store = $({ storeId: 'primitives', },);
    store.set('str', 'hello',);
    store.set('num', 42,);
    store.set('bool', true,);
    store.set('null', null,);

    expect(store.get<string>('str',),).toBe('hello',);
    expect(store.get<number>('num',),).toBe(42,);
    expect(store.get<boolean>('bool',),).toBe(true,);
    expect(store.get<null>('null',),).toBeNull();
  });

  test('handles arrays and nested objects', () => {
    const store = $({ storeId: 'complex', },);
    const complex = { arr: [1, 2, 3,], nested: { deep: true, }, };
    store.set('complex', complex,);
    expect(store.get('complex',),).toEqual(complex,);
  });

  test('LRU eviction removes oldest entry at capacity', () => {
    const store = $({
      storeId: 'lru-evict',
      eviction: [{ policy: 'lru', maxSize: 3, },],
    },);

    store.set('a', 1,);
    store.set('b', 2,);
    store.set('c', 3,);
    expect(store.size,).toBe(3,);

    store.set('d', 4,);
    expect(store.size,).toBe(3,);
    expect(store.get('a',),).toBeUndefined();
    expect(store.get('d',),).toBeDefined();
  });

  test('LRU access refreshes entry position', () => {
    const store = $({
      storeId: 'lru-refresh',
      eviction: [{ policy: 'lru', maxSize: 3, },],
    },);

    store.set('a', 1,);
    store.set('b', 2,);
    store.set('c', 3,);

    // Access 'a' to refresh it
    store.get('a',);

    // Adding 'd' should evict 'b' (oldest after refresh), not 'a'
    store.set('d', 4,);
    expect(store.get('a',),).toBeDefined();
    expect(store.get('b',),).toBeUndefined();
  });

  test('LRU delete removes key from eviction tracking', () => {
    const store = $({
      storeId: 'lru-delete',
      eviction: [{ policy: 'lru', maxSize: 3, },],
    },);

    store.set('a', 1,);
    store.set('b', 2,);
    store.set('c', 3,);
    store.delete('b',);

    // After deleting 'b', LRU tracks [a, c] (2 keys).
    // Adding 'd' fills to capacity (3), no eviction.
    store.set('d', 4,);
    expect(store.get('a',),).toBeDefined();
    expect(store.get('c',),).toBeDefined();
    expect(store.get('d',),).toBeDefined();
  });

  test('LRU clear resets eviction tracking', () => {
    const store = $({
      storeId: 'lru-clear',
      eviction: [{ policy: 'lru', maxSize: 2, },],
    },);

    store.set('a', 1,);
    store.set('b', 2,);
    store.clear();

    // After clear, can add entries without eviction
    store.set('c', 3,);
    store.set('d', 4,);
    expect(store.size,).toBe(2,);
  });

  test('no eviction by default', () => {
    const store = $({ storeId: 'no-eviction', },);

    store.set('a', 1,);
    store.set('b', 2,);
    store.set('c', 3,);
    store.set('d', 4,);
    store.set('e', 5,);
    expect(store.size,).toBe(5,);
  });

  test('all operations are synchronous', () => {
    const store = $({ storeId: 'sync-check', },);
    const setResult = store.set('k', 'v',);
    // set returns the store itself (not a Promise)
    expect(setResult,).toBe(store,);

    const getResult = store.get('k',);
    // get returns the value directly (not a Promise)
    expect(getResult,).toBe('v',);

    // delete and clear return void (not Promises)
    store.delete('k',);
    store.clear();
  });
});
