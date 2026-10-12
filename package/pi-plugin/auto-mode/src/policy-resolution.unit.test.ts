/**
 Built-artifact directive and authorization composition.

 @module
 */
import { inspectAuthorizationRequirements, resolveGuardOutcome, resolveInstructionEffects, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { policyRequirement, policyRule, } from './policy-test-fixture.ts';

await describe({
  name: '',
  children: [
    //region Pure policy outcomes never substitute for native admission

    describe({
      name: resolveGuardOutcome.name,
      children: [
        ...[
          { effect: 'permit', verdict: 'approve', },
          { effect: 'prohibit', verdict: 'deny', },
          { effect: 'require-approval', verdict: 'ask', },
        ] as const,
      ].map(function directiveCase({ effect, verdict, },) {
        return it({
          name: `maps admitted ${effect} to internal ${verdict}`,
          fn: async function checkDirective() {
            const result = resolveGuardOutcome({ premises: 'complete', rules: [policyRule({ effect, },),], },);
            expect(result,).toMatchObject({ state: 'resolved', verdict, },);
            expect(Object.isFrozen(result,),).toBe(true,);
            expect(Object.hasOwn(result, 'permission',),).toBe(false,);
          },
        },);
      },),
    },),
    it({
      name: 'keeps missing premises unresolved and absent policy unspecified',
      fn: async function checkMissingPolicy() {
        for (const premises of [undefined, 'incomplete',]) {
          expect(resolveGuardOutcome({ premises, rules: [policyRule(),], },),).toMatchObject({ state: 'unresolved', },);
        }
        for (const rules of [[], [policyRule({ applicability: 'does-not-apply', },),],]) {
          const result = resolveGuardOutcome({ premises: 'complete', rules, },);
          expect(result.state,).toBe('unspecified',);
          expect(Object.hasOwn(result, 'verdict',),).toBe(false,);
        }
      },
    },),
    it({
      name: 'does not turn a bare or satisfied prerequisite into permission',
      fn: async function checkBareRequirements() {
        expect(resolveGuardOutcome({ premises: 'complete', rules: [], authorizationRequirements: [policyRequirement(),], },),).toMatchObject({ state: 'unresolved', },);
        const satisfied = resolveGuardOutcome({
          premises: 'complete', rules: [],
          authorizationRequirements: [policyRequirement({ satisfaction: 'satisfied', },),],
        },);
        expect(satisfied.state,).toBe('unspecified',);
        expect(satisfied,).toHaveProperty('authorizationRequirements',);
        expect(Object.hasOwn(satisfied, 'verdict',),).toBe(false,);
      },
    },),
    ...[
      { effect: 'permit', satisfaction: 'unsatisfied', channel: 'incumbent-approval', expected: 'ask', },
      { effect: 'permit', satisfaction: 'satisfied', channel: 'unsupported', expected: 'approve', },
      { effect: 'permit', satisfaction: 'unresolved', channel: 'incumbent-approval', expected: 'unresolved', },
      { effect: 'permit', satisfaction: 'unsatisfied', channel: 'unsupported', expected: 'unresolved', },
      { effect: 'prohibit', satisfaction: 'satisfied', channel: 'incumbent-approval', expected: 'deny', },
      { effect: 'prohibit', satisfaction: 'unresolved', channel: 'unsupported', expected: 'deny', },
      { effect: 'require-approval', satisfaction: 'unresolved', channel: 'incumbent-approval', expected: 'unresolved', },
    ].map(function constrainedCase({ effect, satisfaction, channel, expected, },) {
      return it({
        name: `composes ${effect}, ${satisfaction}, ${channel} as ${expected}`,
        fn: async function checkConstraint() {
          const result = resolveGuardOutcome({
            premises: 'complete',
            rules: [{ id: 'rule', priority: 0, effect, applicability: 'applies', },],
            authorizationRequirements: [{ id: 'requirement', applicability: 'applies', satisfaction, channel, },],
          },);
          expect(result,).toMatchObject(expected === 'unresolved'
            ? { state: 'unresolved', }
            : { state: 'resolved', verdict: expected, },);
        },
      },);
    },),

    //endregion Pure policy outcomes

    //region Priority and uncertainty are independent from prerequisites

    describe({
      name: resolveInstructionEffects.name,
      children: [
        it({
          name: 'keeps higher same-effect applicability uncertainty compatible without inventing a unique winner',
          fn: async function checkCompatibleUncertainty() {
            const result = resolveInstructionEffects([
              policyRule({ id: 'known', priority: 255, },),
              policyRule({ id: 'possible', applicability: 'unresolved', },),
            ],);
            expect(result,).toMatchObject({
              state: 'resolved', effect: 'permit', highestKnownApplicablePriority: 255,
              highestKnownApplicableRuleIds: ['known',], pendingRuleIds: [],
            },);
            expect(Object.hasOwn(result, 'winningRule',),).toBe(false,);
          },
        },),
        it({
          name: 'does not fall through an unknown governing effect to weaker permission',
          fn: async function checkUnknownTier() {
            const result = resolveInstructionEffects([
              policyRule({ id: 'unknown', effect: 'unresolved', },),
              policyRule({ id: 'weaker', priority: 1, },),
            ],);
            expect(result,).toMatchObject({ state: 'unresolved', pendingRuleIds: ['unknown',], },);
          },
        },),
        it({
          name: 'retains equal-tier conflicts and only stronger repair candidates',
          fn: async function checkConflicts() {
            const rules = [
              policyRule({ id: 'permit', priority: 1, },),
              policyRule({ id: 'prohibit', priority: 1, effect: 'prohibit', },),
              policyRule({ id: 'same', priority: 1, effect: 'unresolved', },),
            ];
            expect(resolveInstructionEffects(rules,),).toMatchObject({ state: 'unresolved', pendingRuleIds: [], },);
            expect(resolveInstructionEffects([...rules, policyRule({ id: 'stronger', applicability: 'unresolved', },),],),)
              .toMatchObject({ state: 'unresolved', pendingRuleIds: ['stronger',], },);
          },
        },),
        it({
          name: 'does not freeze borrowed facts and freezes retained output arrays',
          fn: async function checkOwnership() {
            const input = { id: 'original', priority: 0, effect: 'permit', applicability: 'applies', };
            const rules = [input,];
            const result = resolveInstructionEffects(rules,);
            expect(Object.isFrozen(input,),).toBe(false,);
            expect(Object.isFrozen(rules,),).toBe(false,);
            input.id = 'changed';
            expect(result.highestKnownApplicableRuleIds,).toEqual(['original',],);
            expect(Object.isFrozen(result.highestKnownApplicableRuleIds,),).toBe(true,);
            expect(Object.isFrozen(result.pendingRuleIds,),).toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: inspectAuthorizationRequirements.name,
      children: [
        it({
          name: 'ignores satisfied or inapplicable requirements without granting authority',
          fn: async function checkSatisfied() {
            const result = inspectAuthorizationRequirements([
              policyRequirement({ id: 'inapplicable', applicability: 'does-not-apply', },),
              policyRequirement({ id: 'satisfied', satisfaction: 'satisfied', applicability: 'unresolved', },),
            ],);
            expect(result,).toEqual({ state: 'satisfied', pendingRequirementIds: [], approvalRequirementIds: [], },);
          },
        },),
        it({
          name: 'retains independent pending and approval-sufficient requirements',
          fn: async function checkPending() {
            const result = inspectAuthorizationRequirements([
              policyRequirement({ id: 'approval', },),
              policyRequirement({ id: 'unknown', applicability: 'unresolved', },),
            ],);
            expect(result,).toEqual({ state: 'unresolved', pendingRequirementIds: ['unknown',], approvalRequirementIds: ['approval',], },);
          },
        },),
      ],
    },),

    //endregion Priority and uncertainty
  ],
},);
