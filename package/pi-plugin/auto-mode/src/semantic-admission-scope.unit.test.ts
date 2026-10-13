/**
 Built-artifact matching of fixed policy to original inspection metadata.

 @module
 */
import {
  flushPolicyDiagnostics,
  inspectSemanticAdmissionScope,
  type SemanticAdmissionInputs,
  type SemanticAdmissionPolicy,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

/**
 Scope checks must never invoke the acceptance callback or provide default evidence admission.
 */
function policy(): SemanticAdmissionPolicy {
  return {
    model: 'fixture-model',
    definitionId: 'clause_operation_relation',
    programProfile: 'fixture-profile',
    accepts(): never { throw new Error('Scope matching must not invoke estimate acceptance',); },
  };
}

/**
 Test-local inspection and candidate handles claim no native ownership.
 */
function inputs(): SemanticAdmissionInputs {
  return {
    effects: [{ programInspection: { declaration: { profile: 'fixture-profile', }, }, },],
    ruleCandidates: [{},],
  };
}

await describe({
  name: inspectSemanticAdmissionScope.name,
  children: [
    it({
      name: 'matching requires every original operation profile and returns no authority or permission',
      fn: async function checkMatching() {
        const configured = policy();
        const original = inputs();
        const scope = inspectSemanticAdmissionScope({
          policy: configured,
          inputs: { ...original, effects: [...original.effects, ...original.effects,], },
          expectedModel: 'fixture-model',
        },);
        expect(scope,).toEqual({ state: 'matching', model: 'fixture-model', definitionId: 'clause_operation_relation', programProfile: 'fixture-profile', },);
        expect(Object.isFrozen(scope,),).toBe(true,);
        expect(Object.isFrozen(configured,),).toBe(false,);
        expect(Object.isFrozen(original,),).toBe(false,);
        expect(Object.hasOwn(scope, 'permission',),).toBe(false,);
        expect(Object.hasOwn(scope, 'premises',),).toBe(false,);
      },
    },),
    it({
      name: 'unconfigured and mismatched-model paths do not inspect operation metadata',
      fn: async function checkEarlyReturn() {
        const original: SemanticAdmissionInputs = {
          get effects(): never { throw new Error('Out-of-profile inputs must not be read',); },
          ruleCandidates: [],
        };
        expect(inspectSemanticAdmissionScope({ inputs: original, expectedModel: 'fixture-model', },).state,).toBe('not-configured',);
        expect(inspectSemanticAdmissionScope({ inputs: original, policy: policy(), expectedModel: 'other', },).state,).toBe('out-of-profile',);
      },
    },),
    ...['empty', 'missing', 'different', 'mixed',].map(function profileCase(mode,) {
      return it({
        name: `refuses ${mode} operation inspection`,
        fn: async function checkProfile() {
          const original = inputs();
          const effects = mode === 'empty' ? [] : mode === 'missing' ? [{}]
            : mode === 'different' ? [{ programInspection: { declaration: { profile: 'other', }, }, },]
              : [...original.effects, {},];
          expect(inspectSemanticAdmissionScope({
            inputs: { ...original, effects, }, policy: policy(), expectedModel: 'fixture-model',
          },).state,).toBe('out-of-profile',);
        },
      },);
    },),
    ...['empty', 'retained-empty', 'retained-present', 'aggregate',].map(function candidateCase(mode,) {
      return it({
        name: `distinguishes original clause availability from ${mode} aggregate content use`,
        fn: async function checkCandidates() {
          const original = inputs();
          const selected = mode === 'retained-empty' ? { ...original, instructionCandidates: [], }
            : mode === 'retained-present' ? { ...original, instructionCandidates: [{},], ruleCandidates: [], }
              : { ...original, ruleCandidates: [], };
          const result = inspectSemanticAdmissionScope({
            inputs: selected, policy: policy(), expectedModel: 'fixture-model', requireCandidates: mode !== 'aggregate',
          },);
          expect(result.state,).toBe(mode === 'retained-present' || mode === 'aggregate' ? 'matching' : 'no-indexed-clauses',);
        },
      },);
    },),
  ],
},);
await flushPolicyDiagnostics();
