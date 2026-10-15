/**
 Built-artifact controls for native slot failures and borrowed exception identities.

 @module
 */
import {
  flushPolicyDiagnostics,
  installNativePolicyHooks,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { throwNativeValue, thrownValues, } from './native-query-test-fixture.ts';
import { createNativeHookFixture, } from './native-runtime-test-fixture.ts';

await describe({
  name: 'native runtime slot failures',
  children: [
    //region Slot setters may fail before or after their own assignment
    ...(['streamFunction', 'executeToolBatch',] as const).flatMap(function slotCases(slot,) {
      return [false, true,].map(function setterCase(partialWrite,) {
        return it({
          name: `${slot} installation failure retains identity with partial write ${partialWrite}`,
          fn: async function checkSetterFailure() {
            const f = createNativeHookFixture();
            const original = new Error('Original slot assignment failed',);
            const initial = f.agent[slot];
            const state = { value: initial, };
            Object.defineProperty(f.agent, slot, {
              configurable: true,
              get(): unknown { return state.value; },
              set(next: unknown): void {
                if (next !== initial) {
                  if (partialWrite)
                    state.value = next;
                  throw original;
                }
                state.value = next;
              },
            },);
            const failures = thrownValues(function install() {
              installNativePolicyHooks(f.options,);
            },);
            expect(failures.length,).toBe(1,);
            expect(failures[0],).toBe(original,);
            expect(f.agent.streamFunction,).toBe(f.options.previousStream,);
            expect(f.agent.executeToolBatch,).toBeUndefined();
            expect(f.events,).toEqual(['invalidate',],);
          },
        },);
      },);
    },),
    it({
      name: 'executor release failure keeps detachment retryable without repeating successful removers',
      fn: async function checkReleaseFailure() {
        const f = createNativeHookFixture();
        const installed = installNativePolicyHooks(f.options,);
        const state = { value: f.agent.executeToolBatch, fail: true, };
        Object.defineProperty(f.agent, 'executeToolBatch', {
          configurable: true,
          get(): unknown { return state.value; },
          set(next: unknown): void {
            if (state.fail)
              throwNativeValue(false,);
            state.value = next;
          },
        },);
        f.controls.disposed = true;
        expect(thrownValues(installed.detach,),).toEqual([false,],);
        expect(installed.isDetached(),).toBe(false,);
        expect(state.value,).toBe(f.options.executeToolBatch,);
        state.fail = false;
        f.events.length = 0;
        installed.detach();
        expect(f.events,).toEqual(['disposed', 'signal', 'detached',],);
        expect(installed.isDetached(),).toBe(true,);
        expect(state.value,).toBeUndefined();
      },
    },),
    //endregion Partial native setter failures

    //region Foreign error values never require property reflection
    it({
      name: 'disposal-reader failures preserve undefined and do not begin cleanup',
      fn: async function checkReaderFailure() {
        const f = createNativeHookFixture();
        const installed = installNativePolicyHooks({
          ...f.options,
          isSessionDisposed(): never {
            throwNativeValue(undefined,);
            throw new Error('Native exception must not return',);
          },
        },);
        f.events.length = 0;
        expect(thrownValues(installed.detach,),).toEqual([undefined,],);
        expect(f.events,).toEqual([],);
        expect(installed.isDetached(),).toBe(false,);
        expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
      },
    },),
    it({
      name: 'rollback retains a proxy exception without reflection and keeps borrowed callbacks mutable',
      fn: async function checkOpaqueFailure() {
        const f = createNativeHookFixture();
        const reflection = { count: 0, };
        const original = new Proxy({}, {
          ownKeys(): never {
            reflection.count++;
            throw new Error('Unexpected exception reflection',);
          },
          get(): never {
            reflection.count++;
            throw new Error('Unexpected exception property read',);
          },
        },);
        const failures = thrownValues(function install() {
          installNativePolicyHooks({
            ...f.options,
            registerExecutionTools(): never {
              throwNativeValue(original,);
              throw new Error('Native exception must not return',);
            },
          },);
        },);
        expect(failures.length,).toBe(1,);
        expect(failures[0],).toBe(original,);
        expect(reflection.count,).toBe(0,);
        expect(Object.isFrozen(f.options.invalidateObserver,),).toBe(false,);
        expect(function positiveReflectionControl() {
          Reflect.ownKeys(original,);
        },).toThrow('Unexpected exception reflection',);
        expect(reflection.count,).toBe(1,);
      },
    },),
    //endregion Opaque native errors
  ],
},);
await flushPolicyDiagnostics();
