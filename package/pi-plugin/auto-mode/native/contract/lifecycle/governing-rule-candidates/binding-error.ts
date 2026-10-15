/**
 Original source binding failures preserve their diagnostic category and cause. @module
 */

/**
 Missing, changed, or unsupported original governing-source membership.
 */
export class GoverningRuleBindingError extends Error {
  /**
   Preserve the original constructor's diagnostic category, including derived construction.
   */
  override readonly name: string = this.constructor.name;
}
