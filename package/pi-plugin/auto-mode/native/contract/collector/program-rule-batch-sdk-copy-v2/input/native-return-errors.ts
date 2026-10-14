/**
 Native return contract failures remain distinct from ordinary tool failures.

 @module
 */

//region Return ownership and supported modalities have separate diagnostics

/** Original invocation or return association is missing or inconsistent. */
export class NativeReturnContractError extends Error {
  /** Stable category identifies the native custody boundary. */
  override readonly name = 'NativeReturnContractError';
}

/** Native conversion succeeded but its result cannot bind the declared string profile. */
export class UnsupportedScriptBindingError extends Error {
  /** Stable category identifies the unsupported converted modality. */
  override readonly name = 'UnsupportedScriptBindingError';

  /**
   Name the native value category that cannot enter the bounded string binding.

   @param kind - observed conversion modality or oversized-string diagnosis
   */
  constructor(kind: string) {
    super(`Native script conversion returned ${kind}; this result-binding profile requires a bounded string`);
  }
}

//endregion Return ownership and supported modalities have separate diagnostics
