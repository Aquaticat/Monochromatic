import type {
  Context,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  CONSTRUCTOR_PROPERTY_NAME,
  NOT_ERROR_DETECTION,
  type ErrorDetectionArgumentText,
  type ErrorDetectionReplacementResult,
} from './prefer-error-is-error.constants.ts';
import { isGlobalErrorConstructor, } from './prefer-error-is-error.globals.ts';
import { getObjectTagComparisonArgumentText, } from './prefer-error-is-error.object-tag.ts';
import {
  isStaticMemberNamed,
  unwrapParentheses,
} from './prefer-error-is-error.syntax.ts';

//region instanceof Error detection

/**
 * Extracts Error detector argument text from `value instanceof Error`,
 * confirming the right side via {@link isGlobalErrorConstructor}.
 *
 * @param context - Oxlint rule context.
 *
 * @param binary - Binary expression to inspect.
 *
 * @returns Tested value text, or {@link NOT_ERROR_DETECTION} when binary
 * expression does not match.
 *
 * @example
 * ```ts
 * getInstanceofErrorArgumentText({ context, binary: node });
 * ```
 */
export function getInstanceofErrorArgumentText(
  {
    context,
    binary,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly binary: ESTree.BinaryExpression;
  }>,
): ErrorDetectionArgumentText {
  if (binary.operator !== 'instanceof')
    return NOT_ERROR_DETECTION;
  if (!isGlobalErrorConstructor({
    context,
    expression: binary.right,
  }))
    return NOT_ERROR_DETECTION;
  return context.sourceCode
    .getText(binary.left,);
}

//endregion instanceof Error detection

//region constructor-property detection

/**
 * Extracts tested value text from `value.constructor === Error`: unwraps
 * both sides via {@link unwrapParentheses}, matches the
 * {@link CONSTRUCTOR_PROPERTY_NAME} member via {@link isStaticMemberNamed},
 * and confirms the other side via {@link isGlobalErrorConstructor}.
 *
 * @param context - Oxlint rule context.
 *
 * @param left - Left side of equality comparison.
 *
 * @param right - Right side of equality comparison.
 *
 * @returns Tested value text, or {@link NOT_ERROR_DETECTION} when sides do
 * not form constructor check.
 *
 * @example
 * ```ts
 * getConstructorComparisonArgumentText({ context, left: node.left, right: node.right });
 * ```
 */
function getConstructorComparisonArgumentText(
  {
    context,
    left,
    right,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly left: ESTree.Expression;
    readonly right: ESTree.Expression;
  }>,
): ErrorDetectionArgumentText {
  /**
   * Unwrapped left side for member and constructor inspection.
   */
  const unwrappedLeft = unwrapParentheses({ expression: left, },);
  /**
   * Unwrapped right side for member and constructor inspection.
   */
  const unwrappedRight = unwrapParentheses({ expression: right, },);
  if ((unwrappedLeft.type === 'MemberExpression')
    && isStaticMemberNamed({
      member: unwrappedLeft,
      name: CONSTRUCTOR_PROPERTY_NAME,
    })
    && isGlobalErrorConstructor({
      context,
      expression: unwrappedRight,
    }))
    return context.sourceCode
      .getText(unwrappedLeft.object,);
  if ((unwrappedRight.type === 'MemberExpression')
    && isStaticMemberNamed({
      member: unwrappedRight,
      name: CONSTRUCTOR_PROPERTY_NAME,
    })
    && isGlobalErrorConstructor({
      context,
      expression: unwrappedLeft,
    }))
    return context.sourceCode
      .getText(unwrappedRight.object,);
  return NOT_ERROR_DETECTION;
}

//endregion constructor-property detection

//region Equality detection

/**
 * Returns whether operator is an equality operator used by legacy detectors.
 *
 * @param operator - Binary operator to inspect.
 *
 * @returns Whether operator compares two values for equality or inequality.
 *
 * @example
 * ```ts
 * isEqualityOperator({ operator: node.operator });
 * ```
 */
function isEqualityOperator(
  { operator, }: { readonly operator: string; },
): boolean {
  return (operator === '===')
    || (operator === '!==')
    || (operator === '==')
    || (operator === '!=');
}

/**
 * Returns whether equality operator is negated.
 *
 * @param operator - Equality operator to inspect.
 *
 * @returns Whether operator means "is not equal".
 *
 * @example
 * ```ts
 * isNegatedEqualityOperator({ operator: node.operator });
 * ```
 */
export function isNegatedEqualityOperator(
  { operator, }: { readonly operator: string; },
): boolean {
  return (operator === '!==') || (operator === '!=');
}

/**
 * Extracts Error detector replacement metadata from legacy equality checks,
 * confirmed via {@link isEqualityOperator} and tried in order against
 * {@link getObjectTagComparisonArgumentText} and
 * {@link getConstructorComparisonArgumentText}.
 *
 * @param context - Oxlint rule context.
 *
 * @param binary - Binary expression to inspect.
 *
 * @returns Replacement metadata, or {@link NOT_ERROR_DETECTION} when binary
 * expression does not match.
 *
 * @example
 * ```ts
 * getEqualityDetectorReplacement({ context, binary: node });
 * ```
 */
export function getEqualityDetectorReplacement(
  {
    context,
    binary,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly binary: ESTree.BinaryExpression;
  }>,
): ErrorDetectionReplacementResult {
  if (!isEqualityOperator({ operator: binary.operator, }))
    return NOT_ERROR_DETECTION;
  /**
   * Object.prototype.toString-based detection argument, if matched.
   */
  const objectTagArgumentText = getObjectTagComparisonArgumentText({
    context,
    left: binary.left,
    right: binary.right,
  },);
  if ((typeof objectTagArgumentText) !== 'symbol')
    return {
      argumentText: objectTagArgumentText,
      fixKind: 'fix',
    };
  /**
   * Constructor-comparison detection argument, if matched.
   */
  const constructorArgumentText = getConstructorComparisonArgumentText({
    context,
    left: binary.left,
    right: binary.right,
  },);
  if ((typeof constructorArgumentText) === 'symbol')
    return NOT_ERROR_DETECTION;
  return {
    argumentText: constructorArgumentText,
    fixKind: 'suggestion',
  };
}

//endregion Equality detection
