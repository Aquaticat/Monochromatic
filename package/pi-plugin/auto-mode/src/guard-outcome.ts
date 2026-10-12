/**
 Deterministic outcome calculation for admitted internal policy programs.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { type AuthorizationInspection, inspectAuthorizationRequirements, } from './authorization-requirements.ts';
import { type InstructionResolution, resolveInstructionEffects, } from './instruction-resolution.ts';
import { InstructionResolutionInputError, readPolicyRecord, } from './policy-data.ts';

//region Internal outcomes never authenticate their premises or issue execution permission

/** Diagnostics retained independently from outcome state. */
type OutcomeEvidence = {
  /** Directive calculation, absent when its premises are incomplete. */
  readonly resolution?: InstructionResolution;
  /** Constraint calculation, present only when requirements were supplied. */
  readonly authorizationRequirements?: AuthorizationInspection;
};

/** Code-selected internal outcome, preserving uncertainty and absence of policy. */
export type GuardOutcome = OutcomeEvidence & (
  | { readonly state: 'resolved'; readonly verdict: 'approve' | 'deny' | 'ask'; readonly reason: string; }
  | { readonly state: 'unresolved' | 'unspecified'; readonly reason: string; }
);

/** Outcome logger. */
const l = tagged({ tag: 'auto-mode-guard-outcome', },);

/**
 Translate admitted internal facts to an outcome without asking a model for a verdict.
 The trusted compiler separately establishes authority, scope, source coverage,
 delegation, complete-operation facts and semantic admission.
 A caller-supplied completeness string is not native evidence admission.
 Legacy require-approval means independently established conditional authorization,
 never a bare prerequisite extracted from text.

 @param program - compiler-owned facts, not raw semantic replies or action-supplied authority
 @returns internal outcome requiring original native dependency and approval checks before execution
 @throws {@link InstructionResolutionInputError} for unsupported internal programs
 */
export function resolveGuardOutcome(program: unknown,): GuardOutcome {
  const rl = tagged({ tag: resolveGuardOutcome.name, l, },);
  rl.debug('resolving internal guard outcome',);
  const values = readPolicyRecord({ input: program, fields: ['rules', 'premises', 'authorizationRequirements',], },);
  const { rules, premises = 'incomplete', } = values;
  if (premises !== 'complete' && premises !== 'incomplete')
    throw new InstructionResolutionInputError('Policy premises must be complete or incomplete',);
  if (premises !== 'complete') {
    rl.debug('required governing or operation premises remain incomplete',);
    return Object.freeze({ state: 'unresolved', reason: 'Governing instructions or complete operation facts are not established', },);
  }
  const requirements = Object.hasOwn(values, 'authorizationRequirements',) ? values.authorizationRequirements : [];
  const authorization = inspectAuthorizationRequirements(requirements,);
  const resolution = resolveInstructionEffects(rules,);
  // Validated requirement presence is equivalent to nonempty retained requirement diagnostics
  // only for unresolved/approval cases; satisfied nonempty requirements still need diagnostics.
  const hasRequirements = Array.isArray(requirements,) && requirements.length > 0;
  const constraints = hasRequirements ? { authorizationRequirements: authorization, } : {};
  if (resolution.state !== 'resolved') {
    if (resolution.state === 'unspecified' && authorization.state !== 'satisfied') {
      rl.debug('a prerequisite alone supplies neither permission nor approval sufficiency',);
      return Object.freeze({
        state: 'unresolved', resolution, ...constraints,
        reason: 'An authorization prerequisite alone establishes neither permission nor sufficient approval for this operation',
      },);
    }
    return hasRequirements ? Object.freeze({ ...resolution, ...constraints, },) : resolution;
  }
  const common = { state: 'resolved' as const, resolution, ...constraints, };
  if (resolution.effect === 'prohibit') {
    rl.debug('governing prohibition remains effective independently of prerequisites',);
    return Object.freeze({ ...common, verdict: 'deny', reason: 'Applicable governing instructions prohibit the operation', },);
  }
  if (authorization.state === 'unresolved') {
    rl.debug('authorization requirements remain unresolved',);
    return Object.freeze({
      ...common, state: 'unresolved',
      reason: 'Authorization requirements lack established applicability, satisfaction, or a suitable approval channel',
    },);
  }
  if (resolution.effect === 'require-approval') {
    rl.debug('established conditional authorization requires original approval',);
    return Object.freeze({ ...common, verdict: 'ask', reason: 'Established conditional authorization requires original scoped approval', },);
  }
  if (authorization.state === 'requires-approval') {
    rl.debug('otherwise permitted operation requires original scoped approval',);
    return Object.freeze({
      ...common, verdict: 'ask',
      reason: 'The operation is otherwise permitted, but its remaining authorization requirements need original scoped approval',
    },);
  }
  rl.debug('governing permission has no unfulfilled authorization requirement',);
  return Object.freeze({ ...common, verdict: 'approve', reason: 'Applicable governing instructions permit the operation', },);
}

//endregion Internal outcomes
