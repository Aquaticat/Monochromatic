/**
 Store mutation and read behavior of `createCrud` over a stub context,
 plus end-to-end coverage through `createConf` from the built artifact.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createConf,
  createCrud,
  InvalidKeyError,
  MissingValueError,
  NonArrayValueError,
  prepareOptions,
  ReservedKeyError,
  UnsupportedValueTypeError,
} from '../dist/final/neutral/index.mjs';

import type {
  CrudApi,
  CrudContext,
  StoreFile,
} from '../dist/final/neutral/index.mjs';

import { createTempDirectory, } from './test-support.ts';

/**
 Runs a call expected to throw and returns the caught error,
 so one invocation can carry several assertions.
 
 @param call - Call expected to throw.
 
 @returns The caught error value.
 
 @example
 ```ts
 const error = captureThrown(function boom(): void { throw new Error('x'); });
 ```
 */
function captureThrown(call: () => unknown,): unknown {
  try {
    call();
  }
  catch (error) {
    return error;
  }
  throw new Error('Expected the call to throw, but it returned.',);
}

/**
 Extracts a printable message from a caught value,
 so message assertions read from one helper.
 
 @param error - Caught value from a call under test.
 
 @returns The error's message,
 or the value's text form when it carries none.
 
 @example
 ```ts
 caughtMessage(new Error('boom')); // => 'boom'
 ```
 */
