/** Registration declarations derive from the maintained authority copy contract. @module */
import type {
  InstructionAuthorityDeclaration,
  InstructionAuthorityRegistration
} from './policy-loader-types.ts';

export type { InstructionAuthorityDeclaration } from './policy-loader-types.ts';
export type { InstructionAuthorityRegistration } from './policy-loader-types.ts';

/* oxlint-disable no-restricted-syntax/no-nullish-union -- Mirrors the untyped registration.mjs validated-copy boundary whose absent-declaration result travels unchanged to untyped registered-authority.mjs. */
/**
 Copy the declared trust root without retaining caller-mutable fields.

 @param input - original startup authority declaration or its absence
 */
export function copyAuthorityRegistration(input?: InstructionAuthorityDeclaration): InstructionAuthorityRegistration | undefined;
/* oxlint-enable no-restricted-syntax/no-nullish-union */

/** Authority registration misuse remains distinct from policy resolution. */
export class InstructionRegistrationError extends Error {
  /**
   Original category follows the constructing subclass name and remains writable.
   */
  override name: string;

  /**
   Retain the original message without advertising unused cause options.

   @param message - original authority registration failure explanation
   */
  constructor(message: string);
}
