/**
 Native construction failures retain the original diagnostic at their ownership boundary.

 @module
 */

/** SDK construction violated the original result, registration, or cleanup contract. */
export class NativeSessionRootError extends Error {
  override name = 'NativeSessionRootError';
}
