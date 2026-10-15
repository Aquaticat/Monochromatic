/**
 Preserve established prohibitions before uncertain native reviews reach manual confirmation. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { GuardOutcome } from '../../../../src/guard-outcome.ts';
import type { InstructionRule } from '../../../../src/instruction-rule.ts';
import { resolveGuardOutcome, resolveInstructionEffects } from '../maintained-policy.mjs';

/**
 This internal program comes from the original native compiler, not a model-authored verdict.
 */
type CompiledProgram = {
  readonly premises: 'complete' | 'incomplete';
  readonly rules: readonly InstructionRule[];
  readonly authorizationRequirements?: readonly unknown[];
};

/**
 Diagnostics identify routing decisions without exposing instruction or operation content.
 */
const l = tagged({ tag: 'auto-mode-manual-review-outcome' });

//region An uncertain review cannot override an established governing prohibition

/**
 Keep uncertain automatic outcomes while retaining prohibitions established by the original compiler.
 Known stronger applicable instructions still override lower-priority prohibitions.
 Uncertainty cannot supply an override for a prohibition at the strongest known applicable tier.

 @param program - original compiled directive and prerequisite facts

 @returns automatic outcome for the host's original approval router

 @throws InstructionResolutionInputError for malformed internal policy facts

 @example
 ```ts
 const outcome = resolveManualReviewOutcome({ premises: 'incomplete', rules: [] });
 ```
 */
export function resolveManualReviewOutcome(program: CompiledProgram): GuardOutcome {
  /**
   The pure resolver remains independent from the host's confirmation fallback.
   */
  const rl = tagged({ tag: resolveManualReviewOutcome.name, l });
  rl.debug('resolving automatic outcome before manual confirmation');
  /**
   Resolved automatic decisions retain their existing precedence and authorization behavior.
   */
  const outcome = resolveGuardOutcome(program);
  if (outcome.state === 'resolved') return outcome;
  /**
   The compiler retains admitted rules even when unrelated interpretations remain unresolved.
   */
  const resolution = resolveInstructionEffects(program.rules);
  /**
   Membership uses original rule identities from the existing priority resolver.
   */
  const governing = new Set(resolution.highestKnownApplicableRuleIds);
  if (program.rules.some(function establishedProhibition(rule) {
    return governing.has(rule.id) && rule.effect === 'prohibit';
  })) {
    rl.debug('retaining established prohibition despite other uncertain premises');
    return Object.freeze({
      state: 'resolved',
      verdict: 'deny',
      reason: 'An established applicable instruction prohibits this operation; manual confirmation cannot override it',
      resolution
    });
  }
  rl.debug('retaining uncertainty for original host confirmation');
  return outcome;
}

//endregion Established prohibitions precede manual confirmation
