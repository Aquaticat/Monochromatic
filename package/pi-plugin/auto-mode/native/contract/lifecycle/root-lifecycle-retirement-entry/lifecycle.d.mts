/**
 Typed consumers share the incumbent lifecycle's original error constructor identity.

 @module
 */

/** Original lifecycle failures retain their cause and native error identity. */
export class RootLeaseError extends Error {
  /** Preserve the original diagnostic and optional cause. */
  constructor(
    message: string,
    options?: ErrorOptions
  );
}

/** Missing ownership or a foreign native root cannot issue a lifecycle lease. */
export class RootLeaseOwnershipError extends RootLeaseError {
  /** Preserve inherited native diagnostic construction. */
  constructor(message: string, options?: ErrorOptions);
}

/** A suspended root cannot be consumed until its original transition completes. */
export class RootLeaseSuspendedError extends RootLeaseError {
  /** Preserve inherited native diagnostic construction. */
  constructor(message: string, options?: ErrorOptions);
}

/** A retired root cannot regain currentness through a copied or retained handle. */
export class RootLeaseRetiredError extends RootLeaseError {
  /** Preserve inherited native diagnostic construction. */
  constructor(message: string, options?: ErrorOptions);
}

/** Invalid transitions retain the original lifecycle error lineage. */
export class RootTransitionError extends RootLeaseError {
  /** Preserve inherited native diagnostic construction. */
  constructor(message: string, options?: ErrorOptions);
}
