/**
 Preserve established prohibitions before uncertain native reviews reach manual confirmation. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { GuardOutcome } from '../../../../src/guard-outcome.ts';
import type { InstructionRule } from '../../../../src/instruction-rule.ts';
import type { AuthorizationRequirement } from '../../../../src/authorization-requirement.ts';
import {
  inspectAuthorizationRequirements,
  resolveGuardOutcome,
  resolveInstructionEffects
} from '../maintained-policy.mjs';

/**
 This internal program comes from the original native compiler, not a model-authored verdict.
 */
type CompiledProgram = {
  readonly premises: 'complete' | 'incomplete';
  readonly rules: readonly InstructionRule[];
  readonly authorizationRequirements?: readonly AuthorizationRequirement[];
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
  const rl = tagged({
    tag: resolveManualReviewOutcome.name,
    l
  });
  rl.debug('resolving automatic outcome before manual confirmation');
  /**
   Resolved automatic decisions retain their existing precedence and authorization behavior.
   */
  const outcome = resolveGuardOutcome(program);
  if ((outcome.state === 'resolved') && (outcome.verdict === 'deny')) return outcome;
  /**
   The compiler retains admitted rules even when unrelated interpretations remain unresolved.
   */
  const resolution = resolveInstructionEffects(program.rules);
  /**
   Membership uses original rule identities from the existing priority resolver.
   */
  const governing = new Set(resolution.highestKnownApplicableRuleIds);
  if (program.rules
    .some(function establishedProhibition(rule) {
    return governing.has(rule.id) && (rule.effect === 'prohibit');
  })) {
    rl.debug('retaining established prohibition despite other uncertain premises');
    return Object.freeze({
      state: 'resolved',
      verdict: 'deny',
      reason: 'An established applicable instruction prohibits this operation; manual confirmation cannot override it',
      resolution
    });
  }
  /**
   Independent prerequisites remain visible even when directive premises are incomplete.
   */
  const authorization = inspectAuthorizationRequirements(program.authorizationRequirements ?? []);
  if (authorization.state === 'unresolved') {
    rl.debug('retaining unresolved clause prerequisites for whole-operation model review');
    return Object.freeze({
      state: 'unresolved',
      reason: 'Clause assessment left authorization requirements unresolved; the complete operation needs decision-model review',
      authorizationRequirements: authorization,
      resolution
    });
  }
  rl.debug('retaining automatic outcome for original host confirmation');
  return outcome;
}

/**
 Preserve final model denials after automatic review and apply authenticated exact-group Allow to uncertainty.
 Manual authorization does not assert that an estimated external prerequisite was satisfied.

 @param program - original compiled facts retained through native confirmation

 @param reconsideredOutcome - complete-operation review superseding preliminary clause estimates

 @returns operation outcome after applying only the scoped confirmation fact

 @throws InstructionResolutionInputError for malformed internal policy facts
 */
export function resolveConfirmedOutcome({ program, reconsideredOutcome }: {
  readonly program: CompiledProgram;
  readonly reconsideredOutcome?: GuardOutcome;
}): GuardOutcome {
  tagged({ tag: resolveConfirmedOutcome.name, l }).debug('resolving original policy after scoped confirmation');
  /**
   A terminal complete-operation denial remains binding; unresolved review leaves clause estimates diagnostic.
   */
  const automatic = reconsideredOutcome ?? resolveManualReviewOutcome(program);
  if ((automatic.state === 'resolved') && (automatic.verdict === 'deny')) return automatic;
  /**
   Retain prerequisite estimates for diagnostics without promoting them into an established terminal restriction.
   */
  const authorization = inspectAuthorizationRequirements(program.authorizationRequirements ?? []);
  return Object.freeze({
    state: 'resolved',
    verdict: 'approve',
    reason: 'The user approved this exact prepared operation after automatic review could not resolve it',
    ...(automatic.resolution === undefined ? {} : { resolution: automatic.resolution }),
    authorizationRequirements: authorization
  });
}

//endregion Established prohibitions precede manual confirmation
