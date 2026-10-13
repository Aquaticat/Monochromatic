/**
 Built-artifact original whole-request interpretation controls.

 @module
 */
import {
  consumeRequestMaterial,
  flushPolicyDiagnostics,
  SemanticAdmissionPolicyError,
  type RequestMaterialAdmission,
  type RequestMaterialEvidence,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { throwNativeValue, thrownValues, } from './native-query-test-fixture.ts';
import { createRequestMaterialFixture, } from './request-material-test-fixture.ts';

await describe({
  name: consumeRequestMaterial.name,
  children: [
    //region Original references and content relations never become authority
    ...(['none', 'potential-instruction', 'unknown',] as const).map(function relationCase(choice,) {
      return it({
        name: `retains original identities for admitted ${choice} without permission`,
        fn: async function checkRelation() {
          const f = createRequestMaterialFixture(choice,);
          const interpretation = consumeRequestMaterial(f.options,);
          expect(interpretation.request,).toBe(f.request,);
          expect(interpretation.evidence,).toBe(f.record,);
          expect(interpretation.admission,).toBe('admitted',);
          expect(interpretation.relation,).toBe(choice,);
          expect(interpretation.permission,).toBe(false,);
          expect(f.calls,).toEqual({ reads: 1, acceptances: 1, },);
          expect(Object.isFrozen(interpretation,),).toBe(true,);
          expect(Object.isFrozen(f.request,),).toBe(false,);
          expect(Object.isFrozen(f.record,),).toBe(false,);
          expect(Object.isFrozen(f.options.policy,),).toBe(false,);
        },
      },);
    },),
    ...(['evidence', 'source',] as const).map(function foreignCase(location,) {
      return it({
        name: `rejects equal-byte foreign request in ${location}`,
        fn: async function checkForeign() {
          const f = createRequestMaterialFixture();
          const copy = { ...f.request, };
          expect(copy,).toEqual(f.request,);
          const input = location === 'evidence'
            ? { ...f.options, record: { ...f.record, binding: { ...f.record.binding, requestMaterial: copy, }, }, }
            : { ...f.options, inputs: { instructionSources: [{ request: { request: copy, }, },], }, };
          expect(function invoke() { consumeRequestMaterial(input,); },).toThrow(SemanticAdmissionPolicyError,);
          expect(f.calls.acceptances,).toBe(0,);
        },
      },);
    },),
    it({
      name: 'preserves policy receiver and the exact original estimate value',
      fn: async function checkReceiver() {
        const f = createRequestMaterialFixture();
        const policy: RequestMaterialAdmission = {
          model: 'fixture-model',
          accepts(this: RequestMaterialAdmission, value,) {
            expect(this,).toBe(policy,);
            expect(value,).toBe(f.record.answer.value,);
            return false;
          },
        };
        const interpretation = consumeRequestMaterial({ ...f.options, policy, },);
        expect(interpretation.admission,).toBe('abstained',);
        expect(Object.hasOwn(interpretation, 'relation',),).toBe(false,);
      },
    },),
    it({
      name: 'missing source views do not prevent content interpretation or certify source coverage',
      fn: async function checkNoSource() {
        const f = createRequestMaterialFixture();
        const interpretation = consumeRequestMaterial({ ...f.options, inputs: { instructionSources: [], }, },);
        expect(interpretation.admission,).toBe('admitted',);
        expect(interpretation.permission,).toBe(false,);
        expect(Object.hasOwn(interpretation, 'completeGoverningCoverage',),).toBe(false,);
      },
    },),
    //endregion Reference-bound content, not directive authority

    //region Only matching attribution and synchronous Boolean code acceptance may admit
    ...['foreign-model', 'missing-model', 'unresolved',].map(function abstentionCase(mode,) {
      return it({
        name: `abstains without reading the value for ${mode}`,
        fn: async function checkAbstention() {
          const f = createRequestMaterialFixture();
          const record: RequestMaterialEvidence = {
            ...f.record,
            ...(mode === 'foreign-model' ? { model: 'foreign', } : {}),
            answer: { status: mode === 'unresolved' ? 'unresolved' : 'estimate', },
          };
          if (mode === 'missing-model')
            Reflect.deleteProperty(record, 'model',);
          Object.defineProperty(record.answer, 'value', {
            get(): never { throw new Error('Unadmitted value must not be read',); },
          },);
          const interpretation = consumeRequestMaterial({ ...f.options, record, },);
          expect(interpretation.admission,).toBe('abstained',);
          expect(f.calls.acceptances,).toBe(0,);
          expect(Object.hasOwn(interpretation, 'relation',),).toBe(false,);
        },
      },);
    },),
    ...[undefined, 1, 'approve', { priority: 0, }, Promise.resolve(true,),].map(function acceptanceCase(value, index,) {
      return it({
        name: `rejects non-Boolean policy acceptance ${index}`,
        fn: async function checkAcceptance() {
          const f = createRequestMaterialFixture();
          expect(function invoke() {
            consumeRequestMaterial({ ...f.options, policy: { ...f.options.policy, accepts: () => value, }, },);
          },).toThrow('synchronously admit or abstain',);
        },
      },);
    },),
    //endregion Explicit admission and abstention

    //region Invalid questions and foreign native failures remain observable
    ...['absent', 'definition', 'type', 'scope', 'status', 'choice', 'value',].map(function invalidCase(mode,) {
      return it({
        name: `rejects original request content input with invalid ${mode}`,
        fn: async function checkInvalid() {
          const f = createRequestMaterialFixture();
          const record = {
            ...f.record,
            ...(mode === 'definition' ? { definitionId: 'clause_operation_relation', } : {}),
            ...(mode === 'type' ? { definition: { type: 'noul', }, } : {}),
            ...(mode === 'scope' ? { binding: { ...f.record.binding, claimScope: 'program-instruction', }, } : {}),
            ...(mode === 'status' ? { answer: { status: 'invalid', }, } : {}),
            ...(mode === 'choice' ? { answer: { status: 'estimate', value: { choice: 'approve', probabilities: {}, }, }, } : {}),
            ...(mode === 'value' ? { answer: { status: 'estimate', }, } : {}),
          };
          const input = { ...f.options, ...(mode === 'absent' ? {} : { record, }), };
          if (mode === 'absent')
            Reflect.deleteProperty(input, 'record',);
          expect(function invoke() { consumeRequestMaterial(input,); },).toThrow(SemanticAdmissionPolicyError,);
          expect(f.calls.acceptances,).toBe(0,);
        },
      },);
    },),
    ...['reader', 'policy',].flatMap(function boundaryCases(boundary,) {
      return [false, undefined,].map(function exceptionCase(original, index,) {
        return it({
          name: `${boundary} preserves original thrown value ${index}`,
          fn: async function checkThrownValue() {
            const f = createRequestMaterialFixture();
            function fail(): never {
              throwNativeValue(original,);
              throw new Error('Native exception must not return',);
            }
            const options = boundary === 'reader'
              ? { ...f.options, judgment: { requestMaterialFor: fail, }, }
              : { ...f.options, policy: { ...f.options.policy, accepts: fail, }, };
            const failures = thrownValues(function invoke() { consumeRequestMaterial(options,); },);
            expect(failures.length,).toBe(1,);
            expect(failures[0],).toBe(original,);
          },
        },);
      },);
    },),
    //endregion Input and callback failures
  ],
},);
await flushPolicyDiagnostics();
