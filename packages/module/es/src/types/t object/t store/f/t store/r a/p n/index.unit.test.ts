import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const { $, } = types.object.store.from.store.async.named;

await describe({
  name: $.name,
  children: [
    it({
      name: 'creates a store with default configuration',
      fn: async () => {
        const store = await $();
        expect(store.storeId,).toBeDefined();
        expect(store.backends.length,).toBe(1,);
        expect(store.lossyForCircular,).toBe(true,);
      },
    },),

    it({
      name: 'creates a store with custom storeId',
      fn: async () => {
        const store = await $({ storeId: 'test-store', },);
        expect(store.storeId,).toBe('test-store',);
      },
    },),

    it({
      name: 'set and get round-trips a value',
      fn: async () => {
        const store = await $({ storeId: 'roundtrip', },);
        await store.set('key1', { value: 42, },);
        const result = await store.get<{ value: number; }>('key1',);
        expect(result,).toEqual({ value: 42, },);
      },
    },),

    it({
      name: 'get returns undefined for missing keys',
      fn: async () => {
        const store = await $({ storeId: 'missing', },);
        const result = await store.get('nonexistent',);
        expect(result,).toBeUndefined();
      },
    },),

    it({
      name: 'delete removes an entry',
      fn: async () => {
        const store = await $({ storeId: 'delete-test', },);
        await store.set('to-delete', 'value',);
        expect(await store.get<string>('to-delete',),).toBe('value',);
        await store.delete('to-delete',);
        expect(await store.get('to-delete',),).toBeUndefined();
      },
    },),

    it({
      name: 'clear removes all entries',
      fn: async () => {
        const store = await $({ storeId: 'clear-test', },);
        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.clear();
        expect(await store.get('a',),).toBeUndefined();
        expect(await store.get('b',),).toBeUndefined();
      },
    },),

    it({
      name: 'set returns the store for chaining',
      fn: async () => {
        const store = await $({ storeId: 'chain', },);
        const returned = await store.set('k', 'v',);
        expect(returned,).toBe(store,);
      },
    },),

    it({
      name: 'handles multiple backends with consensus',
      fn: async () => {
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
      },
    },),

    it({
      name: 'heals divergent backends to majority value',
      fn: async () => {
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
      },
    },),

    it({
      name: 'throws TypeError for cyclic value when lossyForCircular is false',
      fn: async () => {
        const store = await $({ storeId: 'cyclic', lossyForCircular: false, },);
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        await expect(store.set('cyc', circular,),).rejects.toThrow(TypeError,);
      },
    },),

    it({
      name: 'stores decycled value when lossyForCircular is true',
      fn: async () => {
        const store = await $({ storeId: 'cyclic-lossy', lossyForCircular: true, },);
        const circular: Record<string, unknown> = { data: 'test', };
        circular.self = circular;

        await store.set('cyc', circular,);
        const result = await store.get<Record<string, unknown>>('cyc',);
        expect(result,).toBeDefined();
        expect(result?.data,).toBe('test',);
      },
    },),

    it({
      name: 'handles primitive values',
      fn: async () => {
        const store = await $({ storeId: 'primitives', },);
        await store.set('str', 'hello',);
        await store.set('num', 42,);
        await store.set('bool', true,);
        await store.set('null', null,);

        expect(await store.get<string>('str',),).toBe('hello',);
        expect(await store.get<number>('num',),).toBe(42,);
        expect(await store.get<boolean>('bool',),).toBe(true,);
        expect(await store.get<null>('null',),).toBeNull();
      },
    },),

    it({
      name: 'handles arrays and nested objects',
      fn: async () => {
        const store = await $({ storeId: 'complex', },);
        const complex = { arr: [1, 2, 3,], nested: { deep: true, }, };
        await store.set('complex', complex,);
        expect(await store.get<typeof complex>('complex',),).toEqual(complex,);
      },
    },),

    it({
      name: 'LRU eviction removes oldest entry at capacity',
      fn: async () => {
        const store = await $({
          storeId: 'lru-evict',
          eviction: [{ policy: 'lru', maxSize: 3, },],
        },);

        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.set('c', 3,);
        await store.set('d', 4,);

        expect(await store.get('a',),).toBeUndefined();
        expect(await store.get('d',),).toBeDefined();
      },
    },),

    it({
      name: 'LRU access refreshes entry position',
      fn: async () => {
        const store = await $({
          storeId: 'lru-refresh',
          eviction: [{ policy: 'lru', maxSize: 3, },],
        },);

        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.set('c', 3,);

        // Access 'a' to refresh it
        await store.get('a',);

        // Adding 'd' should evict 'b' (oldest after refresh), not 'a'
        await store.set('d', 4,);
        expect(await store.get('a',),).toBeDefined();
        expect(await store.get('b',),).toBeUndefined();
      },
    },),

    it({
      name: 'LRU delete removes key from eviction tracking',
      fn: async () => {
        const store = await $({
          storeId: 'lru-delete',
          eviction: [{ policy: 'lru', maxSize: 3, },],
        },);

        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.set('c', 3,);
        await store.delete('b',);

        // After deleting 'b', LRU tracks [a, c] (2 keys).
        // Adding 'd' fills to capacity (3), no eviction.
        await store.set('d', 4,);
        expect(await store.get('a',),).toBeDefined();
        expect(await store.get('c',),).toBeDefined();
        expect(await store.get('d',),).toBeDefined();
      },
    },),

    it({
      name: 'LRU clear resets eviction tracking',
      fn: async () => {
        const store = await $({
          storeId: 'lru-clear',
          eviction: [{ policy: 'lru', maxSize: 2, },],
        },);

        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.clear();

        // After clear, can add entries without eviction
        await store.set('c', 3,);
        await store.set('d', 4,);
        // No eviction expected since tracking was cleared
        expect(await store.get('c',),).toBeDefined();
        expect(await store.get('d',),).toBeDefined();
      },
    },),

    it({
      name: 'no eviction by default',
      fn: async () => {
        const store = await $({ storeId: 'no-eviction', },);

        await store.set('a', 1,);
        await store.set('b', 2,);
        await store.set('c', 3,);
        await store.set('d', 4,);
        await store.set('e', 5,);
        expect(await store.get('a',),).toBeDefined();
        expect(await store.get('e',),).toBeDefined();
      },
    },),
  ],
},);
