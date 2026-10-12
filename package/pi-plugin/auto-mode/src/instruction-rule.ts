/**
 Internal rule facts supplied by the policy compiler.

 @module
 */
import { InstructionResolutionInputError, readPolicyIdentity, readPolicyRecord, } from './policy-data.ts';

//region Rule vocabulary preserves explicit uncertainty

/** Supported directive effects, distinct from authorization prerequisites. */
export type InstructionEffect = 'permit' | 'prohibit' | 'require-approval';

/** Application to the complete operation, not a member-only relation. */
export type InstructionApplicability = 'applies' | 'does-not-apply' | 'unresolved';

/**
 Internal facts do not independently authenticate source authority or evidence.
 Lower code-established priorities take precedence.
 */
export type InstructionRule = {
  /** Program-local identity, never an authority claim. */
  readonly id: string;
  /** Code-established priority in the existing range. */
  readonly priority: number;
  /** Admitted effect or uncertainty among supported effects. */
  readonly effect: InstructionEffect | 'unresolved';
  /** Admitted operation application or explicit uncertainty. */
  readonly applicability: InstructionApplicability;
};

/** Highest supported priority number. */
const MAX_PRIORITY = 255;

/**
 Read the closed rule shape without executing input properties.

 @param input - compiler-owned fact candidate
 @returns owned immutable rule
 @throws {@link InstructionResolutionInputError} for unsupported facts
 */
export function readInstructionRule(input: unknown,): InstructionRule {
  const values = readPolicyRecord({ input, fields: ['id', 'priority', 'effect', 'applicability',], },);
  const { priority, effect, applicability, } = values;
  const id = readPolicyIdentity(values.id,);
  if (typeof priority !== 'number' || !Number.isInteger(priority,) || priority < 0 || priority > MAX_PRIORITY)
    throw new InstructionResolutionInputError('Instruction priority must be a code-established integer from 0 through 255',);
  if (effect !== 'permit' && effect !== 'prohibit' && effect !== 'require-approval' && effect !== 'unresolved')
    throw new InstructionResolutionInputError('Instruction effect requires an admitted fact or explicit unresolved supported effect',);
  if (applicability !== 'applies' && applicability !== 'does-not-apply' && applicability !== 'unresolved')
    throw new InstructionResolutionInputError('Instruction applicability requires admitted evidence or explicit uncertainty',);
  if (Object.keys(values,).length !== 4)
    throw new InstructionResolutionInputError('Instruction rule requires every supported field',);
  return Object.freeze({ id, priority, effect, applicability, },);
}

//endregion Rule vocabulary
