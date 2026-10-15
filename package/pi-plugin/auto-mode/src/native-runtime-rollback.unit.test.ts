/**
 Built-artifact controls for partial native hook installation failures.

 @module
 */
import { installNativePolicyHooks, flushPolicyDiagnostics, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createNativeHookFixture, } from './native-runtime-test-fixture.ts';
import { thrownValues, throwNativeValue, } from './native-query-test-fixture.ts';

await describe({
  name: 'native hook installation rollback',
  children: [
    ...(['registerExecutionTools',] as const).flatMap(function registrationCases(phase,) {
      return [false, undefined, new Error('Original registration failed',),].map(function failureCase(original, index,) {
        return it({
          name: `${phase} preserves original failure ${index} after complete rollback`,
          fn: async function checkRollback() {
            const f = createNativeHookFixture();
            const failures = thrownValues(function install() {
              installNativePolicyHooks({
                ...f.options,
                [phase]() {
                  throwNativeValue(original,);
                  throw new Error('Native throw must not return',);
                },
              },);
            },);
            expect(failures.length,).toBe(1,);
            expect(failures[0],).toBe(original,);
            expect(f.agent.executeToolBatch,).toBeUndefined();
            expect(f.agent.streamFunction,).toBe(f.options.previousStream,);
            expect(f.events,).toEqual(['invalidate',],);
          },
        },);
      },);
    },),
    it({
      name: 'retains independent cleanup failure and keeps the executor occupied',
      fn: async function checkPartialCleanup() {
        const f = createNativeHookFixture();
        const original = new Error('Original registration failed',);
        const cleanup = new Error('Original remover failed',);
        const [failure,] = thrownValues(function install() {
          installNativePolicyHooks({
            ...f.options,
            invalidateObserver() {
              f.events.push('invalidate',);
              throw cleanup;
            },
            registerExecutionTools() { throw original; },
          },);
        },);
        if (!(failure instanceof AggregateError))
          throw new Error('Expected installation and cleanup aggregate',);
        expect(failure.errors[0],).toBe(original,);
        const errors: readonly unknown[] = failure.errors;
        const [, removal,] = errors;
        expect(failure.cause,).toBe(original,);
        if (!(removal instanceof AggregateError))
          throw new Error('Expected original cleanup aggregate',);
        expect(removal.errors,).toEqual([cleanup,],);
        expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
        expect(f.agent.streamFunction,).toBe(f.options.previousStream,);
        expect(f.events,).toEqual(['invalidate',],);
      },
    },),
    it({
      name: 'does not overwrite foreign slots during successful installation rollback',
      fn: async function checkForeignRollback() {
        const f = createNativeHookFixture();
        const foreign = {};
        const original = new Error('Registration replaced slots and failed',);
        expect(thrownValues(function install() {
          installNativePolicyHooks({
            ...f.options,
            registerExecutionTools() {
              f.agent.streamFunction = foreign;
              f.agent.executeToolBatch = foreign;
              throw original;
            },
          },);
        },),).toEqual([original,],);
        expect(f.agent.executeToolBatch,).toBe(foreign,);
        expect(f.agent.streamFunction,).toBe(foreign,);
      },
    },),
    ...['streamFunction', 'executeToolBatch',].map(function restorationCase(slot,) {
      return it({
        name: `retains failure restoring the original ${slot} slot`,
        fn: async function checkRestoration() {
          const f = createNativeHookFixture();
          const original = new Error('Original registration failed',);
          const restore = new Error('Original slot restoration failed',);
          const value = { current: slot === 'streamFunction' ? f.options.previousStream : undefined, };
          Object.defineProperty(f.agent, slot, {
            configurable: true,
            get(): unknown { return value.current; },
            set(next: unknown): void {
              if (next === (slot === 'streamFunction' ? f.options.previousStream : undefined))
                throw restore;
              value.current = next;
            },
          },);
          const [failure,] = thrownValues(function install() {
            installNativePolicyHooks({
              ...f.options,
              registerExecutionTools() {
                throw original;
              },
            },);
          },);
          if (!(failure instanceof AggregateError))
            throw new Error('Expected original installation and restoration failures',);
          expect(failure.errors,).toEqual([original, restore,],);
          expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
        },
      },);
    },),
  ],
},);
await flushPolicyDiagnostics();
