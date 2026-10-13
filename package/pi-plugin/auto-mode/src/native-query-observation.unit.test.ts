/**
 Built-artifact controls for native query observation failure retention.

 @module
 */
import {
  createNativeQueryObservation,
  flushPolicyDiagnostics,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

/**
 Record thrown values without confusing undefined with normal return.

 @param run - tested operation

 @returns thrown-value occurrences, empty on normal return
 */
function thrownValues(run: () => void,): readonly unknown[] {
  /** Test-local occurrence list retains exact values without formatting them. */
  const values: unknown[] = [];
  try {
    run();
  }
  catch (error) {
    values.push(error,);
  }
  return values;
}

await describe({
  name: createNativeQueryObservation.name,
  children: [
    //region Successful capture forwards frames without claiming ownership

    it({
      name: 'forwards original frames to their fixed receivers without freezing borrowed values',
      fn: async function checkForwarding() {
        const received: unknown[] = [];
        const input = {}, output = {};
        const receivers = {
          captureInput(frame: unknown,): undefined { received.push(frame,); },
          captureOutput(frame: unknown,): undefined { received.push(frame,); },
        };
        const observation = createNativeQueryObservation(receivers,);
        receivers.captureInput = function replaced(): undefined { throw new Error('Replacement must not be called',); };
        observation.captureInput(input,);
        observation.captureOutput(output,);
        observation.assertHealthy();
        expect(received[0],).toBe(input,);
        expect(received[1],).toBe(output,);
        expect(received.length,).toBe(2,);
        expect(Object.isFrozen(observation,),).toBe(true,);
        for (const borrowed of [input, output, receivers, receivers.captureOutput,])
          expect(Object.isFrozen(borrowed,),).toBe(false,);
      },
    },),

    //endregion Successful capture

    //region Failure values remain exact and eligibility cannot be restored

    ...(['captureInput', 'captureOutput',] as const).flatMap(function phaseCases(phase,) {
      return [false, undefined, new Error('Original receiver failure',),].map(function failureCase(original, index,) {
        return it({
          name: `${phase} retains exact failure ${index} after successful recapture`,
          fn: async function checkFailure() {
            let fails = true;
            const observation = createNativeQueryObservation({
              captureInput(): undefined { if (fails) throw original; },
              captureOutput(): undefined { if (fails) throw original; },
            },);
            const first = thrownValues(function capture() { observation[phase]({},); },);
            expect(first.length,).toBe(1,);
            expect(first[0],).toBe(original,);
            fails = false;
            observation[phase]({},);
            const after = thrownValues(observation.assertHealthy,);
            expect(after.length,).toBe(1,);
            expect(after[0],).toBe(original,);
            const nativeError = new Error('Native callback failed',);
            const reportError = new Error('Native reporting failed',);
            const [aggregate,] = thrownValues(function report() { observation.reportFailed({ nativeError, reportError, },); },);
            if (!(aggregate instanceof AggregateError))
              throw new Error('Expected observation and native reporting failures together',);
            expect(aggregate.errors,).toEqual([original, nativeError, reportError,],);
            expect(Object.isFrozen(nativeError,),).toBe(false,);
            expect(Object.isFrozen(reportError,),).toBe(false,);
          },
        },);
      },);
    },),
    it({
      name: 'later failure does not replace the first observation failure',
      fn: async function checkFirstFailure() {
        const later = new Error('Later output failure',);
        const observation = createNativeQueryObservation({
          captureInput(): undefined { throw false; },
          captureOutput(): undefined { throw later; },
        },);
        expect(thrownValues(function input() { observation.captureInput({},); },),).toEqual([false,],);
        expect(thrownValues(function output() { observation.captureOutput({},); },),).toEqual([later,],);
        expect(thrownValues(observation.assertHealthy,),).toEqual([false,],);
      },
    },),
    it({
      name: 'does not reflect on a thrown proxy and proves the reflection control can run',
      fn: async function checkProxyFailure() {
        const reflections: object[] = [];
        const original = new Proxy({}, {
          getPrototypeOf(target: object,): object { reflections.push(target,); return Object.prototype; },
        },);
        const observation = createNativeQueryObservation({
          captureInput(): undefined { throw original; },
          captureOutput(): undefined {},
        },);
        expect(thrownValues(function capture() { observation.captureInput({},); },)[0],).toBe(original,);
        expect(thrownValues(observation.assertHealthy,)[0],).toBe(original,);
        expect(reflections.length,).toBe(0,);
        Reflect.getPrototypeOf(original,);
        expect(reflections.length,).toBe(1,);
      },
    },),

    //endregion Failure retention

    //region Reporting failures retain native behavior without an observer failure

    ...[undefined, false, new Error('Native reporter failed',),].map(function reportingCase(reportError, index,) {
      return it({
        name: `preserves native reporting failure ${index} without an observation failure`,
        fn: async function checkReporting() {
          const observation = createNativeQueryObservation({
            captureInput(): undefined {},
            captureOutput(): undefined {},
          },);
          const failures = thrownValues(function report() { observation.reportFailed({ nativeError: 'callback', reportError, },); },);
          expect(failures.length,).toBe(1,);
          expect(failures[0],).toBe(reportError,);
          observation.assertHealthy();
        },
      },);
    },),

    //endregion Native reporting
  ],
},);
await flushPolicyDiagnostics();
