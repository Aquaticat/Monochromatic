/** Errors at the test-owned mocking seam. @module */

/**
 Signals an operation that cannot preserve sandbox ownership.

 @example
 ```ts
 throw new SandboxOwnershipError('ctx.sinon.stub belongs to completed test "saves"');
 ```
 */
export class SandboxOwnershipError extends Error {
  /** Distinguishes harness ownership diagnostics from ordinary Sinon errors. */
  override readonly name = 'SandboxOwnershipError';
}
