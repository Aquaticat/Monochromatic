import type {
  Context,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  ERROR_CONSTRUCTOR_NAME,
  GLOBAL_THIS_NAME,
  OBJECT_CONSTRUCTOR_NAME,
} from './prefer-error-is-error.constants.ts';
import {
  getIdentifierNamed,
  getStaticMemberName,
  isUnshadowedGlobalIdentifier,
  unwrapParentheses,
} from './prefer-error-is-error.syntax.ts';

//region Global constructor detection

/**
 * Checks whether expression is global `Error` or `globalThis.Error`: matches
 * the {@link ERROR_CONSTRUCTOR_NAME} and {@link GLOBAL_THIS_NAME} identifiers
 * via {@link getIdentifierNamed} and {@link getStaticMemberName} (after
 * unwrapping via {@link unwrapParentheses}), and confirms each via
 * {@link isUnshadowedGlobalIdentifier}.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Expression to inspect.
 *
 * @returns Whether expression names the global Error constructor.
 *
 * @example
 * ```ts
 * isGlobalErrorConstructor({ context, expression: node.right });
 * ```
 */
export function isGlobalErrorConstructor(
  {
    context,
    expression,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
  }>,
): boolean {
  /**
   * Direct global Error identifier, if present.
   */
  const errorIdentifier = getIdentifierNamed({
    expression,
    name: ERROR_CONSTRUCTOR_NAME,
  },);
  if ((typeof errorIdentifier) !== 'symbol')
    return isUnshadowedGlobalIdentifier({
      context,
      identifier: errorIdentifier,
    },);
  /**
   * Expression without redundant parentheses.
   */
  const unwrapped = unwrapParentheses({ expression, },);
  if (unwrapped.type !== 'MemberExpression')
    return false;
  if (unwrapped.optional)
    return false;
  /**
   * Static property read from the member expression.
   */
  const propertyName = getStaticMemberName({ member: unwrapped, },);
  if (propertyName !== ERROR_CONSTRUCTOR_NAME)
    return false;
  /**
   * globalThis identifier backing the member expression.
   */
  const globalThisIdentifier = getIdentifierNamed({
    expression: unwrapped.object,
    name: GLOBAL_THIS_NAME,
  },);
  if ((typeof globalThisIdentifier) === 'symbol')
    return false;
  return isUnshadowedGlobalIdentifier({
    context,
    identifier: globalThisIdentifier,
  },);
}

/**
 * Checks whether expression is the global `Object` constructor: matches
 * {@link OBJECT_CONSTRUCTOR_NAME} via {@link getIdentifierNamed} and
 * confirms it via {@link isUnshadowedGlobalIdentifier}.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Expression to inspect.
 *
 * @returns Whether expression names the unshadowed global Object constructor.
 *
 * @example
 * ```ts
 * isGlobalObjectConstructor({ context, expression: node.object });
 * ```
 */
export function isGlobalObjectConstructor(
  {
    context,
    expression,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
  }>,
): boolean {
  /**
   * Direct global Object identifier, if present.
   */
  const objectIdentifier = getIdentifierNamed({
    expression,
    name: OBJECT_CONSTRUCTOR_NAME,
  },);
  if ((typeof objectIdentifier) === 'symbol')
    return false;
  return isUnshadowedGlobalIdentifier({
    context,
    identifier: objectIdentifier,
  },);
}

//endregion Global constructor detection
