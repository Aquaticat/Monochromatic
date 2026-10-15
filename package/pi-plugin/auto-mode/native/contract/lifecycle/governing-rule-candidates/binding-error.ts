/**
 Original source binding failures preserve their diagnostic category and cause. @module
 */

/**
 Missing, changed, or unsupported original governing-source membership.
 */
export class GoverningRuleBindingError extends Error {
  /**
   Stable original binding diagnostic category.
   */
  override readonly name: string = 'GoverningRuleBindingError';
}
