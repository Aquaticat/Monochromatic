import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { createLocalStorageStore, } from './local-storage-store.ts';
import { createSessionStorageStore, } from './session-storage-store.ts';

type StorageGlobalName = 'localStorage' | 'sessionStorage';

class ControlledStorage implements Storage {
  readonly #entries = new Map<string, string>();

  readonly state = {
    alwaysFail: false,
    failuresRemaining: 0,
    setCalls: 0,
  };

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string,): string | null {
    return this.#entries.get(key,)
      ?? null;
  }

  key(index: number,): string | null {
    return [...this.#entries.keys()][index]
      ?? null;
  }

  removeItem(key: string,): void {
    this.#entries.delete(key,);
  }

  setItem(key: string, value: string,): void {
    this.state.setCalls++;
    if (this.state.alwaysFail || (this.state.failuresRemaining > 0)) {
      this.state.failuresRemaining--;
      throw new DOMException(
        'fake storage quota reached',
        'QuotaExceededError',
      );
    }
    this.#entries.set(
      key,
      value,
    );
  }

  values(): readonly string[] {
    return [...this.#entries.values()];
  }
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
        const storage = new ControlledStorage();
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
        const storage = new ControlledStorage();
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
        const storage = new ControlledStorage();
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
