import type {
  Context,
  Definition,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  ERROR_IS_ERROR_CALLEE,
  NOT_ERROR_DETECTION,
  type ErrorDetectionArgumentText,
} from './prefer-error-is-error.constants.ts';
import {
  getImportDeclarationForDefinition,
  getSingleNonSpreadArgument,
  getStaticMemberName as getSharedStaticMemberName,
  NO_IMPORT_DECLARATION,
  NO_SINGLE_ARGUMENT,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';
import { findVariable, } from './no-sync.syntax.ts';

//region Expression helpers

/**
 * Removes parenthesized-expression wrappers from an expression.
 *
 * @param expression - Expression to unwrap.
 *
 * @returns Inner expression once no parenthesized wrapper remains.
 *
 * @example
 * ```ts
 * unwrapParentheses({ expression: node.left });
 * ```
 */
export function unwrapParentheses(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): ESTree.Expression {
  if (expression.type !== 'ParenthesizedExpression')
    return expression;
  return unwrapParentheses({ expression: expression.expression, },);
}

/**
 * Extracts named identifier from an expression, after unwrapping it via
 * {@link unwrapParentheses}.
 *
 * @param expression - Expression to inspect.
 *
 * @param name - Expected identifier name.
 *
 * @returns Identifier node, or {@link NOT_ERROR_DETECTION} when expression
 * is not the named identifier.
 *
 * @example
 * ```ts
 * getIdentifierNamed({ expression: node.right, name: 'Error' });
 * ```
 */
export function getIdentifierNamed(
  {
    expression,
    name,
  }: ForeignBorrowed<{
    readonly expression: ESTree.Expression;
    readonly name: string;
  }>,
): ESTree.IdentifierReference | typeof NOT_ERROR_DETECTION {
  /**
   * Expression without redundant parentheses.
   */
  const unwrapped = unwrapParentheses({ expression, },);
  if (unwrapped.type !== 'Identifier')
    return NOT_ERROR_DETECTION;
  if (unwrapped.name !== name)
    return NOT_ERROR_DETECTION;
  return unwrapped;
}

/**
 * Extracts a static property name from a member expression via the shared
 * {@link getSharedStaticMemberName} helper, mapping its
 * {@link NO_STATIC_MEMBER_NAME} sentinel to this rule's own.
 *
 * @param member - Member expression to inspect.
 *
 * @returns Property name, or {@link NOT_ERROR_DETECTION} when property is
 * private or dynamic.
 *
 * @example
 * ```ts
 * getStaticMemberName({ member: node.callee });
 * ```
 */
export function getStaticMemberName(
  { member, }: ForeignBorrowed<{ readonly member: ESTree.MemberExpression; }>,
): string | typeof NOT_ERROR_DETECTION {
  /**
   * Shared static member name result; mapped to this rule's sentinel below.
   */
  const memberName = getSharedStaticMemberName({ member, },);
  if (memberName === NO_STATIC_MEMBER_NAME)
    return NOT_ERROR_DETECTION;
  return memberName;
}

/**
 * Returns whether member expression reads a named property, via
 * {@link getStaticMemberName}.
 *
 * @param member - Member expression to inspect.
 *
 * @param name - Expected static property name.
 *
 * @returns Whether member reads the expected property without optional chaining.
 *
 * @example
 * ```ts
 * isStaticMemberNamed({ member: node.callee, name: 'call' });
 * ```
 */
export function isStaticMemberNamed(
  {
    member,
    name,
  }: ForeignBorrowed<{
    readonly member: ESTree.MemberExpression;
    readonly name: string;
  }>,
): boolean {
  if (member.optional)
    return false;
  return getStaticMemberName({ member, }) === name;
}

//endregion Expression helpers

//region Scope and import helpers

/**
 * Checks whether an identifier resolves to a global binding rather than a
 * local declaration, resolved via {@link findVariable}.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier to classify.
 *
 * @returns Whether identifier is global or unresolved in local scope metadata.
 *
 * @example
 * ```ts
 * isUnshadowedGlobalIdentifier({ context, identifier: errorIdentifier });
 * ```
 */
export function isUnshadowedGlobalIdentifier(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  /**
   * Scope variable visible for the identifier.
   */
  const variable = findVariable({
    context,
    node: identifier,
    name: identifier.name,
  },);
  if ((typeof variable) === 'symbol')
    return true;
  return variable.defs
    .length
    === 0;
}

/**
 * Returns the first import definition for an identifier expression, after
 * resolving its scope variable via {@link findVariable}.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier to resolve.
 *
 * @returns Import definition, or {@link NOT_ERROR_DETECTION} when identifier
 * does not resolve to an import.
 *
 * @example
 * ```ts
 * getImportDefinition({ context, identifier: node.callee });
 * ```
 */
export function getImportDefinition(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): Definition | typeof NOT_ERROR_DETECTION {
  /**
   * Scope variable for the identifier.
   */
  const variable = findVariable({
    context,
    node: identifier,
    name: identifier.name,
  },);
  if ((typeof variable) === 'symbol')
    return NOT_ERROR_DETECTION;
  /**
   * First definition for the resolved variable.
   */
  const [definition,] = variable.defs;
  if (definition === undefined)
    return NOT_ERROR_DETECTION;
  if (definition.type !== 'ImportBinding')
    return NOT_ERROR_DETECTION;
  return definition;
}

/**
 * Returns import declaration source for an import definition, resolved via
 * {@link getImportDeclarationForDefinition} and translating its
 * {@link NO_IMPORT_DECLARATION} sentinel to {@link NOT_ERROR_DETECTION}.
 *
 * @param definition - Import definition to inspect.
 *
 * @returns Import declaration source, or {@link NOT_ERROR_DETECTION} when
 * metadata is unexpected.
 *
 * @example
 * ```ts
 * getImportSource({ definition });
 * ```
 */
export function getImportSource(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): string | typeof NOT_ERROR_DETECTION {
  /**
   * Import declaration owning the binding definition.
   */
  const declaration = getImportDeclarationForDefinition({ definition, },);
  if (declaration === NO_IMPORT_DECLARATION)
    return NOT_ERROR_DETECTION;
  return declaration.source
    .value;
}

/**
 * Returns whether named import definition imports a specific binding name.
 *
 * @param definition - Import definition to inspect.
 *
 * @param importedName - Expected imported binding name.
 *
 * @returns Whether definition is a named import for importedName.
 *
 * @example
 * ```ts
 * isNamedImport({ definition, importedName: 'types' });
 * ```
 */
export function isNamedImport(
  {
    definition,
    importedName,
  }: ForeignBorrowed<{
    readonly definition: Definition;
    readonly importedName: string;
  }>,
): boolean {
  if (definition.node
    .type
    !== 'ImportSpecifier')
    return false;
  if (definition.node
    .imported
    .type
    === 'Identifier')
    return definition.node
      .imported
      .name
      === importedName;
  if (definition.node
    .imported
    .type
    !== 'Literal')
    return false;
  return definition.node
    .imported
    .value
    === importedName;
}

//endregion Scope and import helpers

//region Fix helpers

/**
 * Returns text for a single non-spread call argument, located via
 * {@link getSingleNonSpreadArgument}.
 *
 * @param context - Oxlint rule context.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Argument source text, or {@link NOT_ERROR_DETECTION} when call
 * shape is unsupported (including {@link NO_SINGLE_ARGUMENT}).
 *
 * @example
 * ```ts
 * getSingleArgumentText({ context, call: node });
 * ```
 */
export function getSingleArgumentText(
  {
    context,
    call,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly call: ESTree.CallExpression;
  }>,
): ErrorDetectionArgumentText {
  /**
   * Sole ordinary argument of the call, when the detector shape is supported.
   */
  const argument = getSingleNonSpreadArgument({ call, },);
  if (argument === NO_SINGLE_ARGUMENT)
    return NOT_ERROR_DETECTION;
  return context.sourceCode
    .getText(argument,);
}

/**
 * Builds canonical replacement source for a detected Error value expression,
 * using the {@link ERROR_IS_ERROR_CALLEE} callee.
 *
 * @param argumentText - Source text for value being tested.
 *
 * @returns `Error.isError(value,)` call source.
 *
 * @example
 * ```ts
 * buildErrorIsErrorCall({ argumentText: 'error' });
 * ```
 */
export function buildErrorIsErrorCall(
  { argumentText, }: { readonly argumentText: string; },
): string {
  return `${ERROR_IS_ERROR_CALLEE}(${argumentText},)`;
}

//endregion Fix helpers
