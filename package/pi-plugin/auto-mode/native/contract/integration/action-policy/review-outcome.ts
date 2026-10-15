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
    rl.debug('withholding original confirmation for independent unresolved prerequisites');
    return Object.freeze({
      state: 'unresolved',
      reason: 'An independent authorization prerequisite remains unsatisfied or unresolved; session confirmation cannot satisfy it',
      authorizationRequirements: authorization,
      resolution
    });
  }
  rl.debug('retaining automatic outcome for original host confirmation');
  return outcome;
}

/**
 Re-resolve captured policy after the host authenticates Allow for the exact prepared group.
 Confirmation satisfies only requirements whose established channel accepts that response.
 The existing manual fallback may resolve semantic uncertainty, never an independent prerequisite.

 @param program - original compiled facts retained through native confirmation

 @returns operation outcome after applying only the scoped confirmation fact

 @throws InstructionResolutionInputError for malformed internal policy facts
 */
export function resolveConfirmedOutcome(program: CompiledProgram): GuardOutcome {
  tagged({ tag: resolveConfirmedOutcome.name, l }).debug('resolving original policy after scoped confirmation');
  /**
   Preserve established prohibitions before applying confirmation to eligible requirements.
   */
  const automatic = resolveManualReviewOutcome(program);
  if ((automatic.state === 'resolved') && (automatic.verdict === 'deny')) return automatic;
  /**
   This channel cannot resolve unknown applicability or establish external authorization.
   */
  const requirements = (program.authorizationRequirements ?? []).map(function confirmEligible(requirement) {
    if ((requirement.applicability !== 'applies') || (requirement.satisfaction !== 'unsatisfied')
      || (requirement.channel !== 'incumbent-approval')) return requirement;
    return Object.freeze({ ...requirement, satisfaction: 'satisfied' as const });
  });
  /**
   Recompute every prerequisite after adding the authenticated confirmation fact.
   */
  const authorization = inspectAuthorizationRequirements(requirements);
  if (authorization.state !== 'satisfied') return automatic;
  return Object.freeze({
    state: 'resolved',
    verdict: 'approve',
    reason: 'The user approved the original prepared group and its independent prerequisites are satisfied',
    ...(automatic.resolution === undefined ? {} : { resolution: automatic.resolution }),
    authorizationRequirements: authorization
  });
}

//endregion Established prohibitions precede manual confirmation
