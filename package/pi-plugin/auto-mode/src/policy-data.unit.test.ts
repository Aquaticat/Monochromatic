/**
 Built-artifact structural boundaries for internal policy facts.

 @module
 */
import { inspectAuthorizationRequirements, InstructionResolutionInputError, resolveGuardOutcome, resolveInstructionEffects, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { policyRequirement, policyRule, } from './policy-test-fixture.ts';

await describe({
  name: 'internal policy fact validation',
  children: [
    //region Closed record and array profiles

    ...[
      undefined, null, [], Object.create(null,),
      { rules: [], premises: true, },
      { rules: [], premises: 'complete', condition: 'ignored', },
      { rules: [], premises: 'complete', authorizationRequirements: undefined, },
    ].map(function invalidProgram(input, index,) {
      return it({
        name: `rejects unsupported program shape ${index}`,
        fn: async function checkInvalidProgram() {
          expect(function resolveInvalid() { resolveGuardOutcome(input,); },).toThrow(InstructionResolutionInputError,);
        },
      },);
    },),
    ...[
      { ...policyRule(), id: '', },
      { ...policyRule(), id: '🙂'.repeat(65,), },
      { ...policyRule(), priority: -1, },
      { ...policyRule(), priority: 256, },
      { ...policyRule(), priority: Number.NaN, },
      { ...policyRule(), priority: Number.POSITIVE_INFINITY, },
      { ...policyRule(), priority: 0.5, },
      { ...policyRule(), priority: '0', },
      { ...policyRule(), effect: 'approve', },
      { ...policyRule(), applicability: 0.99, },
      { ...policyRule(), probability: 0.99, },
      { ...policyRule(), [Symbol('unmodeled'),]: true, },
      { id: 'missing', effect: 'permit', applicability: 'applies', },
    ].map(function invalidRule(input, index,) {
      return it({
        name: `rejects unsupported rule facts ${index}`,
        fn: async function checkInvalidRule() {
          expect(function resolveInvalid() { resolveInstructionEffects([input,],); },).toThrow(InstructionResolutionInputError,);
        },
      },);
    },),
    ...[
      { ...policyRequirement(), applicability: false, },
      { ...policyRequirement(), satisfaction: 'approved', },
      { ...policyRequirement(), channel: 'a-ui-exists', },
      { ...policyRequirement(), id: '', },
      { ...policyRequirement(), extra: true, },
    ].map(function invalidRequirement(input, index,) {
      return it({
        name: `rejects unsupported authorization facts ${index}`,
        fn: async function checkInvalidRequirement() {
          expect(function inspectInvalid() { inspectAuthorizationRequirements([input,],); },).toThrow(InstructionResolutionInputError,);
        },
      },);
    },),
    it({
      name: 'preserves exact clause, requirement and UTF-8 identity bounds',
      fn: async function checkBounds() {
        const rules = Array.from({ length: 256, }, function distinctRule(_, index,) {
          return policyRule({ id: `rule-${index}`, },);
        },);
        const requirements = Array.from({ length: 256, }, function distinctRequirement(_, index,) {
          return policyRequirement({ id: `requirement-${index}`, },);
        },);
        expect(resolveInstructionEffects(rules,).state,).toBe('resolved',);
        expect(inspectAuthorizationRequirements(requirements,).state,).toBe('requires-approval',);
        expect(resolveInstructionEffects([policyRule({ id: '🙂'.repeat(64,), },),],).state,).toBe('resolved',);
        expect(function tooManyRules() { resolveInstructionEffects([...rules, policyRule(),],); },).toThrow(InstructionResolutionInputError,);
        expect(function tooManyRequirements() { inspectAuthorizationRequirements([...requirements, policyRequirement(),],); },).toThrow(InstructionResolutionInputError,);
      },
    },),
    it({
      name: 'rejects duplicate identities, sparse arrays and extra array fields',
      fn: async function checkArrayShapes() {
        expect(function duplicateRules() { resolveInstructionEffects([policyRule(), policyRule(),],); },).toThrow(InstructionResolutionInputError,);
        expect(function duplicateRequirements() { inspectAuthorizationRequirements([policyRequirement(), policyRequirement(),],); },).toThrow(InstructionResolutionInputError,);
        const sparse = new Array(1,);
        expect(function sparseRules() { resolveInstructionEffects(sparse,); },).toThrow(InstructionResolutionInputError,);
        const decorated = Object.defineProperty([policyRule(),], 'extra', { value: true, },);
        expect(function decoratedRules() { resolveInstructionEffects(decorated,); },).toThrow(InstructionResolutionInputError,);
      },
    },),

    //endregion Closed shapes

    //region Positive controls prove that reflection and accessor counters can move

    it({
      name: 'rejects proxies before reflection at every nested policy boundary',
      fn: async function checkProxies() {
        let traps = 0;
        const handler = {
          getPrototypeOf(target: object,): object | null {
            traps++;
            return Reflect.getPrototypeOf(target,);
          },
        };
        const programProxy = new Proxy({ premises: 'complete', rules: [], }, handler,);
        const ruleProxy = new Proxy(policyRule(), handler,);
        const arrayProxy = new Proxy([policyRule(),], handler,);
        const requirementProxy = new Proxy(policyRequirement(), handler,);
        expect(function program() { resolveGuardOutcome(programProxy,); },).toThrow(InstructionResolutionInputError,);
        expect(function rule() { resolveInstructionEffects([ruleProxy,],); },).toThrow(InstructionResolutionInputError,);
        expect(function array() { resolveInstructionEffects(arrayProxy,); },).toThrow(InstructionResolutionInputError,);
        expect(function requirement() { inspectAuthorizationRequirements([requirementProxy,],); },).toThrow(InstructionResolutionInputError,);
        expect(function requirementArray() { inspectAuthorizationRequirements(arrayProxy,); },).toThrow(InstructionResolutionInputError,);
        expect(traps,).toBe(0,);
        Reflect.getPrototypeOf(ruleProxy,);
        expect(traps,).toBe(1,);
      },
    },),
    it({
      name: 'rejects getters and hidden fields without evaluating them',
      fn: async function checkAccessors() {
        let reads = 0;
        const rule = Object.defineProperty(policyRule(), 'effect', {
          enumerable: true,
          get() { reads++; return 'permit'; },
        },);
        const array = Object.defineProperty([policyRule(),], '0', {
          enumerable: true,
          get() { reads++; return policyRule(); },
        },);
        const hidden = Object.defineProperty(policyRule(), 'id', { enumerable: false, },);
        expect(function getterRule() { resolveInstructionEffects([rule,],); },).toThrow(InstructionResolutionInputError,);
        expect(function getterArray() { resolveInstructionEffects(array,); },).toThrow(InstructionResolutionInputError,);
        expect(function hiddenField() { resolveInstructionEffects([hidden,],); },).toThrow(InstructionResolutionInputError,);
        expect(reads,).toBe(0,);
        Reflect.get(rule, 'effect',);
        expect(reads,).toBe(1,);
      },
    },),

    //endregion Positive controls
  ],
},);
