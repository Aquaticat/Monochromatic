/**
 Diagnostics for original policy-input reference mismatches.

 @module
 */

/**
 Selected policy input does not belong to its required original request or owner.
 */
export class PolicyInputBindingError extends Error {
  /**
   Stable diagnostic identity shared with native policy capture.
   */
  override readonly name = 'PolicyInputBindingError';
}
