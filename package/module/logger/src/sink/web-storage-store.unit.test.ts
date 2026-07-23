import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { createLocalStorageStore, } from './local-storage-store.ts';
import { createSessionStorageStore, } from './session-storage-store.ts';

type StorageGlobalName = 'localStorage' | 'sessionStorage';

type ControlledStorage = Storage & {
  readonly state: {
    alwaysFail: boolean;
    failuresRemaining: number;
    setCalls: number;
  };
  readonly values: () => readonly string[];
};

function createControlledStorage(): ControlledStorage {
  const entries = new Map<string, string>();
  const state = {
    alwaysFail: false,
    failuresRemaining: 0,
    setCalls: 0,
  };
  return Object.freeze({
    state,
    get length(): number {
      return entries.size;
    },
    clear(): void {
      entries.clear();
    },
    // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Storage.getItem requires exact external Web Storage return type.
    getItem(key: string,): string | null {
      return entries.get(key,)
        ?? null;
    },
    // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Storage.key requires exact external Web Storage return type.
    key(index: number,): string | null {
      return [...entries.keys()][index]
        ?? null;
    },
    removeItem(key: string,): void {
      entries.delete(key,);
    },
    setItem(key: string, value: string,): void {
      state.setCalls++;
      const shouldFail = state.alwaysFail || (state.failuresRemaining > 0);
      if (state.failuresRemaining > 0)
        state.failuresRemaining--;
      if (shouldFail) {
        throw new DOMException(
          'fake storage quota reached',
          'QuotaExceededError',
        );
      }
      entries.set(
        key,
        value,
      );
    },
    values(): readonly string[] {
      return [...entries.values()];
    },
  } satisfies ControlledStorage);
}

function installStorage({
  name,
  storage,
}: {
  readonly name: StorageGlobalName;
  readonly storage: Storage;
}): Disposable {
  const priorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    name,
  );
  Object.defineProperty(
    globalThis,
    name,
    {
      configurable: true,
      value: storage,
    },
  );
  return {
    [Symbol.dispose]() {
      if (priorDescriptor === undefined)
        Reflect.deleteProperty(globalThis, name,);
      else
        Object.defineProperty(
          globalThis,
          name,
          priorDescriptor,
        );
    },
  };
}

await describe({
  name: 'web storage persistence retries',
  concurrency: 1,
  children: [
    it({
      name: 'localStorage evicts one owned entry and retries a quota failure',
      fn: async () => {
        const storage = createControlledStorage();
        using _installed = installStorage({
          name: 'localStorage',
          storage,
        },);
        const store = createLocalStorageStore();
        store.persist('first',);
        const callsBeforeRetry = storage.state.setCalls;
        storage.state.failuresRemaining = 1;
        store.persist('second',);
        expect(storage.state.setCalls - callsBeforeRetry,).toBe(2,);
        expect(storage.values(),).toEqual(['second',],);
      },
    },),
    it({
      name: 'sessionStorage evicts one owned entry and retries a quota failure',
      fn: async () => {
        const storage = createControlledStorage();
        using _installed = installStorage({
          name: 'sessionStorage',
          storage,
        },);
        const store = createSessionStorageStore();
        store.persist('first',);
        const callsBeforeRetry = storage.state.setCalls;
        storage.state.failuresRemaining = 1;
        store.persist('second',);
        expect(storage.state.setCalls - callsBeforeRetry,).toBe(2,);
        expect(storage.values(),).toEqual(['second',],);
      },
    },),
    it({
      name: 'sessionStorage gives up after its final post-eviction attempt',
      fn: async () => {
        const storage = createControlledStorage();
        using _installed = installStorage({
          name: 'sessionStorage',
          storage,
        },);
        const store = createSessionStorageStore();
        store.persist('first',);
        const callsBeforeFailure = storage.state.setCalls;
        storage.state.alwaysFail = true;
        store.persist('second',);
        expect(storage.state.setCalls - callsBeforeFailure,).toBe(2,);
        expect(storage.values(),).toEqual([],);
      },
    },),
  ],
},);
