import type {
  Context,
  Definition,
  ESTree,
  Scope,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  getImportDeclarationForDefinition,
  getSingleNonSpreadArgument,
  NO_IMPORT_DECLARATION,
  NO_SINGLE_ARGUMENT,
} from './ast-shared.ts';
import {
  NO_STATIC_SOURCE,
  NO_VARIABLE,
  type StaticSource,
  type VariableLookup,
} from './no-sync.constants.ts';

//region Static syntax extraction

/**
 * Extracts a static string value from an expression.
 *
 * @param expression - Expression that may be a string literal.
 *
 * @returns Literal string, or {@link NO_STATIC_SOURCE} when expression is
 * not a string literal.
 *
 * @example
 * ```ts
 * getStaticString({ expression: literalNode });
 * ```
 */
export function getStaticString(
  { expression, }: ForeignBorrowed<{ readonly expression: ESTree.Expression; }>,
): StaticSource {
  if (expression.type !== 'Literal')
    return NO_STATIC_SOURCE;
  if ((typeof expression.value) !== 'string')
    return NO_STATIC_SOURCE;
  return expression.value;
}

/**
 * Extracts a static property name from a property key.
 *
 * @param key - Property key node from member access, import, or object pattern syntax.
 *
 * @returns Static property name, or {@link NO_STATIC_SOURCE} when key is dynamic.
 *
 * @example
 * ```ts
 * getStaticPropertyName({ key: member.property });
 * ```
 */
export function getStaticPropertyName(
  { key, }: ForeignBorrowed<{ readonly key: ESTree.Node; }>,
): StaticSource {
  if (key.type === 'Identifier')
    return key.name;
  if (key.type !== 'Literal')
    return NO_STATIC_SOURCE;
  if ((typeof key.value) !== 'string')
    return NO_STATIC_SOURCE;
  return key.value;
}

/**
 * Extracts a static member property name, delegating non-private members to
 * {@link getStaticPropertyName}.
 *
 * @param member - Member expression being inspected.
 *
 * @returns Member property name, or {@link NO_STATIC_SOURCE} when member is
 * private or dynamic.
 *
 * @example
 * ```ts
 * getMemberName({ member: node.callee });
 * ```
 */
export function getMemberName(
  { member, }: ForeignBorrowed<{ readonly member: ESTree.MemberExpression; }>,
): StaticSource {
  if (member.property
    .type
    === 'PrivateIdentifier')
    return NO_STATIC_SOURCE;
  return getStaticPropertyName({ key: member.property, },);
}

/**
 * Returns first function argument when it is a string literal: the sole
 * argument is read via {@link getSingleNonSpreadArgument} and the literal
 * value via {@link getStaticString}.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Static source string, or {@link NO_STATIC_SOURCE} when call
 * shape is not supported (including {@link NO_SINGLE_ARGUMENT}).
 *
 * @example
 * ```ts
 * getSingleStringArgument({ call: requireCall });
 * ```
 */
export function getSingleStringArgument(
  { call, }: ForeignBorrowed<{ readonly call: ESTree.CallExpression; }>,
): StaticSource {
  /**
   * Sole ordinary argument of the call, when the call shape is supported.
   */
  const argument = getSingleNonSpreadArgument({ call, },);
  if (argument === NO_SINGLE_ARGUMENT)
    return NO_STATIC_SOURCE;
  return getStaticString({ expression: argument, },);
}

//endregion Static syntax extraction

//region Scope metadata extraction

/**
 * Finds a variable in a scope or one of its parents.
 *
 * @param scope - Scope lookup starts from.
 *
 * @param name - Identifier name to resolve.
 *
 * @returns Scope variable, or {@link NO_VARIABLE} when no binding exists.
 *
 * @example
 * ```ts
 * findVariableInScope({ scope, name: 'fs' });
 * ```
 */
function findVariableInScope(
  {
    scope,
    name,
  }: ForeignBorrowed<{
    readonly scope: Scope;
    readonly name: string;
  }>,
): VariableLookup {
  /**
   * Binding registered in this scope, or absent when lookup must continue upward.
   */
  const variable = scope.set
    .get(name,);
  if (variable !== undefined)
    return variable;
  /**
   * Parent scope, or `null` above global scope per oxlint's scope API.
   */
  const { upper, } = scope;
  if (upper === null)
    return NO_VARIABLE;
  return findVariableInScope({
    scope: upper,
    name,
  },);
}

/**
 * Finds a variable visible at a node by walking lexical scopes outward via
 * {@link findVariableInScope}.
 *
 * @param context - Oxlint rule context.
 *
 * @param node - Node whose scope should be used as lookup start.
 *
 * @param name - Identifier name to resolve.
 *
 * @returns Scope variable, or {@link NO_VARIABLE} when no binding exists.
 *
 * @example
 * ```ts
 * findVariable({ context, node, name: 'fs' });
 * ```
 */
export function findVariable(
  {
    context,
    node,
    name,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly node: ESTree.Node;
    readonly name: string;
  }>,
): VariableLookup {
  return findVariableInScope({
    scope: context.sourceCode
      .getScope(node,),
    name,
  },);
}

/**
 * Resolves enclosing import declaration for an import definition via
 * {@link getImportDeclarationForDefinition}, translating its
 * {@link NO_IMPORT_DECLARATION} sentinel to {@link NO_VARIABLE}.
 *
 * @param definition - Scope-manager definition produced for an import binding.
 *
 * @returns Import declaration, or {@link NO_VARIABLE} when scope metadata
 * is unexpected.
 *
 * @example
 * ```ts
 * const declaration = getImportDeclaration({ definition });
 * ```
 */
export function getImportDeclaration(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): ESTree.ImportDeclaration | typeof NO_VARIABLE {
  /**
   * Import declaration resolved from scope-manager definition metadata.
   */
  const declaration = getImportDeclarationForDefinition({ definition, },);
  if (declaration === NO_IMPORT_DECLARATION)
    return NO_VARIABLE;
  return declaration;
}

/**
 * Resolves variable declarator for a variable definition.
 *
 * @param definition - Scope-manager definition produced for a local variable.
 *
 * @returns Variable declarator, or {@link NO_VARIABLE} when scope metadata
 * is unexpected.
 *
 * @example
 * ```ts
 * const declarator = getVariableDeclarator({ definition });
 * ```
 */
export function getVariableDeclarator(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): ESTree.VariableDeclarator | typeof NO_VARIABLE {
  if (definition.node
    .type
    === 'VariableDeclarator')
    return definition.node;
  if (definition.parent === null)
    return NO_VARIABLE;
  if (definition.parent
    .type
    !== 'VariableDeclarator')
    return NO_VARIABLE;
  return definition.parent;
}

//endregion Scope metadata extraction
