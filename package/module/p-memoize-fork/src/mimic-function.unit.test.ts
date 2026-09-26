/**
 Tests for the inlined function-identity copy: name, wrapped `toString`,
 own properties, parameter count, and prototype.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { pMemoize, } from '../dist/final/neutral/index.mjs';

await describe({
  name: 'mimic-function copy',
  children: [
    it({
      name: 'preserves the original function name',
      fn: async () => {
        /**
         Named wrapped function whose identity is copied.
         */
        async function namedFixture(): Promise<number> {
          return 1;
        };
        const memoized = pMemoize({
          fn: namedFixture,
        },);

        expect(memoized.name,).toBe('namedFixture',);
      },
    },),

    it({
      name: 'reports the wrapped body through toString with a wrapper marker',
      fn: async () => {
        /**
         Wrapped function whose body text is wrapped.
         */
        async function namedFixture(): Promise<number> {
          return 1;
        };
        const memoized = pMemoize({
          fn: namedFixture,
        },);

        expect(memoized.toString(),).toBe(`/* Wrapped with memoized() */\n${namedFixture.toString()}`,);
      },
    },),

    it({
      name: 'copies own properties from the source function',
      fn: async () => {
        /**
         Wrapped function carrying one custom own property.
         */
        async function fixture(): Promise<number> {
          return 1;
        };
        Object.defineProperty(
          fixture,
          'custom',
          {
            value: 'copied',
            writable: true,
            enumerable: true,
            configurable: true,
          },
        );
        const memoized = pMemoize({
          fn: fixture,
        },);

        expect((memoized as unknown as {
          readonly custom: string;
        }).custom,).toBe('copied',);
      },
    },),

    it({
      name: 'keeps its own parameter count instead of copying the source one',
      fn: async () => {
        /**
         Wrapped function with more parameters than the memoized wrapper.
         */
        async function fixture(
          first: string,
          second: string,
        ): Promise<string> {
          return `${first}-${second}`;
        };
        const memoized = pMemoize({
          fn: fixture,
        },);

        expect(memoized.length,).toBe(1,);
        expect(fixture.length,).toBe(2,);
      },
    },),

    it({
      name: 'adopts the source prototype chain',
      fn: async () => {
        /**
         Wrapped async function whose prototype the wrapper adopts.
         */
        async function fixture(): Promise<number> {
          return 1;
        };
        const memoized = pMemoize({
          fn: fixture,
        },);

        expect(Reflect.getPrototypeOf(memoized,),).toBe(Reflect.getPrototypeOf(fixture,),);
      },
    },),

    it({
      name: 'copies a non-configurable source property and keeps its descriptor',
      fn: async () => {
        /**
         Wrapped function carrying one non-configurable own property.
         */
        async function fixture(): Promise<number> {
          return 1;
        };
        Object.defineProperty(
          fixture,
          'locked',
          {
            value: 'source',
            writable: false,
            enumerable: false,
            configurable: false,
          },
        );
        const memoized = pMemoize({
          fn: fixture,
        },);

        expect((memoized as unknown as {
          readonly locked: string;
        }).locked,).toBe('source',);
        /**
         Own descriptor the copy installed on the wrapper.
         */
        const copiedDescriptor = Object.getOwnPropertyDescriptor(
          memoized,
          'locked',
        ) as PropertyDescriptor;
        expect(copiedDescriptor.configurable,).toBe(false,);
        expect(copiedDescriptor.writable,).toBe(false,);
      },
    },),
  ],
},);
