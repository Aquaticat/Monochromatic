/**
 Original policy-slot capability diagnostics retain their failure category. @module
 */

//region Capability failures stay distinct from native resource collection failures

/* oxlint-disable unicorn/custom-error-definition -- Preserve inherited setters; see doc/error-name-contract.md. */
/**
 Unauthenticated policy input and lost binding eligibility share one stable capability category.
 */
export class PolicySlotBindingError extends Error {
  /**
   Retain the original message and optional cause without replacing the thrown identity.

   @param message - original capability failure explanation

   @param options - original optional cause retained in the standard error chain
   */
  constructor(
    message: string,
    options?: Readonly<ErrorOptions>,
  ) {
    super(
      message,
      options,
    );
    this.name = this
      .constructor
      .name;
  }
}
/* oxlint-enable unicorn/custom-error-definition */

//endregion Capability failures stay distinct from native resource collection failures
