/**
 Built-artifact original pair and estimate admission controls.

 @module
 */
import {
  consumeUnitAdoptions,
  flushPolicyDiagnostics,
  SemanticAdmissionPolicyError,
  UnitAdoptionBindingError,
  type UnitAdoptionEvidence,
  type UnitRuleProjection,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { throwNativeValue, thrownValues, } from './native-query-test-fixture.ts';
import { createUnitAdoptionFixture, } from './unit-adoption-test-fixture.ts';

await describe({
  name: 'original incorporation selection and admission',
  children: [
    ...['definition', 'type', 'claim', 'member-copy', 'ordinal', 'adopter-copy', 'target-copy', 'many-effects', 'foreign-effect', 'foreign-source', 'missing-code', 'target-kind', 'target-node',].map(function bindingCase(mode,) {
      return it({
        name: `rejects ${mode} in an original incorporation binding`,
        fn: async function checkBinding() {
          const f = createUnitAdoptionFixture();
          const adopter = mode === 'missing-code' ? { sourceOccurrence: f.adopter.sourceOccurrence, } : f.adopter;
          const target: UnitRuleProjection = {
            ...f.target,
            ...(mode === 'foreign-source' ? { sourceOccurrence: {}, } : {}),
            ...(mode === 'target-kind' ? { kind: 'other', } : {}),
            ...(mode === 'target-node' ? { nodeType: 'paragraph', } : {}),
          };
          const record: UnitAdoptionEvidence = {
            ...f.record,
            ...(mode === 'definition' ? { definitionId: 'other', } : {}),
            ...(mode === 'type' ? { definition: { type: 'noul', }, } : {}),
            binding: {
              ...f.record.binding,
              adopter: mode === 'adopter-copy' ? { ...adopter, } : adopter,
              target: mode === 'target-copy' ? { ...target, } : target,
              ...(mode === 'claim' ? { claimScope: 'program-instruction', } : {}),
              ...(mode === 'member-copy' ? { member: {}, } : {}),
              ...(mode === 'ordinal' ? { memberOrdinal: 1, } : {}),
            },
          };
          const inputs = {
            ...f.options.inputs,
            effects: mode === 'many-effects' ? [...f.options.inputs.effects, ...f.options.inputs.effects,]
              : mode === 'foreign-effect' ? [{ member: {}, },] : f.options.inputs.effects,
            readRule(handle: object,): UnitRuleProjection {
              if (handle === f.pair.adopter)
                return adopter;
              if (handle === f.pair.target)
                return target;
              throw new Error('Unknown original fixture handle',);
            },
          };
          expect(function invoke() {
            consumeUnitAdoptions({ ...f.options, inputs, records: [record,], },);
          },).toThrow(UnitAdoptionBindingError,);
          expect(f.calls.admissions,).toBe(0,);
        },
      },);
    },),
    ...['count', 'pair-hole', 'policy', 'adopter-clause', 'target-clause',].map(function selectionCase(mode,) {
      return it({
        name: `rejects missing ${mode} selection material`,
        fn: async function checkSelection() {
          const f = createUnitAdoptionFixture();
          const pairs = [...f.options.pairs,];
          if (mode === 'pair-hole')
            Reflect.deleteProperty(pairs, '0',);
          const input = {
            ...f.options,
            pairs: mode === 'count' ? [] : pairs,
            clauses: f.clauses.filter(function retainClause(clause,) {
              return ((mode !== 'adopter-clause') && (mode !== 'target-clause'))
                || (clause.rule !== (mode === 'adopter-clause' ? f.pair.adopter : f.pair.target));
            },),
          };
          if (mode === 'policy')
            Reflect.deleteProperty(input, 'policy',);
          expect(function invoke() {
            consumeUnitAdoptions(input,);
          },).toThrow(UnitAdoptionBindingError,);
        },
      },);
    },),
    ...['foreign-model', 'missing-model', 'unresolved',].map(function unattributedCase(mode,) {
      return it({
        name: `${mode} abstains without reading an unadmitted value`,
        fn: async function checkAbstention() {
          const f = createUnitAdoptionFixture();
          const record: UnitAdoptionEvidence = {
            ...f.record,
            ...(mode === 'foreign-model' ? { model: 'foreign', } : {}),
            answer: { status: mode === 'unresolved' ? 'unresolved' : 'estimate', },
          };
          if (mode === 'missing-model')
            Reflect.deleteProperty(record, 'model',);
          Object.defineProperty(record.answer, 'value', {
            get(): never { throw new Error('Unadmitted value must not be inspected',); },
          },);
          const result = consumeUnitAdoptions({ ...f.options, records: [record,], },);
          expect(result.interpretations[0],).toHaveProperty('admission', 'abstained',);
          expect(result.interpretations[0],).toHaveProperty('scopeEstablished', false,);
          expect(result.issues[0],).toHaveProperty('kind', 'unit-adoption-meaning',);
          expect(f.calls.admissions,).toBe(0,);
        },
      },);
    },),
    ...['status', 'value',].map(function answerCase(mode,) {
      return it({
        name: `rejects missing original answer ${mode}`,
        fn: async function checkAnswer() {
          const f = createUnitAdoptionFixture();
          const record = { ...f.record, answer: { status: mode === 'status' ? 'other' : 'estimate', }, };
          expect(function invoke() {
            consumeUnitAdoptions({ ...f.options, records: [record,], },);
          },).toThrow(UnitAdoptionBindingError,);
        },
      },);
    },),
    ...[undefined, 1, 'approve', { scopeEstablished: true, }, Promise.resolve(true,),].map(function acceptanceCase(value, index,) {
      return it({
        name: `rejects non-Boolean incorporation admission ${index}`,
        fn: async function checkAcceptance() {
          const f = createUnitAdoptionFixture();
          expect(function invoke() {
            consumeUnitAdoptions({ ...f.options, policy: { model: 'fixture-model', accepts: () => value, }, },);
          },).toThrow(SemanticAdmissionPolicyError,);
        },
      },);
    },),
    it({
      name: 'retains the original callback receiver and value when code abstains',
      fn: async function checkReceiver() {
        const f = createUnitAdoptionFixture();
        const policy = {
          model: 'fixture-model',
          accepts(value: unknown,): boolean {
            expect(this,).toBe(policy,);
            expect(value,).toBe(f.record.answer.value,);
            return false;
          },
        };
        const result = consumeUnitAdoptions({ ...f.options, policy, },);
        expect(result.interpretations[0],).toHaveProperty('admission', 'abstained',);
        expect(result.rules,).toEqual([],);
      },
    },),
    ...[false, undefined,].map(function failureCase(original, index,) {
      return it({
        name: `retains original incorporation callback failure ${index}`,
        fn: async function checkFailure() {
          const f = createUnitAdoptionFixture();
          const failures = thrownValues(function invoke() {
            consumeUnitAdoptions({ ...f.options, policy: {
              model: 'fixture-model',
              accepts(): never {
                throwNativeValue(original,);
                throw new Error('Native exception must not return',);
              },
            }, },);
          },);
          expect(failures.length,).toBe(1,);
          expect(failures[0],).toBe(original,);
        },
      },);
    },),
  ],
},);
await flushPolicyDiagnostics();
