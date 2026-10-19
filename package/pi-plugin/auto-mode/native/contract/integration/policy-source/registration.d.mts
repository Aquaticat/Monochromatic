/** Registration declarations derive from the maintained authority copy contract. @module */
import type {
  InstructionAuthorityDeclaration,
  InstructionAuthorityRegistration
} from './policy-loader-types.ts';

export type {
  InstructionAuthorityDeclaration,
  InstructionAuthorityRegistration
};

/**
 Copy the declared trust root without retaining caller-mutable fields.

 @param input - original startup authority declaration or its absence
 */
// oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Mirrors the untyped registration.mjs validated-copy boundary whose absent-declaration result travels unchanged to untyped registered-authority.mjs.
export function copyAuthorityRegistration(input?: InstructionAuthorityDeclaration): InstructionAuthorityRegistration | undefined;

/** Authority registration misuse remains distinct from policy resolution. */
export class InstructionRegistrationError extends Error {}
