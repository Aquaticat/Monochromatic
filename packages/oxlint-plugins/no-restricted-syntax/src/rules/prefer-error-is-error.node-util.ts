import type {
  Context,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from './foreign-borrowed.ts';

import {
  IS_NATIVE_ERROR_PROPERTY_NAME,
  NODE_PROTOCOL_UTIL_SOURCE,
  NODE_PROTOCOL_UTIL_TYPES_SOURCE,
  NODE_UTIL_SOURCE,
  NODE_UTIL_TYPES_SOURCE,
  NOT_ERROR_DETECTION,
  TYPES_PROPERTY_NAME,
  type ErrorDetectionArgumentText,
} from './prefer-error-is-error.constants.ts';
import {
  getImportDefinition,
  getImportSource,
  getSingleArgumentText,
  isNamedImport,
  isStaticMemberNamed,
  unwrapParentheses,
} from './prefer-error-is-error.syntax.ts';

//region Node util source classification

/**
 * Checks whether import source names Node util.
 *
 * @param source - Import source text.
 *
 * @returns Whether source is {@link NODE_UTIL_SOURCE} or
 * {@link NODE_PROTOCOL_UTIL_SOURCE}.
 *
 * @example
 * ```ts
 * isNodeUtilSource({ source: 'node:util' });
 * ```
 */
function isNodeUtilSource(
  { source, }: { readonly source: string; },
): boolean {
  return (source === NODE_UTIL_SOURCE) || (source === NODE_PROTOCOL_UTIL_SOURCE);
}

/**
 * Checks whether import source names Node util/types.
 *
 * @param source - Import source text.
 *
 * @returns Whether source is {@link NODE_UTIL_TYPES_SOURCE} or
 * {@link NODE_PROTOCOL_UTIL_TYPES_SOURCE}.
 *
 * @example
 * ```ts
 * isNodeUtilTypesSource({ source: 'node:util/types' });
 * ```
 */
function isNodeUtilTypesSource(
  { source, }: { readonly source: string; },
): boolean {
  return (source === NODE_UTIL_TYPES_SOURCE)
    || (source === NODE_PROTOCOL_UTIL_TYPES_SOURCE);
}

//endregion Node util source classification

//region Node util import classification

/**
 * Checks whether identifier resolves to Node util module object: resolves
 * the binding via {@link getImportDefinition}, reads its source via
 * {@link getImportSource}, and tests it via {@link isNodeUtilSource}.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier to resolve.
 *
 * @returns Whether identifier is a default or namespace import from Node util.
 *
 * @example
 * ```ts
 * isNodeUtilImportIdentifier({ context, identifier: utilIdentifier });
 * ```
 */
function isNodeUtilImportIdentifier(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  /**
   * Import definition behind the identifier.
   */
  const definition = getImportDefinition({
    context,
    identifier,
  },);
  if ((typeof definition) === 'symbol')
    return false;
  if ((definition.node
    .type
    !== 'ImportDefaultSpecifier')
    && (definition.node
      .type
      !== 'ImportNamespaceSpecifier'))
    return false;
  /**
   * Source string for the import declaration.
   */
  const source = getImportSource({ definition, },);
  return ((typeof source) !== 'symbol') && isNodeUtilSource({ source, });
}

/**
 * Checks whether identifier resolves to Node util/types module object:
 * resolves the binding via {@link getImportDefinition} and its source via
 * {@link getImportSource}, then matches either {@link isNodeUtilTypesSource}
 * directly or {@link isNodeUtilSource} plus a named
 * {@link TYPES_PROPERTY_NAME} import (via {@link isNamedImport}).
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier to resolve.
 *
 * @returns Whether identifier is a util/types object or `types` from util.
 *
 * @example
 * ```ts
 * isNodeUtilTypesImportIdentifier({ context, identifier: typesIdentifier });
 * ```
 */
function isNodeUtilTypesImportIdentifier(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  /**
   * Import definition behind the identifier.
   */
  const definition = getImportDefinition({
    context,
    identifier,
  },);
  if ((typeof definition) === 'symbol')
    return false;
  /**
   * Source string for the import declaration.
   */
  const source = getImportSource({ definition, },);
  if ((typeof source) === 'symbol')
    return false;
  if (isNodeUtilTypesSource({ source, }))
    return (definition.node
      .type
      === 'ImportDefaultSpecifier')
      || (definition.node
        .type
        === 'ImportNamespaceSpecifier');
  return isNodeUtilSource({ source, })
    && isNamedImport({
      definition,
      importedName: TYPES_PROPERTY_NAME,
    });
}

/**
 * Checks whether expression is a Node util/types object, after unwrapping
 * via {@link unwrapParentheses}: a bare identifier via
 * {@link isNodeUtilTypesImportIdentifier}, or a {@link TYPES_PROPERTY_NAME}
 * member (via {@link isStaticMemberNamed}) on a util import (via
 * {@link isNodeUtilImportIdentifier}).
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Expression to inspect.
 *
 * @returns Whether expression resolves to Node util/types.
 *
 * @example
 * ```ts
 * isNodeUtilTypesExpression({ context, expression: node.callee.object });
 * ```
 */
function isNodeUtilTypesExpression(
  {
    context,
    expression,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
  }>,
): boolean {
  /**
   * Expression without redundant parentheses.
   */
  const unwrapped = unwrapParentheses({ expression, },);
  if (unwrapped.type === 'Identifier')
    return isNodeUtilTypesImportIdentifier({
      context,
      identifier: unwrapped,
    });
  if (unwrapped.type !== 'MemberExpression')
    return false;
  if (!isStaticMemberNamed({
    member: unwrapped,
    name: TYPES_PROPERTY_NAME,
  }))
    return false;
  /**
   * Member object without redundant parentheses.
   */
  const object = unwrapParentheses({ expression: unwrapped.object, },);
  if (object.type !== 'Identifier')
    return false;
  return isNodeUtilImportIdentifier({
    context,
    identifier: object,
  });
}

/**
 * Checks whether direct callee is `isNativeError` imported from util/types:
 * resolves the binding via {@link getImportDefinition} and its source via
 * {@link getImportSource}, then confirms it via
 * {@link isNodeUtilTypesSource} and a named
 * {@link IS_NATIVE_ERROR_PROPERTY_NAME} import (via {@link isNamedImport}).
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Callee identifier to inspect.
 *
 * @returns Whether identifier is the deprecated Node helper.
 *
 * @example
 * ```ts
 * isDirectIsNativeErrorImport({ context, identifier: node.callee });
 * ```
 */
function isDirectIsNativeErrorImport(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  /**
   * Import definition behind the direct callee.
   */
  const definition = getImportDefinition({
    context,
    identifier,
  },);
  if ((typeof definition) === 'symbol')
    return false;
  /**
   * Source string for the direct import.
   */
  const source = getImportSource({ definition, },);
  return ((typeof source) !== 'symbol')
    && isNodeUtilTypesSource({ source, })
    && isNamedImport({
      definition,
      importedName: IS_NATIVE_ERROR_PROPERTY_NAME,
    });
}

//endregion Node util import classification

//region isNativeError call detection

/**
 * Extracts Error detector argument text from Node `isNativeError()` calls:
 * reads the argument via {@link getSingleArgumentText} and confirms the
 * callee via {@link isDirectIsNativeErrorImport} (direct import) or
 * {@link isStaticMemberNamed} plus {@link isNodeUtilTypesExpression}
 * (member call).
 *
 * @param context - Oxlint rule context.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Tested value text, or {@link NOT_ERROR_DETECTION} when call
 * expression does not match.
 *
 * @example
 * ```ts
 * getIsNativeErrorArgumentText({ context, call: node });
 * ```
 */
export function getIsNativeErrorArgumentText(
  {
    context,
    call,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly call: ESTree.CallExpression;
  }>,
): ErrorDetectionArgumentText {
  if (call.optional)
    return NOT_ERROR_DETECTION;
  /**
   * Source text of value passed to isNativeError.
   */
  const argumentText = getSingleArgumentText({
    context,
    call,
  },);
  if ((typeof argumentText) === 'symbol')
    return NOT_ERROR_DETECTION;
  /**
   * Call target without redundant parentheses.
   */
  const callee = unwrapParentheses({ expression: call.callee, },);
  if (callee.type === 'Identifier') {
    if (isDirectIsNativeErrorImport({
      context,
      identifier: callee,
    }))
      return argumentText;
    return NOT_ERROR_DETECTION;
  }
  if (callee.type !== 'MemberExpression')
    return NOT_ERROR_DETECTION;
  if (!isStaticMemberNamed({
    member: callee,
    name: IS_NATIVE_ERROR_PROPERTY_NAME,
  }))
    return NOT_ERROR_DETECTION;
  if (!isNodeUtilTypesExpression({
    context,
    expression: callee.object,
  }))
    return NOT_ERROR_DETECTION;
  return argumentText;
}

//endregion isNativeError call detection