function caughtMessage(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 One stub CRUD fixture: methods under test,
 recorded writes,
 and mutable store state.
 
 @example
 ```ts
 const fixture = createCrudStub({ store: { theme: 'light', }, });
 fixture.crud.set({ key: 'theme', value: 'dark', });
 ```
 */
type CrudStub = {
  /**
   CRUD methods under test.
   */
  readonly crud: CrudApi;
  /**
   Stores passed to `assignStore`,
   in call order.
   */
  readonly assignedStores: Record<string, unknown>[];
  /**
   Mutable store state the stub file pipeline reads.
   */
  readonly state: {
    store: Record<string, unknown>;
  };
};

/**
 Builds one stub CRUD context whose file pipeline reads mutable state,
 so each case controls the store and dot-notation mode.
 
 @param store - Initial store contents the stub reads.
 
 @param defaultValues - Defaults backing `reset` and `clear`.
 
 @param accessPropertiesByDotNotation - Whether dots address nested
 properties.
 
 @returns Stub fixture with recorded writes.
 
 @example
 ```ts
 const fixture = createCrudStub({ store: {}, accessPropertiesByDotNotation: false, });
 ```
 */
function createCrudStub({
  store,
  defaultValues = {},
  accessPropertiesByDotNotation = true,
}: {
  readonly store: Record<string, unknown>;
  readonly defaultValues?: Readonly<Record<string, unknown>>;
  readonly accessPropertiesByDotNotation?: boolean;
},): CrudStub {
  /**
   Mutable store state the stub pipeline reads like a fresh disk read.
   */
  const state = {
    store: structuredClone(store,),
  };
  /**
   Stores passed to `assignStore`,
   in call order.
   */
  const assignedStores: Record<string, unknown>[] = [];
  /**
   Prepared options selecting the dot-notation mode under test.
   */
  const options = prepareOptions<Record<string, unknown>>({
    cwd: createTempDirectory(),
    accessPropertiesByDotNotation,
  },);
  /**
   Stub file pipeline whose reads always return a fresh store copy.
   */
  const storeFile: StoreFile = {
    path: '/stub/config.json',
    fileExists: function fileExists(): boolean {
      return true;
    },
    ensureDirectory: function ensureDirectory(): void {},
    readParsedFile: function readParsedFile(): Record<string, unknown> {
      return structuredClone(state.store,);
    },
    readStore: function readStore(): Record<string, unknown> {
      return structuredClone(state.store,);
    },
    writeStore: function writeStore(): void {},
  };
  /**
   CRUD context under test over the stub pipeline.
   */
  const context: CrudContext<Record<string, unknown>> = {
    options,
    defaultValues,
    storeFile,
    getStore: function getStore(): Record<string, unknown> {
      return structuredClone(state.store,);
    },
    assignStore: function assignStore(nextStore: Record<string, unknown>,): void {
      assignedStores.push(nextStore,);
      state.store = structuredClone(nextStore,);
    },
  };
  return {
    crud: createCrud(context,),
    assignedStores,
    state,
  };
}

await describe({
  name: createCrud.name,
  children: [
    it({
      name: 'set places one keyed value and assigns the merged store exactly once',
      fn: async () => {
        /**
         Stub fixture starting from two stored keys.
         */
        const fixture = createCrudStub({
          store: {
            theme: 'light',
            locale: 'en',
          },
        },);
        fixture.crud
          .set({
            key: 'theme',
            value: 'dark',
          },);
        expect(fixture.assignedStores,).toEqual([
          {
            theme: 'dark',
            locale: 'en',
          },
        ],);
      },
    },),

    it({
      name: 'set merges a multi-item values object and assigns the merged store exactly once',
      fn: async () => {
        /**
         Stub fixture starting from one stored key.
         */
        const fixture = createCrudStub({
          store: {
            theme: 'light',
          },
        },);
        fixture.crud
          .set({
            values: {
              locale: 'en',
              nested: {
                mode: 'dark',
              },
            },
          },);
        expect(fixture.assignedStores,).toEqual([
          {
            theme: 'light',
            locale: 'en',
            nested: {
              mode: 'dark',
            },
          },
        ],);
      },
    },),

    it({
      name: 'set throws MissingValueError when the single form omits its value',
      fn: async () => {
        /**
         Stub fixture under test.
         */
        const fixture = createCrudStub({
          store: {},
        },);
        /**
         Error thrown for a key without any value.
         */
        const omittedError = captureThrown(function setWithoutValue(): void {
          fixture.crud
            .set({
              key: 'theme',
            },);
        },);
        expect(omittedError,).toBeInstanceOf(MissingValueError,);
        expect(caughtMessage(omittedError,),).toBe('Use `delete()` to clear values',);
        /**
         Error thrown for an explicit `undefined` value.
         */
        const undefinedError = captureThrown(function setUndefinedValue(): void {
          fixture.crud
            .set({
              key: 'theme',
              value: undefined,
            },);
        },);
        expect(undefinedError,).toBeInstanceOf(MissingValueError,);
        expect(fixture.assignedStores,).toHaveLength(0,);
      },
    },),

    it({
      name: 'set throws ReservedKeyError when the key addresses the reserved bookkeeping subtree',
      fn: async () => {
        /**
         Stub fixture under test.
         */
        const fixture = createCrudStub({
          store: {},
        },);
        for (const key of [
          '__internal__',
          '__internal__.migrations.version',
        ]) {
          /**
           Error thrown for the reserved key path.
           */
          const error = captureThrown(function setReservedKey(): void {
            fixture.crud
              .set({
                key,
                value: 'x',
              },);
          },);
          expect(error,).toBeInstanceOf(ReservedKeyError,);
          expect(caughtMessage(error,),).toBe(
            'Please don\'t use the __internal__ key, as it\'s used to manage this module internal operations.',
          );
        }
        expect(fixture.assignedStores,).toHaveLength(0,);
      },
    },),

    it({
      name: 'set throws ReservedKeyError when nested values contain the reserved key',
      fn: async () => {
        /**
         Stub fixture under test.
         */
        const fixture = createCrudStub({
          store: {},
        },);
        /**
         Error thrown for the nested reserved key.
         */
        const error = captureThrown(function setNestedReservedKey(): void {
          fixture.crud
            .set({
              values: {
                nested: {
                  __internal__: {},
                },
              },
            },);
        },);
        expect(error,).toBeInstanceOf(ReservedKeyError,);
        expect(fixture.assignedStores,).toHaveLength(0,);
      },
    },),
  ],
},);
