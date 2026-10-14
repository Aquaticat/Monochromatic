/**
 Native capture failures remain separate from errors thrown by extension callbacks.

 @module
 */

//region Original capture failures cross the native handler catch without being reported as extension errors

/** Traversal no longer matches the original native callback positions. */
export class NativeContextContractError extends Error {
  override readonly name = 'NativeContextContractError';
}

/** Private propagation wrapper retains even primitive and nullish thrown values. */
export class NativeContextCaptureFailure extends Error {
  override readonly name = 'NativeContextCaptureFailure';
  readonly #original: unknown;

  /**
   Retain the exact capture failure for propagation outside Pi's extension-error reporting.

   @param original - caught value whose identity must survive the native catch
   */
  constructor(original: unknown) {
    super('Original native context input capture failed');
    this.#original = original;
  }

  /**
   Propagate original observer errors while leaving ordinary handler failures to Pi.

   @param error - caught handler or observation value from the original native catch

   @throws original capture failure when this observer supplied the wrapper
   */
  static rethrow(error: unknown): void {
    if (error !== null && typeof error === 'object' && #original in error) throw error.#original;
  }
}

//endregion Original capture failures cross the native handler catch without being reported as extension errors
