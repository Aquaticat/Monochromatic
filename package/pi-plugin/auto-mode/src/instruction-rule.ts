/**
 Internal rule facts supplied by the policy compiler.

 @module
 */
import {
  InstructionResolutionInputError,
  readPolicyIdentity,
  readPolicyRecord,
} from './policy-data.ts';

//region Rule vocabulary preserves explicit uncertainty

/**
 Supported directive effects, distinct from authorization prerequisites.
 */
export type InstructionEffect = 'permit' | 'prohibit' | 'require-approval';

/**
 Application to the complete operation, not a member-only relation.
 */
export type InstructionApplicability = 'applies' | 'does-not-apply' | 'unresolved';

/**
 Internal facts do not independently authenticate source authority or evidence.
 Lower code-established priorities take precedence.
 */
export type InstructionRule = {
  /**
   Program-local identity, never an authority claim.
   */
  readonly id: string;
  /**
   Code-established priority in the existing range.
   */
  readonly priority: number;
  /**
   Admitted effect or uncertainty among supported effects.
   */
  readonly effect: InstructionEffect | 'unresolved';
  /**
   Admitted operation application or explicit uncertainty.
   */
  readonly applicability: InstructionApplicability;
};

/**
 Highest supported priority number.
 */
const MAX_PRIORITY = 255;

/**
 Validate priority without deriving authority from its numeric value.

 @param input - priority already established by calling code

 @returns integer within the existing precedence range

 @throws {@link InstructionResolutionInputError} for unsupported priorities
 */
export function readInstructionPriority(input: unknown,): number {
  if (((typeof input) !== 'number') || (!Number.isInteger(input,))
    || (input < 0) || (input > MAX_PRIORITY))
    throw new InstructionResolutionInputError('Instruction priority must be a code-established integer from 0 through 255',);
  return input;
}

/**
 Read the closed rule shape without executing input properties.

 @param input - compiler-owned fact candidate
 
 @returns owned immutable rule
 
 @throws {@link InstructionResolutionInputError} for unsupported facts
 
 @example
 ```ts
 readInstructionRule({ id: 'policy', priority: 0, effect: 'permit', applicability: 'applies' });
 ```
 */
export function readInstructionRule(input: unknown,): InstructionRule {
  /**
   Closed field selection rejects model metadata masquerading as rule facts.
   */
  const values = readPolicyRecord({
    input,
    fields: [
      'id',
      'priority',
      'effect',
      'applicability',
    ],
  },);
  /**
   Narrow each primitive independently; record shape does not authenticate its meaning.
   */
  const {
    effect,
    applicability,
  } = values;
  /**
   Bounded identity correlates diagnostics, never authority.
   */
  const id = readPolicyIdentity(values.id,);
  /**
   Numeric validity remains separate from source authority.
   */
  const priority = readInstructionPriority(values.priority,);
  if ((effect !== 'permit') && (effect !== 'prohibit')
    && (effect !== 'require-approval')
    && (effect !== 'unresolved'))
    throw new InstructionResolutionInputError('Instruction effect requires an admitted fact or explicit unresolved supported effect',);
  if ((applicability !== 'applies') && (applicability !== 'does-not-apply')
    && (applicability !== 'unresolved'))
    throw new InstructionResolutionInputError('Instruction applicability requires admitted evidence or explicit uncertainty',);
  return Object.freeze({
    id,
    priority,
    effect,
    applicability,
  },);
}

//endregion Rule vocabulary
