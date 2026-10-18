/**
 Built-artifact native hook installation and release controls.

 @module
 */
import {
  installNativePolicyHooks,
  NativePolicyRuntimeError,
  flushPolicyDiagnostics,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createNativeHookFixture, } from './native-runtime-test-fixture.ts';
import { thrownValues, throwNativeValue, } from './native-query-test-fixture.ts';

await describe({
  name: installNativePolicyHooks.name,
  children: [
    it({
      name: 'reserves original slots before registration and detaches in reverse order after disposal and idle',
      fn: async function checkLifetime() {
        const f = createNativeHookFixture();
        const installed = installNativePolicyHooks({
          ...f.options,
          registerExecutionTools() {
            expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
            expect(f.agent.streamFunction,).toBe(f.options.observedStream,);
            return f.options.registerExecutionTools();
          },
        },);
        expect(installed.isDetached(),).toBe(false,);
        expect(f.events,).toEqual(['register-tools',],);
        expect(installed.detach,).toThrow(NativePolicyRuntimeError,);
        expect(f.events,).toEqual(['register-tools', 'disposed',],);
        expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
        f.controls.disposed = true;
        f.controls.active = true;
        expect(installed.detach,).toThrow(NativePolicyRuntimeError,);
        expect(installed.isDetached(),).toBe(false,);
        f.controls.active = false;
        f.events.length = 0;
        installed.detach();
        expect(f.events,).toEqual(['disposed', 'signal', 'remove-tools', 'invalidate', 'detached',],);
        expect(f.agent.executeToolBatch,).toBeUndefined();
        expect(f.agent.streamFunction,).toBe(f.options.observedStream,);
        expect(installed.isDetached(),).toBe(true,);
        installed.detach();
        expect(f.events.length,).toBe(5,);
        expect(Object.isFrozen(installed,),).toBe(true,);
        expect(Object.isFrozen(f.agent,),).toBe(false,);
        expect(Object.isFrozen(f.options,),).toBe(false,);
      },
    },),
    it({
      name: 'failed removers remain retryable while successful removers are not repeated',
      fn: async function checkCleanupRetry() {
        const f = createNativeHookFixture();
        const state = { fail: true, };
        const original = new Error('Original remover failure',);
        const installed = installNativePolicyHooks({
          ...f.options,
          registerExecutionTools() {
            return function remove(): void {
              f.events.push('remove-tools',);
              if (state.fail)
                throw original;
            };
          },
        },);
        f.controls.disposed = true;
        const [failure,] = thrownValues(installed.detach,);
        if (!(failure instanceof AggregateError))
          throw new Error('Expected original remover failure aggregate',);
        expect(failure.errors,).toEqual([original,],);
        expect(installed.isDetached(),).toBe(false,);
        expect(f.agent.executeToolBatch,).toBe(f.options.executeToolBatch,);
        expect(f.events.slice(-2),).toEqual(['remove-tools', 'invalidate',],);
        state.fail = false;
        f.events.length = 0;
        installed.detach();
        expect(f.events,).toEqual(['disposed', 'signal', 'remove-tools', 'detached',],);
        expect(installed.isDetached(),).toBe(true,);
      },
    },),
    it({
      name: 'does not clear a replacement executor or replace a foreign stream during detachment',
      fn: async function checkForeignSlots() {
        const f = createNativeHookFixture();
        const installed = installNativePolicyHooks(f.options,);
        const foreign = {};
        f.agent.executeToolBatch = foreign;
        f.agent.streamFunction = foreign;
        f.controls.disposed = true;
        installed.detach();
        expect(f.agent.executeToolBatch,).toBe(foreign,);
        expect(f.agent.streamFunction,).toBe(foreign,);
      },
    },),
    it({
      name: 'preserves a trace failure after recording completed detachment',
      fn: async function checkTraceFailure() {
        const f = createNativeHookFixture();
        const installed = installNativePolicyHooks({
          ...f.options,
          onDetached(): void { throwNativeValue(undefined,); },
        },);
        f.controls.disposed = true;
        expect(thrownValues(installed.detach,),).toEqual([undefined,],);
        expect(installed.isDetached(),).toBe(true,);
        expect(f.agent.executeToolBatch,).toBeUndefined();
      },
    },),
  ],
},);
await flushPolicyDiagnostics();
