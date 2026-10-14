/**
 Verify adopted admission through the built package consumed by the native host.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createNativeSemanticOperatingPolicies, } from '../dist/final/node/index.mjs';

/**
 Test catalogs are authored independently from implementation constants.
 */
const cases = [
  { key: 'semanticAdmissionPolicy', definition: 'clause_operation_relation',
    supported: ['permission', 'prohibition', 'prerequisite', 'none',], unresolved: ['unknown', 'unsupported',], },
  { key: 'requestMaterialAdmissionPolicy', definition: 'request_instruction_content',
    supported: ['none', 'potential-instruction',], unresolved: ['unknown',], },
  { key: 'headingContextAdmissionPolicy', definition: 'heading_instruction_content',
    supported: ['none', 'potential-instruction',], unresolved: ['unknown',], },
  { key: 'unitAdoptionAdmissionPolicy', definition: 'unit_adoption',
    supported: ['adopts', 'none',], unresolved: ['unknown', 'unsupported',], },
] as const;

/**
 Build a complete normalized fixture with uncertainty assigned to unknown.

 @param labels - independently authored original vocabulary

 @param choice - selected supported or unresolved meaning

 @param score - selected score at a tested boundary

 @returns owned estimate for one policy invocation
 */
function estimate({ labels, choice, score = 1, }: {
  readonly labels: readonly string[];
  readonly choice: string;
  readonly score?: number;
},): { choice: string; probabilities: Record<string, number>; } {
  return {
    choice,
    probabilities: Object.fromEntries(labels.map(function scoreLabel(label,) {
      return [label, label === choice ? score : label === 'unknown' ? 1 - score : 0,];
    },),),
  };
}

await describe({
  name: createNativeSemanticOperatingPolicies.name,
  children: cases.map(function describePolicy({ key, definition, supported, unresolved, },) {
    /**
     Every suite owns its factory results and submitted estimates.
     */
    const policies = createNativeSemanticOperatingPolicies();
    /**
     Capture exactly one runtime-facing policy for each independent vocabulary.
     */
    const policy = policies[key];
    /**
     Complete fixture distribution preserves unresolved choices.
     */
    const labels = [...supported, ...unresolved,];
    return describe({
      name: definition,
      children: [
        it({ name: 'fixes the original model, definition, and complete-program profile', fn: async function fixedScope() {
          expect(policy.model,).toBe('typesafe/jev-1.13.0',);
          expect(policy.definitionId,).toBe(definition,);
          expect(policy.programProfile,).toBe('native-inspected-programs-v2',);
          expect(Object.isFrozen(policies,),).toBe(true,);
          expect(Object.isFrozen(policy,),).toBe(true,);
        }, },),
        ...supported.flatMap(function acceptedBoundaries(choice,) {
          return [0.99, 1,].map(function atBoundary(score,) {
            return it({ name: `admits ${choice} at ${score}`, fn: async function admittedSupportedMeaning() {
              /**
               Admission must neither rewrite nor freeze a borrowed estimate.
               */
              const value = estimate({ labels, choice, score, },);
              expect(policy.accepts(value,),).toBe(true,);
              expect(Object.isFrozen(value,),).toBe(false,);
              expect(Object.isFrozen(value.probabilities,),).toBe(false,);
              expect(value.probabilities[choice],).toBe(score,);
            }, },);
          },);
        },),
        ...supported.map(function belowBoundary(choice,) {
          return it({ name: `abstains from ${choice} below 0.99`, fn: async function lowerScore() {
            expect(
              policy.accepts(estimate({ labels, choice, score: 0.989999, },),),
            ).toBe(false,);
          }, },);
        },),
        ...unresolved.map(function unresolvedMeaning(choice,) {
          return it({ name: `abstains from ${choice} at one`, fn: async function unresolvedAtEndpoint() {
            expect(
              policy.accepts(estimate({ labels, choice, },),),
            ).toBe(false,);
          }, },);
        },),
        it({ name: 'abstains from a normalized tie', fn: async function tiedChoice() {
          expect(
            policy.accepts(estimate({ labels, choice: supported[0], score: 0.5, },),),
          ).toBe(false,);
        }, },),
        it({ name: 'abstains from a selected choice below another score', fn: async function nonleadingChoice() {
          expect(
            policy.accepts(estimate({ labels, choice: supported[0], score: 0.01, },),),
          ).toBe(false,);
        }, },),
        ...[Number.NaN, Infinity, -0.01, 1.01,].map(function malformedNumber(score,) {
          return it({ name: `rejects invalid score ${score}`, fn: async function invalidScore() {
            expect(function invokeInvalidScore() {
              policy.accepts(estimate({ labels, choice: supported[0], score, },),);
            },).toThrow('every configured score',);
          }, },);
        },),
        it({ name: 'rejects missing scores', fn: async function missingScore() {
          expect(function invokeMissingScore() {
            policy.accepts({ choice: supported[0], probabilities: {}, },);
          },).toThrow('every configured score',);
        }, },),
        it({ name: 'rejects a distribution with extra mass', fn: async function excessMass() {
          /**
           All individual numbers remain legal while their total exceeds one.
           */
          const value = estimate({ labels, choice: supported[0], },);
          value.probabilities.unknown = 0.01;
          expect(function invokeExcessMass() {
 policy.accepts(value,);
 },).toThrow('normalized distribution',);
        }, },),
        it({ name: 'rejects a choice outside this definition', fn: async function unexpectedChoice() {
          /**
           Keep the distribution valid so this control isolates selected-label validation.
           */
          const value = estimate({ labels, choice: supported[0], },);
          value.choice = 'unconfigured';
          expect(function invokeUnexpectedChoice() {
            policy.accepts(value,);
          },).toThrow('configured question vocabulary',);
        }, },),
        it({ name: 'rejects a non-string choice', fn: async function nonstringChoice() {
          expect(function invokeNonstringChoice() {
            policy.accepts({ choice: 1, probabilities: {}, },);
          },).toThrow('configured question vocabulary',);
        }, },),
        it({ name: 'rejects an extra distribution label', fn: async function extraLabel() {
          /**
           A valid known distribution cannot carry an unconfigured extra category.
           */
          const value = estimate({ labels, choice: supported[0], },);
          value.probabilities.unconfigured = 0;
          expect(function invokeExtraLabel() {
 policy.accepts(value,);
 },).toThrow('unsupported field',);
        }, },),
      ],
    },);
  },),
},);
