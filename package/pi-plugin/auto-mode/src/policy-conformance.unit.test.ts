/**
 Complete-world oracle retained from the private deterministic resolver controls.
 No semantic model, authority registration or human approval is simulated.

 @module
 */
import { type InstructionEffect, type InstructionRule, resolveInstructionEffects, } from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

//region Independent complete-world enumeration

/** Supported concrete directive effects. */
const effects: readonly InstructionEffect[] = ['permit', 'prohibit', 'require-approval',];

/**
 Enumerate supported completions of one partial fact.
 @param rule - authored partial fact
 @returns complete worlds without inferring source authority
 */
function completions(rule: InstructionRule,): readonly InstructionRule[] {
  const meanings = rule.effect === 'unresolved' ? effects : [rule.effect,];
  const applicability = rule.applicability === 'unresolved'
    ? ['applies', 'does-not-apply',] as const
    : [rule.applicability,];
  return meanings.flatMap(function withEffect(effect,) {
    return applicability.map(function withApplicability(state,) {
      return { ...rule, effect, applicability: state, };
    },);
  },);
}

/**
 Compute a complete-world reference independently of pending-question selection.
 @param rules - complete facts for the current world
 @returns reference state and effect
 */
function completeReference(rules: readonly InstructionRule[],): string {
  const applicable = rules.filter(function applies(rule,) {
    return rule.applicability === 'applies';
  },);
  if (applicable.length === 0)
    return 'unspecified';
  const priority = Math.min(...applicable.map(function priorityOf(rule,) {
    return rule.priority;
  },),);
  const selectedEffects = new Set(applicable.filter(function strongest(rule,) {
    return rule.priority === priority;
  },).map(function effectOf(rule,) {
    return rule.effect;
  },),);
  const [effect,] = selectedEffects;
  return selectedEffects.size === 1 ? `resolved:${effect}` : 'unresolved';
}

/**
 Enumerate the original bounded partial-fact domain.
 @returns rule variants without program-local identities
 */
function variants(): readonly Omit<InstructionRule, 'id'>[] {
  const result: Omit<InstructionRule, 'id'>[] = [];
  for (const priority of [0, 1,]) {
    for (const effect of [...effects, 'unresolved',] as const) {
      for (const applicability of ['applies', 'does-not-apply', 'unresolved',] as const)
        result.push({ priority, effect, applicability, },);
    }
  }
  return result;
}

await describe({
  name: resolveInstructionEffects.name,
  children: [
    it({
      name: 'agrees with every completion in the retained bounded partial-fact domain',
      fn: async function checkCompleteWorlds() {
        const choices = variants();
        let programs = 0;
        let completeWorlds = 0;
        for (const left of choices) {
          for (const right of choices) {
            for (const third of [undefined, ...choices,]) {
              const firstRule = { id: 'left', ...left, };
              const secondRule = { id: 'right', ...right, };
              const thirdRule = third === undefined ? undefined : { id: 'third', ...third, };
              const rules = thirdRule === undefined
                ? [firstRule, secondRule,]
                : [firstRule, secondRule, thirdRule,];
              const worlds = new Set<string>();
              const thirdWorlds = thirdRule === undefined ? [undefined,] : completions(thirdRule,);
              for (const first of completions(firstRule,)) {
                for (const second of completions(secondRule,)) {
                  for (const last of thirdWorlds) {
                    worlds.add(completeReference(last === undefined ? [first, second,] : [first, second, last,],),);
                    completeWorlds++;
                  }
                }
              }
              const [onlyWorld,] = worlds;
              const expected = worlds.size === 1 ? onlyWorld : 'unresolved';
              const result = resolveInstructionEffects(rules,);
              const actual = result.state === 'resolved' ? `resolved:${result.effect}` : result.state;
              expect(actual,).toBe(expected,);
              programs++;
            }
          }
        }
        expect(programs,).toBe(14_400,);
        expect(completeWorlds,).toBe(112_896,);
      },
    },),
  ],
},);

//endregion Independent enumeration
