/**
 Native event observation failures retain their original thrown values.

 @module
 */

//region Capture failures stay separate from ordinary extension error reporting

/** Original event traversal no longer matches its captured callback positions. */
export class NativeEventContractError extends Error {
  /** Stable category identifies the original event traversal boundary. */
  override readonly name = 'NativeEventContractError';
}

/** Internal propagation preserves primitive and nullish capture failures. */
export class NativeEventCaptureError extends Error {
  /** Stable category keeps observer failures out of extension diagnostics. */
  override readonly name = 'NativeEventCaptureError';
  /** Original thrown value remains private until the native method exits. */
  readonly #original: unknown;

  /**
   Retain the exact failure from the existing manager source pool.

   @param original - caught value whose identity must survive native error handling
   */
  constructor(original: unknown) {
    super('Original native event source capture failed');
    this.#original = original;
  }

  /**
   Distinguish this original wrapper without inspecting arbitrary error properties.

   @param value - native caught value

   @returns whether the value carries this observer's private failure slot
   */
  static isOriginal(value: unknown): value is NativeEventCaptureError {
    return value !== null && typeof value === 'object' && #original in value;
  }

  /**
   Unwrap only after the original native emission has been retired.

   @throws original capture failure without changing its identity
   */
  rethrow(): never {
    throw this.#original;
  }
}

//endregion Capture failures stay separate from ordinary extension error reporting
