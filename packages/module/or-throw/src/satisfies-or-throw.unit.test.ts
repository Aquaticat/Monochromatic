/**
 * Tests for `satisfiesOrThrow` and `satisfiesOrThrowAsync`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  satisfiesOrThrow,
  satisfiesOrThrowAsync,
  type SatisfiesOrThrowAsyncPredicate,
  type SatisfiesOrThrowPredicate,
} from '@monochromatic-dev/module-or-throw';

await describe({
  name: '',
  children: [
    describe({
      name: satisfiesOrThrow.name,
      children: [
        it({
          name: 'returns candidate when Object.is passes',
          fn: async () => {
            const checker = satisfiesOrThrow({ value: 'ready' as const, },);
            expect(checker('ready',),).toBe('ready',);

            const nanChecker = satisfiesOrThrow({ value: Number.NaN, },);
            const nanResult = nanChecker(Number.NaN,);
            expect(Number.isNaN(nanResult,),).toBe(true,);
          },
        },),

        it({
          name: 'throws when Object.is fails',
          fn: async () => {
            const checker = satisfiesOrThrow({ value: 'ready' as const, },);
            expect(() => checker('pending',),).toThrow('ready',);

            const zeroChecker = satisfiesOrThrow({ value: 0, },);
            expect(() => zeroChecker(-0,),).toThrow('0',);
          },
        },),

        it({
          name: 'returns candidate unchanged when custom predicate passes',
          fn: async () => {
            const checker = satisfiesOrThrow({
              value: 'ready',
              predicate: ({ candidate, value, }) =>
                ((typeof candidate) === 'string')
                && (candidate.toLowerCase() === value),
            },);

            expect(checker('READY',),).toBe('READY',);
          },
        },),

        it({
          name: 'throws when custom predicate fails',
          fn: async () => {
            const checker = satisfiesOrThrow({
              value: 'ready',
              predicate: ({ candidate, value, }) => candidate === value,
            },);

            expect(() => checker('pending',),).toThrow('ready',);
          },
        },),

        it({
          name: 'throws when custom predicate returns non-boolean result',
          fn: async () => {
            const checker = satisfiesOrThrow({
              value: 'ready',
              predicate: (() => 'yes') as unknown as SatisfiesOrThrowPredicate<
                string
              >,
            },);

            expect(() => checker('ready',),).toThrow('boolean',);
          },
        },),

        it({
          name: 'narrows default equality to configured value type',
          fn: async () => {
            const unknownInput: unknown = 'ready';
            const unknownOutput = satisfiesOrThrow({
              value: 'ready' as const,
            },)(unknownInput,);
            expectTypeOf(unknownOutput,).toEqualTypeOf<'ready'>();

            const unionInput = 'ready' as string | number;
            const unionOutput = satisfiesOrThrow({
              value: 'ready' as const,
            },)(unionInput,);
            expectTypeOf(unionOutput,).toEqualTypeOf<'ready'>();
          },
        },),

        it({
          name: 'keeps custom predicate return type as candidate type',
          fn: async () => {
            const unionInput = 'READY' as string | number;
            const output = satisfiesOrThrow({
              value: 'ready',
              predicate: ({ candidate, value, }) =>
                ((typeof candidate) === 'string')
                && (candidate.toLowerCase() === value),
            },)(unionInput,);

            expectTypeOf(output,).toEqualTypeOf<string | number>();
          },
        },),
      ],
    },),

    describe({
      name: satisfiesOrThrowAsync.name,
      children: [
        it({
          name: 'resolves candidate when Object.is passes',
          fn: async () => {
            const checker = satisfiesOrThrowAsync({ value: 'ready' as const, },);
            const result = await checker('ready',);
            expect(result,).toBe('ready',);
          },
        },),

        it({
          name: 'throws when async Object.is fails',
          fn: async () => {
            const checker = satisfiesOrThrowAsync({ value: 'ready' as const, },);
            let caught: unknown;
            try {
              await checker('pending',);
            }
            catch (error) {
              caught = error;
            }

            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('ready',);
          },
        },),

        it({
          name: 'resolves candidate when async predicate passes',
          fn: async () => {
            const checker = satisfiesOrThrowAsync({
              value: 'ready',
              predicate: async ({ candidate, value, }) =>
                ((typeof candidate) === 'string')
                && (candidate.toLowerCase() === value),
            },);

            const result = await checker('READY',);
            expect(result,).toBe('READY',);
          },
        },),

        it({
          name: 'throws when async predicate fails',
          fn: async () => {
            const checker = satisfiesOrThrowAsync({
              value: 'ready',
              predicate: async ({ candidate, value, }) => candidate === value,
            },);

            let caught: unknown;
            try {
              await checker('pending',);
            }
            catch (error) {
              caught = error;
            }

            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('ready',);
          },
        },),

        it({
          name: 'throws when async predicate resolves non-boolean result',
          fn: async () => {
            const checker = satisfiesOrThrowAsync({
              value: 'ready',
              predicate: (async () => 'yes') as unknown as SatisfiesOrThrowAsyncPredicate<
                string
              >,
            },);

            let caught: unknown;
            try {
              await checker('ready',);
            }
            catch (error) {
              caught = error;
            }

            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('boolean',);
          },
        },),

        it({
          name: 'narrows async default equality to configured value type',
          fn: async () => {
            const unknownInput: unknown = 'ready';
            const unknownOutput = await satisfiesOrThrowAsync({
              value: 'ready' as const,
            },)(unknownInput,);
            expectTypeOf(unknownOutput,).toEqualTypeOf<'ready'>();

            const unionInput = 'ready' as string | number;
            const unionOutput = await satisfiesOrThrowAsync({
              value: 'ready' as const,
            },)(unionInput,);
            expectTypeOf(unionOutput,).toEqualTypeOf<'ready'>();
          },
        },),

        it({
          name: 'keeps async custom predicate return type as candidate type',
          fn: async () => {
            const unionInput = 'READY' as string | number;
            const output = await satisfiesOrThrowAsync({
              value: 'ready',
              predicate: async ({ candidate, value, }) =>
                ((typeof candidate) === 'string')
                && (candidate.toLowerCase() === value),
            },)(unionInput,);

            expectTypeOf(output,).toEqualTypeOf<string | number>();
          },
        },),
      ],
    },),
  ],
},);
