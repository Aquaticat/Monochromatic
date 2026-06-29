import type {
  Context,
  ESTree,
} from '@oxlint/plugins';

import {
  CALL_PROPERTY_NAME,
  ERROR_OBJECT_TAG,
  ERROR_OBJECT_TAG_TYPE_NAME,
  NOT_ERROR_DETECTION,
  OBJECT_TAG_TYPE_END_OFFSET,
  OBJECT_TAG_TYPE_PREFIX_LENGTH,
  PROTOTYPE_PROPERTY_NAME,
  SLICE_PROPERTY_NAME,
  TO_STRING_PROPERTY_NAME,
  type ErrorDetectionArgumentText,
} from './prefer-error-is-error.constants.ts';
import { isGlobalObjectConstructor, } from './prefer-error-is-error.globals.ts';
import {
  getSingleArgumentText,
  isStaticMemberNamed,
  unwrapParentheses,
} from './prefer-error-is-error.syntax.ts';

//region Object.prototype.toString call detection

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

//endregion Object.prototype.toString call detection

//region Whole tag comparison detection

/**
 * Extracts Error detector argument from whole Object tag comparison sides.
 *
 * @param context - Oxlint rule context.
 *
 * @param unwrappedLeft - Left side without redundant parentheses.
 *
 * @param unwrappedRight - Right side without redundant parentheses.
 *
 * @returns Tested value text, or sentinel when sides do not form a whole-tag check.
 *
 * @example
 * ```ts
 * getWholeObjectTagComparisonArgumentText({ context, unwrappedLeft, unwrappedRight });
 * ```
 */
function getWholeObjectTagComparisonArgumentText(
  {
    context,
    unwrappedLeft,
    unwrappedRight,
  }: {
    readonly context: Context;
    readonly unwrappedLeft: ESTree.Expression;
    readonly unwrappedRight: ESTree.Expression;
  },
): ErrorDetectionArgumentText {
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

//endregion Whole tag comparison detection

//region Parsed tag comparison detection

/**
 * Extracts a static numeric value from a numeric expression.
 *
 * @param expression - Expression to inspect.
 *
 * @returns Static numeric value, or sentinel when not a supported static number.
 *
 * @example
 * ```ts
 * getStaticNumber({ expression: node });
 * ```
 */
function getStaticNumber(
  { expression, }: { readonly expression: ESTree.Expression; },
): number | typeof NOT_ERROR_DETECTION {
  /**
   * Expression without redundant parentheses.
   */
  const unwrapped = unwrapParentheses({ expression, },);
  if ((unwrapped.type === 'Literal') && ((typeof unwrapped.value) === 'number'))
    return unwrapped.value;
  if (unwrapped.type !== 'UnaryExpression')
    return NOT_ERROR_DETECTION;
  if (unwrapped.operator !== '-')
    return NOT_ERROR_DETECTION;
  if (unwrapped.argument
    .type
    !== 'Literal')
    return NOT_ERROR_DETECTION;
  if ((typeof unwrapped.argument
    .value) !== 'number')
    return NOT_ERROR_DETECTION;
  return -unwrapped.argument
    .value;
}

/**
 * Checks whether a call uses slice arguments that extract `[object Type]`'s Type.
 *
 * @param call - Candidate slice call expression.
 *
 * @returns Whether call uses `slice(8, -1)`.
 *
 * @example
 * ```ts
 * hasObjectTagSliceArguments({ call: node });
 * ```
 */
function hasObjectTagSliceArguments(
  { call, }: { readonly call: ESTree.CallExpression; },
): boolean {
  if (call.arguments
    .length
    !== 2)
    return false;
  /**
   * First slice argument.
   */
  const [start, end,] = call.arguments;
  if ((start === undefined) || (end === undefined))
    return false;
  if ((start.type === 'SpreadElement') || (end.type === 'SpreadElement'))
    return false;
  return (getStaticNumber({ expression: start, }) === OBJECT_TAG_TYPE_PREFIX_LENGTH)
    && (getStaticNumber({ expression: end, }) === OBJECT_TAG_TYPE_END_OFFSET);
}

/**
 * Extracts argument text from `Object.prototype.toString.call(value).slice(8, -1)`.
 *
 * @param context - Oxlint rule context.
 *
 * @param call - Candidate parsed-tag call expression.
 *
 * @returns Tested value text, or sentinel when call expression does not match.
 *
 * @example
 * ```ts
 * getParsedObjectTagArgumentText({ context, call: node });
 * ```
 */
function getParsedObjectTagArgumentText(
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
    name: SLICE_PROPERTY_NAME,
  }))
    return NOT_ERROR_DETECTION;
  if (!hasObjectTagSliceArguments({ call, }))
    return NOT_ERROR_DETECTION;
  /**
   * Candidate Object.prototype.toString.call(value) source call.
   */
  const sourceCall = unwrapParentheses({ expression: call.callee
    .object, },);
  if (sourceCall.type !== 'CallExpression')
    return NOT_ERROR_DETECTION;
  return getObjectPrototypeToStringArgumentText({
    context,
    call: sourceCall,
  },);
}

/**
 * Extracts Error detector argument from parsed Object tag comparison sides.
 *
 * @param context - Oxlint rule context.
 *
 * @param unwrappedLeft - Left side without redundant parentheses.
 *
 * @param unwrappedRight - Right side without redundant parentheses.
 *
 * @returns Tested value text, or sentinel when sides do not form a parsed-tag check.
 *
 * @example
 * ```ts
 * getParsedObjectTagComparisonArgumentText({ context, unwrappedLeft, unwrappedRight });
 * ```
 */
function getParsedObjectTagComparisonArgumentText(
  {
    context,
    unwrappedLeft,
    unwrappedRight,
  }: {
    readonly context: Context;
    readonly unwrappedLeft: ESTree.Expression;
    readonly unwrappedRight: ESTree.Expression;
  },
): ErrorDetectionArgumentText {
  if ((unwrappedLeft.type === 'Literal')
    && (unwrappedLeft.value === ERROR_OBJECT_TAG_TYPE_NAME)) {
    if (unwrappedRight.type !== 'CallExpression')
      return NOT_ERROR_DETECTION;
    return getParsedObjectTagArgumentText({
      context,
      call: unwrappedRight,
    },);
  }
  if ((unwrappedRight.type === 'Literal')
    && (unwrappedRight.value === ERROR_OBJECT_TAG_TYPE_NAME)) {
    if (unwrappedLeft.type !== 'CallExpression')
      return NOT_ERROR_DETECTION;
    return getParsedObjectTagArgumentText({
      context,
      call: unwrappedLeft,
    },);
  }
  return NOT_ERROR_DETECTION;
}

//endregion Parsed tag comparison detection

//region Public Object tag comparison detection

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
export function getObjectTagComparisonArgumentText(
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
  /**
   * Whole `[object Error]` tag comparison, if present.
   */
  const wholeTagArgumentText = getWholeObjectTagComparisonArgumentText({
    context,
    unwrappedLeft,
    unwrappedRight,
  },);
  if ((typeof wholeTagArgumentText) !== 'symbol')
    return wholeTagArgumentText;
  return getParsedObjectTagComparisonArgumentText({
    context,
    unwrappedLeft,
    unwrappedRight,
  },);
}

//endregion Public Object tag comparison detection
