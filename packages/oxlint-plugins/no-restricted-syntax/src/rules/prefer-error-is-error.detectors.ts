import type {
  Context,
  ESTree,
} from '@oxlint/plugins';

import {
  CALL_PROPERTY_NAME,
  CONSTRUCTOR_PROPERTY_NAME,
  ERROR_OBJECT_TAG,
  NOT_ERROR_DETECTION,
  PROTOTYPE_PROPERTY_NAME,
  TO_STRING_PROPERTY_NAME,
  type ErrorDetectionArgumentText,
  type ErrorDetectionReplacementResult,
} from './prefer-error-is-error.constants.ts';
import {
  isGlobalErrorConstructor,
  isGlobalObjectConstructor,
} from './prefer-error-is-error.globals.ts';
import {
  getSingleArgumentText,
  isStaticMemberNamed,
  unwrapParentheses,
} from './prefer-error-is-error.syntax.ts';

//region instanceof Error detection

/**
 * Extracts Error detector argument text from `value instanceof Error`.
 *
 * @param context - Oxlint rule context.
 *
 * @param binary - Binary expression to inspect.
 *
 * @returns Tested value text, or sentinel when binary expression does not match.
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
  }: {
    readonly context: Context;
    readonly binary: ESTree.BinaryExpression;
  },
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

//region Object.prototype.toString detection

/**
 * Extracts argument text from `Object.prototype.toString.call(value)`.
 *
 * @param context - Oxlint rule context.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Tested value text, or sentinel when call expression does not match.
 *
 * @example
 * ```ts
 * getObjectPrototypeToStringArgumentText({ context, call: node });
 * ```
 */
function getObjectPrototypeToStringArgumentText(
  {
    context,
    call,
  }: {
    readonly context: Context;
    readonly call: ESTree.CallExpression;
  },
): ErrorDetectionArgumentText {
  if (call.optional)
    return NOT_ERROR_DETECTION;
  if (call.callee
    .type
    !== 'MemberExpression')
    return NOT_ERROR_DETECTION;
  if (!isStaticMemberNamed({
    member: call.callee,
    name: CALL_PROPERTY_NAME,
  }))
    return NOT_ERROR_DETECTION;
  /**
   * Source text of value passed to Object.prototype.toString.call.
   */
  const argumentText = getSingleArgumentText({
    context,
    call,
  },);
  if ((typeof argumentText) === 'symbol')
    return NOT_ERROR_DETECTION;
  /**
   * Candidate `Object.prototype.toString` member expression.
   */
  const toStringMember = unwrapParentheses({ expression: call.callee
    .object, },);
  if (toStringMember.type !== 'MemberExpression')
    return NOT_ERROR_DETECTION;
  if (!isStaticMemberNamed({
    member: toStringMember,
    name: TO_STRING_PROPERTY_NAME,
  }))
    return NOT_ERROR_DETECTION;
  /**
   * Candidate `Object.prototype` member expression.
   */
  const prototypeMember = unwrapParentheses({ expression: toStringMember.object, },);
  if (prototypeMember.type !== 'MemberExpression')
    return NOT_ERROR_DETECTION;
  if (!isStaticMemberNamed({
    member: prototypeMember,
    name: PROTOTYPE_PROPERTY_NAME,
  }))
    return NOT_ERROR_DETECTION;
  if (!isGlobalObjectConstructor({
    context,
    expression: prototypeMember.object,
  }))
    return NOT_ERROR_DETECTION;
  return argumentText;
}

/**
 * Extracts Error detector argument text from an Object tag equality check.
 *
 * @param context - Oxlint rule context.
 *
 * @param left - Left side of equality comparison.
 *
 * @param right - Right side of equality comparison.
 *
 * @returns Tested value text, or sentinel when sides do not form an Error tag check.
 *
 * @example
 * ```ts
 * getObjectTagComparisonArgumentText({ context, left: node.left, right: node.right });
 * ```
 */
function getObjectTagComparisonArgumentText(
  {
    context,
    left,
    right,
  }: {
    readonly context: Context;
    readonly left: ESTree.Expression;
    readonly right: ESTree.Expression;
  },
): ErrorDetectionArgumentText {
  /**
   * Unwrapped left side for literal and call-shape inspection.
   */
  const unwrappedLeft = unwrapParentheses({ expression: left, },);
  /**
   * Unwrapped right side for literal and call-shape inspection.
   */
  const unwrappedRight = unwrapParentheses({ expression: right, },);
  if ((unwrappedLeft.type === 'Literal') && (unwrappedLeft.value === ERROR_OBJECT_TAG)) {
    if (unwrappedRight.type !== 'CallExpression')
      return NOT_ERROR_DETECTION;
    return getObjectPrototypeToStringArgumentText({
      context,
      call: unwrappedRight,
    },);
  }
  if ((unwrappedRight.type === 'Literal') && (unwrappedRight.value === ERROR_OBJECT_TAG)) {
    if (unwrappedLeft.type !== 'CallExpression')
      return NOT_ERROR_DETECTION;
    return getObjectPrototypeToStringArgumentText({
      context,
      call: unwrappedLeft,
    },);
  }
  return NOT_ERROR_DETECTION;
}

//endregion Object.prototype.toString detection

//region constructor-property detection

/**
 * Extracts tested value text from `value.constructor === Error`.
 *
 * @param context - Oxlint rule context.
 *
 * @param left - Left side of equality comparison.
 *
 * @param right - Right side of equality comparison.
 *
 * @returns Tested value text, or sentinel when sides do not form constructor check.
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
  }: {
    readonly context: Context;
    readonly left: ESTree.Expression;
    readonly right: ESTree.Expression;
  },
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
 * Extracts Error detector replacement metadata from legacy equality checks.
 *
 * @param context - Oxlint rule context.
 *
 * @param binary - Binary expression to inspect.
 *
 * @returns Replacement metadata, or sentinel when binary expression does not match.
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
  }: {
    readonly context: Context;
    readonly binary: ESTree.BinaryExpression;
  },
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
