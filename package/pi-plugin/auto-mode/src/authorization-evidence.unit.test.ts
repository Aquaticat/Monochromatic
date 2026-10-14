/**
 Built-artifact original prerequisite evidence lifetime controls.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  AuthorizationEvidenceError,
  captureAuthorizationInputs,
  captureAuthorizationOwnerFactory,
  flushPolicyDiagnostics,
} from '../dist/final/node/index.mjs';
import {
  authorizationCaptureFailures,
  createAuthorizationEvidenceFixture,
} from './authorization-evidence-test-fixture.ts';
import { thrownValues, throwNativeValue, } from './native-query-test-fixture.ts';

await describe({
  name: '',
  children: [
    describe({
      name: captureAuthorizationOwnerFactory.name,
      children: [
        it({
          name: 'keeps callable identity and absence while rejecting unsupported configuration',
          fn: async function checkFactory() {
            const f = createAuthorizationEvidenceFixture();
            expect(captureAuthorizationOwnerFactory(f.options.ownerFor,),).toBe(f.options.ownerFor,);
            expect(captureAuthorizationOwnerFactory(undefined,),).toBeUndefined();
            for (const input of [null, {}, true, 1, 'owner',]) {
              expect(function invoke() { captureAuthorizationOwnerFactory(input,); },)
                .toThrow(AuthorizationEvidenceError,);
            }
            expect(f.controls.captures,).toBe(0,);
          },
        },),
      ],
    },),
    describe({
      name: captureAuthorizationInputs.name,
      children: [
        //region Positive controls preserve original references and independent facts
        it({
          name: 'copies condition facts without freezing borrowed owners or evidence',
          fn: async function checkCapture() {
            const f = createAuthorizationEvidenceFixture();
            const captured = await captureAuthorizationInputs(f.options,);
            expect(f.controls.captures,).toBe(1,);
            expect(captured.forClause(f.rule,),).toEqual(f.authorization,);
            expect(
              Object.isFrozen(captured.forClause(f.rule,),),
            ).toBe(true,);
            expect(Object.isFrozen(captured.records,),).toBe(true,);
            expect(captured.records[0]?.evidence,).toBe(f.evidence,);
            expect(captured.records[0]?.rule,).toBe(f.rule,);
            expect(captured.records[0]?.source,).toBe(f.source,);
            expect(captured.records[0]?.request,).toBe(f.request,);
            expect(Object.isFrozen(f.evidence,),).toBe(false,);
            expect(Object.isFrozen(f.owner,),).toBe(false,);
            captured.assertCurrent();
            expect(function foreignClause() { captured.forClause({},); },).toThrow(AuthorizationEvidenceError,);
          },
        },),
        ...(['absent-factory', 'absent-owner', 'legacy-candidates',] as const).map(function absenceCase(mode,) {
          return it({
            name: `retains unknown prerequisite facts for ${mode}`,
            fn: async function checkAbsence() {
              const f = createAuthorizationEvidenceFixture();
              const captured = await captureAuthorizationInputs({
                ...f.options,
                inputs: { ...f.inputs, instructionCandidates: mode === 'legacy-candidates' ? undefined : [f.rule,], },
                ownerFor: mode === 'absent-factory' ? undefined : function absentOwner() { return undefined; },
              },);
              expect(captured.forClause(f.rule,),).toBeUndefined();
              expect(captured.records,).toEqual([],);
              expect(f.controls.captures,).toBe(0,);
            },
          },);
        },),
        //endregion Positive original-reference controls
        //region Eligibility failures remain latched after original values are restored
        ...(['owner', 'facts', 'capture-method', 'freshness-method', 'inputs',] as const).map(function retirementCase(mode,) {
          return it({
            name: `retires ${mode} evidence permanently after the first failed check`,
            fn: async function checkRetirement() {
              const f = createAuthorizationEvidenceFixture();
              const captured = await captureAuthorizationInputs(f.options,);
              const methods = { capture: f.owner.capture, assertCurrent: f.owner.assertCurrent, };
              if (mode === 'owner')
                f.controls.ownerCurrent = false;
              if (mode === 'facts')
                f.authorization.satisfaction = 'satisfied';
              if (mode === 'capture-method')
                f.owner.capture = async function replacementCapture() { return f.evidence; };
              if (mode === 'freshness-method')
                f.owner.assertCurrent = function replacementFreshness() { throwNativeValue(false,); };
              if (mode === 'inputs')
                f.controls.current = false;
              expect(captured.assertCurrent,).toThrow(AuthorizationEvidenceError,);
              f.controls.ownerCurrent = true;
              f.controls.current = true;
              f.authorization.satisfaction = 'unsatisfied';
              f.owner.capture = methods.capture;
              f.owner.assertCurrent = methods.assertCurrent;
              expect(captured.assertCurrent,).toThrow('lost eligibility',);
            },
          },);
        },),
        it({
          name: 'retains falsy exceptions from the original unchanged freshness capability',
          fn: async function checkFalsyFailure() {
            const f = createAuthorizationEvidenceFixture();
            const state = { fail: false, };
            f.owner.assertCurrent = function originalFreshness(value,) {
              expect(value,).toBe(f.evidence,);
              if (state.fail)
                throwNativeValue(undefined,);
            };
            const captured = await captureAuthorizationInputs(f.options,);
            state.fail = true;
            expect(thrownValues(captured.assertCurrent,),).toEqual([undefined,],);
            state.fail = false;
            expect(captured.assertCurrent,).toThrow('lost eligibility',);
          },
        },),
        it({
          name: 'rejects inputs retired during asynchronous owner capture',
          fn: async function checkAsyncRetirement() {
            const f = createAuthorizationEvidenceFixture();
            f.owner.capture = async function retireDuringCapture() {
              f.controls.current = false;
              return f.evidence;
            };
            const failures = await authorizationCaptureFailures(f.options,);
            expect(failures,).toHaveLength(1,);
            expect(failures[0],).toBeInstanceOf(AuthorizationEvidenceError,);
          },
        },),
        //endregion Latched eligibility controls
      ],
    },),
  ],
},);
await flushPolicyDiagnostics();
