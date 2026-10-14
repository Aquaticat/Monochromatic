/**
 Constructor ownership diagnostics retained from the earlier lifecycle module.
 Active root transitions belong to root-lifecycle-retirement-entry/lifecycle.mjs.

 @module
 */

//region Original constructor errors preserve their names and Error causes

/**
 Base category for failures to establish an original native root.
 */
export class RootLeaseError extends Error {
  /**
   Subclasses refine the diagnostic without changing standard Error construction.
   */
  override readonly name: string = 'RootLeaseError';
}

/**
 Manager did not originate from the fixed constructor owner.
 */
export class RootLeaseOwnershipError extends RootLeaseError {
  /**
   Preserve the native ownership diagnostic used by existing callers.
   */
  override readonly name = 'RootLeaseOwnershipError';
}

//endregion Original constructor errors preserve their names and Error causes
