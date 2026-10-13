/**
 Authorization prerequisites remain separate from directives.

 @module
 */
import type { InstructionApplicability, } from './instruction-rule.ts';
import {
  InstructionResolutionInputError,
  readPolicyIdentity,
  readPolicyRecord,
} from './policy-data.ts';

//region Requirements constrain permission without granting it

/**
 Code must establish scope and valid waivers before supplying a requirement.
 Incumbent approval means one original scoped Allow fully satisfies it,
 not merely that a UI exists.
 */
export type AuthorizationRequirement = {
  /**
   Program-local identity.
   */
  readonly id: string;
  /**
   Applicability already admitted for the whole operation.
   */
  readonly applicability: InstructionApplicability;
  /**
   Fulfillment is independent of permission and prohibition.
   */
  readonly satisfaction: 'satisfied' | 'unsatisfied' | 'unresolved';
  /**
   Independently established approval sufficiency or explicit uncertainty.
   */
  readonly channel: 'incumbent-approval' | 'unsupported' | 'unresolved';
};

/**
 Read a closed internal requirement without evaluating caller properties.

 @param input - compiler-owned requirement facts
 
 @returns owned immutable requirement
 
 @throws {@link InstructionResolutionInputError} for unsupported requirement facts
 
 @example
 ```ts
 readAuthorizationRequirement({ id: 'confirm', applicability: 'applies', satisfaction: 'unsatisfied', channel: 'incumbent-approval' });
 ```
 */
export function readAuthorizationRequirement(input: unknown,): AuthorizationRequirement {
  /**
   Closed field selection prevents unrelated metadata from becoming authorization facts.
   */
  const values = readPolicyRecord({
    input,
    fields: [
      'id',
      'applicability',
      'satisfaction',
      'channel',
    ],
  },);
  /**
   Applicability, fulfillment and approval sufficiency are separate propositions.
   */
  const {
    applicability,
    satisfaction,
    channel,
  } = values;
  /**
   Bounded identity correlates this requirement without establishing permission.
   */
  const id = readPolicyIdentity(values.id,);
  if ((applicability !== 'applies') && (applicability !== 'does-not-apply')
    && (applicability !== 'unresolved'))
    throw new InstructionResolutionInputError('Authorization applicability needs an admitted fact or explicit uncertainty',);
  if ((satisfaction !== 'satisfied') && (satisfaction !== 'unsatisfied')
    && (satisfaction !== 'unresolved'))
    throw new InstructionResolutionInputError('Authorization satisfaction needs an admitted fact or explicit uncertainty',);
  if ((channel !== 'incumbent-approval') && (channel !== 'unsupported')
    && (channel !== 'unresolved'))
    throw new InstructionResolutionInputError('Authorization channel eligibility needs an admitted fact or explicit uncertainty',);
  return Object.freeze({
    id,
    applicability,
    satisfaction,
    channel,
  },);
}

//endregion Requirements
