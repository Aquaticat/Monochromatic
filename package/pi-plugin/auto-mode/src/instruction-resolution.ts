/**
 Deterministic resolution of admitted internal directive facts.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type InstructionEffect,
  type InstructionRule,
  readInstructionRule,
} from './instruction-rule.ts';
import {
  InstructionResolutionInputError,
  readPolicyArray,
} from './policy-data.ts';

//region Resolution retains sufficient pending questions without inventing a winner

/**
 Shared diagnostics do not prove a unique winning instruction.
 */
type ResolutionSupport = {
  /**
   Distinguishes this pure calculation from native evidence admission.
   */
  readonly kind: 'instruction-resolution';
  /**
   Known applicable rules at the strongest known applicable tier.
   */
  readonly highestKnownApplicableRuleIds: readonly string[];
  /**
   Sufficient next-question candidates, not exhaustive or minimal dependencies.
   */
  readonly pendingRuleIds: readonly string[];
};

/**
 Directive result, preserving unknown and instruction-free states.
 */
export type InstructionResolution = ResolutionSupport & (
  | {
    readonly state: 'resolved';
    readonly effect: InstructionEffect;
    readonly highestKnownApplicablePriority: number
  }
  | {
    readonly state: 'unresolved' | 'unspecified';
    readonly reason: string
  }
);

/**
 Resolver logger.
 */
const l = tagged({ tag: 'auto-mode-instruction-resolution', },);

/**
 Resolve bounded authored facts without issuing source authority or execution permission.
 Unknown effects range over supported effects, not unclassified prose or delegation.

 @param input - compiler-owned rule facts
 
 @returns effect only when supported uncertainty cannot change it
 
 @throws {@link InstructionResolutionInputError} for unsupported fact programs
 */
export function resolveInstructionEffects(input: unknown,): InstructionResolution {
  const rl = tagged({
    tag: resolveInstructionEffects.name,
    l,
  },);
  rl.debug('resolving internal directive effects',);
  const rules: InstructionRule[] = [];
  const ids = new Set<string>();
  let priority = Number.POSITIVE_INFINITY;
  for (const entry of readPolicyArray(input,)) {
    const rule = readInstructionRule(entry,);
    if (ids.has(rule.id,))
      throw new InstructionResolutionInputError('Instruction rule identities must be unique within this program',);
    ids.add(rule.id,);
    rules.push(rule,);
    if (rule.applicability === 'applies')
      priority = Math.min(
        priority,
        rule.priority,
      );
  }
  const applicable = rules.filter(function atStrongestTier(rule,) {
    return (rule.applicability === 'applies') && (rule.priority === priority);
  },);
  const effects = new Set<InstructionEffect>();
  for (const rule of applicable) {
    if (rule.effect !== 'unresolved')
      effects.add(rule.effect,);
  }
  const unknown = rules.filter(function hasUnknownFact(rule,) {
    return (rule.applicability === 'unresolved')
      || ((rule.applicability === 'applies') && (rule.effect === 'unresolved'));
  },);
  // Equal-tier additions cannot repair an existing conflict; stronger uncertainty can replace it.
  const pending = unknown.filter(function canChangeOutcome(rule,) {
    if (effects.size > 1)
      return rule.priority < priority;
    return (rule.priority <= priority)
      && ((effects.size === 0) || (rule.effect === 'unresolved')
        || (!effects.has(rule.effect,)));
  },);
  const common = {
    kind: 'instruction-resolution' as const,
    highestKnownApplicableRuleIds: Object.freeze(applicable.map(function identity(rule,) {
      return rule.id;
    },),),
    pendingRuleIds: Object.freeze(pending.map(function identity(rule,) {
      return rule.id;
    },),),
  };
  if (pending.length > 0) {
    rl.debug('directive uncertainty can change the outcome',);
    return Object.freeze({
      ...common,
      state: 'unresolved',
      reason: 'Potentially applicable instruction can change the result',
    },);
  }
  if (applicable.length === 0) {
    rl.debug('no directive applies; no fallback is selected',);
    return Object.freeze({
      ...common,
      state: 'unspecified',
      reason: 'No applicable instruction in this authored program; no fallback outcome has been selected',
    },);
  }
  const [effect,] = effects;
  if ((effects.size !== 1) || (effect === undefined)) {
    rl.debug('strongest applicable directives conflict',);
    return Object.freeze({
      ...common,
      state: 'unresolved',
      reason: 'Applicable instructions at the same priority have conflicting effects',
    },);
  }
  rl.debug(`resolved directive effect: ${effect}`,);
  return Object.freeze({
    ...common,
    state: 'resolved',
    effect,
    highestKnownApplicablePriority: priority,
  },);
}

//endregion Resolution
