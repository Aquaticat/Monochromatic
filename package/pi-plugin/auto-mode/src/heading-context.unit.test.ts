/**
 Built-artifact heading content controls preserve source-local, non-authorizing use.

 @module
 */
import {
  consumeHeadingContexts,
  flushPolicyDiagnostics,
  SemanticAdmissionPolicyError,
  type HeadingContextAdmission,
  type HeadingContextEvidence,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { throwNativeValue, thrownValues, } from './native-query-test-fixture.ts';

/**
 Fresh identities deliberately carry equal heading text in different source groups.
 */
function fixture(choice = 'none',) {
  const candidate = { heading: '# Equal heading', };
  const record: HeadingContextEvidence = {
    definitionId: 'heading_instruction_content',
    definition: { type: 'choice', },
    binding: { claimScope: 'program-heading-context', headingContext: { kind: 'source-heading-context', }, },
    model: 'fixture-model',
    answer: { status: 'estimate', value: { choice, probabilities: { [choice]: 1, }, }, },
  };
  const calls = { acceptances: 0, };
  const policy: HeadingContextAdmission = {
    model: 'fixture-model',
    accepts() {
      calls.acceptances++;
      return true;
    },
  };
  return { candidate, record, calls, policy, };
}

await describe({
  name: consumeHeadingContexts.name,
  children: [
    //region Equal text must not merge original groups or become directives
    ...['none', 'potential-instruction', 'unknown',].map(function relationCase(choice,) {
      return it({
        name: `retains original equal-text groups for ${choice} without directive lowering`,
        fn: async function checkRelation() {
          const a = fixture(choice,);
          const b = fixture(choice,);
          const candidates = [a.candidate, b.candidate,];
          const records = [a.record, b.record,];
          const result = consumeHeadingContexts({ records, candidates, policy: a.policy, },);
          expect(result.length,).toBe(2,);
          for (const [index, interpretation,] of result.entries()) {
            expect(interpretation.candidate,).toBe(candidates[index],);
            expect(interpretation.evidence,).toBe(records[index],);
            expect(interpretation.admission,).toBe('admitted',);
            expect(interpretation.relation,).toBe(choice,);
            expect(interpretation.permission,).toBe(false,);
            expect(Object.hasOwn(interpretation, 'priority',),).toBe(false,);
            expect(Object.hasOwn(interpretation, 'lowered',),).toBe(false,);
            expect(Object.isFrozen(interpretation,),).toBe(true,);
          }
          expect(a.candidate,).toEqual(b.candidate,);
          expect(a.candidate,).not.toBe(b.candidate,);
          expect(a.calls.acceptances,).toBe(2,);
          expect(Object.isFrozen(result,),).toBe(true,);
          for (const borrowed of [candidates, records, a.candidate, a.record, a.policy,])
            expect(Object.isFrozen(borrowed,),).toBe(false,);
        },
      },);
    },),
    it({
      name: 'preserves the callback receiver and original estimate value while allowing abstention',
      fn: async function checkReceiver() {
        const f = fixture();
        const policy: HeadingContextAdmission = {
          model: 'fixture-model',
          accepts(this: HeadingContextAdmission, value,) {
            expect(this,).toBe(policy,);
            expect(value,).toBe(f.record.answer.value,);
            return false;
          },
        };
        const result = consumeHeadingContexts({ records: [f.record,], candidates: [f.candidate,], policy, },);
        const [interpretation,] = result;
        if (interpretation === undefined)
          throw new Error('Original heading interpretation is missing',);
        expect(interpretation.admission,).toBe('abstained',);
        expect(Object.hasOwn(interpretation, 'relation',),).toBe(false,);
      },
    },),
    //endregion Original content-use identity

    //region A disabled empty selection differs from missing required policy or candidates
    it({
      name: 'returns a frozen empty result for a disabled empty selection',
      fn: async function checkEmpty() {
        const result = consumeHeadingContexts({ records: [], candidates: [], },);
        expect(result,).toEqual([],);
        expect(Object.isFrozen(result,),).toBe(true,);
      },
    },),
    it({
      name: 'rejects mismatched counts, missing policy and a missing original candidate',
      fn: async function checkSelection() {
        const f = fixture();
        expect(function mismatched() {
          consumeHeadingContexts({ records: [f.record,], candidates: [], policy: f.policy, },);
        },).toThrow(SemanticAdmissionPolicyError,);
        expect(function noPolicy() {
          consumeHeadingContexts({ records: [f.record,], candidates: [f.candidate,], },);
        },).toThrow('configured code policy',);
        const candidates: object[] = [];
        candidates.length = 1;
        expect(function missingCandidate() {
          consumeHeadingContexts({ records: [f.record,], candidates, policy: f.policy, },);
        },).toThrow('candidate is absent',);
        expect(f.calls.acceptances,).toBe(0,);
      },
    },),
    //endregion Selection shape

    //region Attribution and Boolean acceptance do not imply semantic truth
    ...['unattributed', 'foreign-model', 'unresolved',].map(function abstainCase(mode,) {
      return it({
        name: `abstains without reading the estimate value for ${mode}`,
        fn: async function checkAbstention() {
          const f = fixture();
          const record: HeadingContextEvidence = {
            ...f.record,
            ...(mode === 'foreign-model' ? { model: 'foreign', } : {}),
            answer: { status: mode === 'unresolved' ? 'unresolved' : 'estimate', },
          };
          if (mode === 'unattributed')
            Reflect.deleteProperty(record, 'model',);
          Object.defineProperty(record.answer, 'value', {
            get(): never { throw new Error('Unadmitted estimate must not be inspected',); },
          },);
          const result = consumeHeadingContexts({ records: [record,], candidates: [f.candidate,], policy: f.policy, },);
          expect(result[0],).toHaveProperty('admission', 'abstained',);
          expect(f.calls.acceptances,).toBe(0,);
        },
      },);
    },),
    ...[undefined, 1, 'approve', { priority: 0, }, Promise.resolve(true,),].map(function badAcceptance(value, index,) {
      return it({
        name: `rejects non-Boolean heading acceptance ${index}`,
        fn: async function checkAcceptance() {
          const f = fixture();
          expect(function invoke() {
            consumeHeadingContexts({ records: [f.record,], candidates: [f.candidate,], policy: { ...f.policy, accepts: () => value, }, },);
          },).toThrow('synchronously admit or abstain',);
        },
      },);
    },),
    //endregion Code admission

    //region Invalid questions and native callback errors cannot become interpretations
    ...['definition', 'type', 'claim', 'group', 'status', 'choice', 'value',].map(function invalidCase(mode,) {
      return it({
        name: `rejects invalid heading ${mode}`,
        fn: async function checkInvalid() {
          const f = fixture();
          const record = {
            ...f.record,
            ...(mode === 'definition' ? { definitionId: 'request_instruction_content', } : {}),
            ...(mode === 'type' ? { definition: { type: 'noul', }, } : {}),
            ...(mode === 'claim' ? { binding: { ...f.record.binding, claimScope: 'program-instruction', }, } : {}),
            ...(mode === 'group' ? { binding: { ...f.record.binding, headingContext: { kind: 'other', }, }, } : {}),
            ...(mode === 'status' ? { answer: { status: 'invalid', }, } : {}),
            ...(mode === 'choice' ? { answer: { status: 'estimate', value: { choice: 'permission', probabilities: {}, }, }, } : {}),
            ...(mode === 'value' ? { answer: { status: 'estimate', }, } : {}),
          };
          expect(function invoke() {
            consumeHeadingContexts({ records: [record,], candidates: [f.candidate,], policy: f.policy, },);
          },).toThrow(SemanticAdmissionPolicyError,);
          expect(f.calls.acceptances,).toBe(0,);
        },
      },);
    },),
    ...[false, undefined,].map(function nativeError(original, index,) {
      return it({
        name: `preserves original native callback failure ${index}`,
        fn: async function checkFailure() {
          const f = fixture();
          const failures = thrownValues(function invoke() {
            consumeHeadingContexts({
              records: [f.record,], candidates: [f.candidate,], policy: {
                ...f.policy,
                accepts(): never {
                  throwNativeValue(original,);
                  throw new Error('Native exception must not return',);
                },
              },
            },);
          },);
          expect(failures.length,).toBe(1,);
          expect(failures[0],).toBe(original,);
        },
      },);
    },),
    //endregion Definition and callback failures
  ],
},);
await flushPolicyDiagnostics();
