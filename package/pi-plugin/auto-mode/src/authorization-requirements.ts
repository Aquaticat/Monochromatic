/**
 Deterministic conjunction of compatible authorization requirements.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readAuthorizationRequirement, } from './authorization-requirement.ts';
import {
  InstructionResolutionInputError,
  readPolicyArray,
} from './policy-data.ts';

//region Prerequisite fulfillment cannot override governing directives

/**
 Internal constraint result, not an approval grant.
 */
export type AuthorizationInspection = {
  /**
   Whether requirements are fulfilled, eligible for scoped approval, or unknown.
   */
  readonly state: 'satisfied' | 'requires-approval' | 'unresolved';
  /**
   Requirements missing applicability, satisfaction or channel evidence.
   */
  readonly pendingRequirementIds: readonly string[];
  /**
   Requirements independently known to be fully satisfiable by original scoped Allow.
   */
  readonly approvalRequirementIds: readonly string[];
};

/**
 Requirement inspection logger.
 */
const l = tagged({ tag: 'auto-mode-authorization-requirements', },);

/**
 Inspect compatible requirements after code establishes their scope and valid waivers.
 Satisfied requirements contribute no permission; unknown fulfillment is not absence.

 @param input - compiler-owned requirement facts
 
 @returns conjunctive constraint state
 
 @throws {@link InstructionResolutionInputError} for unsupported or duplicate facts
 */
export function inspectAuthorizationRequirements(input: unknown,): AuthorizationInspection {
  const rl = tagged({
    tag: inspectAuthorizationRequirements.name,
    l,
  },);
  rl.debug('inspecting internal authorization requirements',);
  const ids = new Set<string>();
  const pendingRequirementIds: string[] = [];
  const approvalRequirementIds: string[] = [];
  for (const entry of readPolicyArray(input,)) {
    const requirement = readAuthorizationRequirement(entry,);
    if (ids.has(requirement.id,))
      throw new InstructionResolutionInputError('Authorization requirement identities must be unique',);
    ids.add(requirement.id,);
    if ((requirement.applicability === 'does-not-apply') || (requirement.satisfaction === 'satisfied'))
      continue;
    if ((requirement.applicability === 'unresolved') || (requirement.satisfaction === 'unresolved')
      || (requirement.channel !== 'incumbent-approval')) {
      pendingRequirementIds.push(requirement.id,);
      continue;
    }
    approvalRequirementIds.push(requirement.id,);
  }
  const state = pendingRequirementIds.length > 0
    ? 'unresolved'
    : approvalRequirementIds.length > 0
    ? 'requires-approval'
    : 'satisfied';
  rl.debug(`authorization requirement state: ${state}`,);
  return Object.freeze({
    state,
    pendingRequirementIds: Object.freeze(pendingRequirementIds,),
    approvalRequirementIds: Object.freeze(approvalRequirementIds,),
  },);
}

//endregion Prerequisites
