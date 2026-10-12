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
 
 @example
 ```ts
 resolveInstructionEffects([{ id: 'policy', priority: 0, effect: 'permit', applicability: 'applies' }]);
 ```
 */
export function resolveInstructionEffects(input: unknown,): InstructionResolution {
  /**
   Trace branch selection without logging submitted instruction content.
   */
  const rl = tagged({
    tag: resolveInstructionEffects.name,
    l,
  },);
  rl.debug('resolving internal directive effects',);
  /**
   Validated rules retain authored order for stable support diagnostics.
   */
  const rules: InstructionRule[] = [];
  /**
   Duplicate identities must fail before resolution can correlate facts.
   */
  const ids = new Set<string>();
  for (const entry of readPolicyArray(input,)) {
    /**
     Owned primitive fields cannot change during the subsequent calculation.
     */
    const rule = readInstructionRule(entry,);
    if (ids.has(rule.id,))
      throw new InstructionResolutionInputError('Instruction rule identities must be unique within this program',);
    ids.add(rule.id,);
    rules.push(rule,);
  }
  /**
   Strongest known applicable tier; Infinity retains the no-applicable-rule case.
   */
  const priority = rules.reduce(
    function strongestApplicable(
      current,
      rule,
    ) {
    return rule.applicability === 'applies' ? Math.min(
      current,
      rule.priority,
    ) : current;
  },
    Number.POSITIVE_INFINITY,
  );
  /**
   Known support at that tier is not a claim of a unique winning rule.
   */
  const applicable = rules.filter(function atStrongestTier(rule,) {
    return (rule.applicability === 'applies') && (rule.priority === priority);
  },);
  /**
   Concrete effects at the governing tier expose independent conflicts.
   */
  const effects = new Set<InstructionEffect>();
  for (const rule of applicable) {
    if (rule.effect !== 'unresolved')
      effects.add(rule.effect,);
  }
  /**
   Only unresolved applicability or an applicable unresolved effect can still vary.
   */
  const unknown = rules.filter(function hasUnknownFact(rule,) {
    return (rule.applicability === 'unresolved')
      || ((rule.applicability === 'applies') && (rule.effect === 'unresolved'));
  },);
  // Equal-tier additions cannot repair an existing conflict; stronger uncertainty can replace it.
  /**
   Retain sufficient next-question candidates whose completion could change the result.
   */
  const pending = unknown.filter(function canChangeOutcome(rule,) {
    if (effects.size > 1)
      return rule.priority < priority;
    return (rule.priority <= priority)
      && ((effects.size === 0) || (rule.effect === 'unresolved')
        || (!effects.has(rule.effect,)));
  },);
  /**
   Owned diagnostic arrays preserve support identities without freezing borrowed input.
   */
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
  /**
   A sole concrete effect is usable only after pending uncertainty and conflicts are excluded.
   */
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
