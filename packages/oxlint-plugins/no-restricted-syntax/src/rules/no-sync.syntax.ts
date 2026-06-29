import type {
  Context,
  ESTree,
} from '@oxlint/plugins';

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
 * @returns Literal string, or sentinel when expression is not a string literal.
 *
 * @example
 * ```ts
 * getStaticString({ expression: literalNode });
 * ```
 */
export function getStaticString(
  { expression, }: { readonly expression: ESTree.Expression; },
): StaticSource {
  if (expression.type
    !== 'Literal')
    return NO_STATIC_SOURCE;
  if ((typeof expression.value)
    !== 'string')
    return NO_STATIC_SOURCE;
  return expression.value;
}

/**
 * Extracts a static property name from a property key.
 *
 * @param key - Property key node from member access, import, or object pattern syntax.
 *
 * @returns Static property name, or sentinel when key is dynamic.
 *
 * @example
 * ```ts
 * getStaticPropertyName({ key: member.property });
 * ```
 */
export function getStaticPropertyName(
  { key, }: { readonly key: ESTree.Node; },
): StaticSource {
  if (key.type
    === 'Identifier')
    return key.name;
  if (key.type
    !== 'Literal')
    return NO_STATIC_SOURCE;
  if ((typeof key.value)
    !== 'string')
    return NO_STATIC_SOURCE;
  return key.value;
}

/**
 * Extracts a static member property name.
 *
 * @param member - Member expression being inspected.
 *
 * @returns Member property name, or sentinel when member is private or dynamic.
 *
 * @example
 * ```ts
 * getMemberName({ member: node.callee });
 * ```
 */
export function getMemberName(
  { member, }: { readonly member: ESTree.MemberExpression; },
): StaticSource {
  if (member.property.type
    === 'PrivateIdentifier')
    return NO_STATIC_SOURCE;
  return getStaticPropertyName({ key: member.property, },);
}

/**
 * Returns first function argument when it is a string literal.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Static source string, or sentinel when call shape is not supported.
 *
 * @example
 * ```ts
 * getSingleStringArgument({ call: requireCall });
 * ```
 */
export function getSingleStringArgument(
  { call, }: { readonly call: ESTree.CallExpression; },
): StaticSource {
  if (call.arguments.length
    !== 1)
    return NO_STATIC_SOURCE;
  /**
   * Sole call argument.
   */
  const [argument,] = call.arguments;
  if (argument === undefined)
    return NO_STATIC_SOURCE;
  if (argument.type
    === 'SpreadElement')
    return NO_STATIC_SOURCE;
  return getStaticString({ expression: argument, },);
}

//endregion Static syntax extraction

//region Scope metadata extraction

/**
 * Finds a variable visible at a node by walking lexical scopes outward.
 *
 * @param context - Oxlint rule context.
 *
 * @param node - Node whose scope should be used as lookup start.
 *
 * @param name - Identifier name to resolve.
 *
 * @returns Scope variable, or sentinel when no binding exists.
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
  }: {
    readonly context: Context;
    readonly node: ESTree.Node;
    readonly name: string;
  },
): VariableLookup {
  /**
   * Current lexical scope cursor.
   */
  let scope = context.sourceCode
    .getScope(node,);
  while (true) {
    /**
     * Binding registered in this scope, or absent when lookup must continue upward.
     */
    const variable = scope.set.get(name,);
    if (variable !== undefined)
      return variable;
    /**
     * Parent scope, or `null` above global scope per oxlint's scope API.
     */
    const upperScope = scope.upper;
    if (upperScope === null)
      return NO_VARIABLE;
    scope = upperScope;
  }
}

/**
 * Resolves enclosing import declaration for an import definition.
 *
 * @param definition - Scope-manager definition produced for an import binding.
 *
 * @returns Import declaration, or sentinel when scope metadata is unexpected.
 *
 * @example
 * ```ts
 * const declaration = getImportDeclaration({ definition });
 * ```
 */
export function getImportDeclaration(
  { definition, }: { readonly definition: ESTree.Definition; },
): ESTree.ImportDeclaration | typeof NO_VARIABLE {
  /**
   * Definition node itself for whole-declaration imports,
   * or parent for individual specifiers.
   */
  const declaration = definition.node.type
    === 'ImportDeclaration'
    ? definition.node
    : definition.node.parent;
  if (declaration === null)
    return NO_VARIABLE;
  if (declaration.type
    !== 'ImportDeclaration')
    return NO_VARIABLE;
  return declaration;
}

/**
 * Resolves variable declarator for a variable definition.
 *
 * @param definition - Scope-manager definition produced for a local variable.
 *
 * @returns Variable declarator, or sentinel when scope metadata is unexpected.
 *
 * @example
 * ```ts
 * const declarator = getVariableDeclarator({ definition });
 * ```
 */
export function getVariableDeclarator(
  { definition, }: { readonly definition: ESTree.Definition; },
): ESTree.VariableDeclarator | typeof NO_VARIABLE {
  if (definition.node.type
    === 'VariableDeclarator')
    return definition.node;
  if (definition.parent === null)
    return NO_VARIABLE;
  if (definition.parent.type
    !== 'VariableDeclarator')
    return NO_VARIABLE;
  return definition.parent;
}

//endregion Scope metadata extraction
