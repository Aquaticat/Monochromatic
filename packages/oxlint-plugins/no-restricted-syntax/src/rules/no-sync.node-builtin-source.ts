import type {
  Context,
  ESTree,
  Variable,
} from '@oxlint/plugins';

import { isNodeBuiltinSource, } from './no-sync.constants.ts';
import {
  findVariable,
  getImportDeclaration,
  getMemberName,
  getSingleStringArgument,
  getVariableDeclarator,
} from './no-sync.syntax.ts';

//region Seen-variable tracking

/**
 * Returns new seen-variable set including one additional variable.
 *
 * @param seen - Existing seen-variable set.
 *
 * @param variable - Variable to add.
 *
 * @returns New seen-variable set.
 *
 * @example
 * ```ts
 * const nextSeen = seenWith({ seen, variable });
 * ```
 */
export function seenWith(
  {
    seen,
    variable,
  }: {
    readonly seen: ReadonlySet<Variable>;
    readonly variable: Variable;
  },
): ReadonlySet<Variable> {
  /**
   * Fresh alias-visited set; keeps O(1) membership while isolating sibling branches.
   */
  const nextSeen = new Set(seen,);
  // oxlint-disable-next-line unicorn/no-immediate-mutation -- Existing seen values already arrive as a Set; array-spread initialization would add avoidable linear allocation in alias-resolution code, while mutating this fresh local Set preserves Set membership behavior.
  nextSeen.add(variable,);
  return nextSeen;
}

//endregion Seen-variable tracking

//region Node builtin loader calls

/**
 * Returns `true` when a call expression directly loads a Node builtin source.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Whether call is `require('<node builtin>')` or
 * `process.getBuiltinModule('<node builtin>')`.
 *
 * @example
 * ```ts
 * isNodeBuiltinSourceLoadCall({ call: requireCall });
 * ```
 */
function isNodeBuiltinSourceLoadCall(
  { call, }: { readonly call: ESTree.CallExpression; },
): boolean {
  /**
   * Static source argument shared by both accepted call shapes.
   */
  const source = getSingleStringArgument({ call, },);
  if ((typeof source) === 'symbol')
    return false;
  if (call.callee
    .type
    === 'Identifier')
    return (call.callee
      .name
      === 'require') && isNodeBuiltinSource({ source, },);
  if (call.callee
    .type
    !== 'MemberExpression')
    return false;
  /**
   * Static method name on call target.
   */
  const methodName = getMemberName({ member: call.callee, },);
  if (((typeof methodName) === 'symbol') || (methodName !== 'getBuiltinModule'))
    return false;
  if (call.callee
    .object
    .type
    !== 'Identifier')
    return false;
  return (call.callee
    .object
    .name
    === 'process') && isNodeBuiltinSource({ source, },);
}

//endregion Node builtin loader calls

//region Node builtin source provenance

/**
 * Returns `true` when expression resolves to a Node builtin source object.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Expression to inspect.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Whether expression is a Node builtin source object.
 *
 * @example
 * ```ts
 * isNodeBuiltinSourceExpression({ context, expression: fsIdentifier, seen: new Set() });
 * ```
 */
export function isNodeBuiltinSourceExpression(
  {
    context,
    expression,
    seen,
  }: {
    readonly context: Context;
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<Variable>;
  },
): boolean {
  if (expression.type === 'CallExpression')
    return isNodeBuiltinSourceLoadCall({ call: expression, },);
  if (expression.type !== 'Identifier')
    return false;
  /**
   * Scope variable behind source-object identifier.
   */
  const variable = findVariable({
    context,
    node: expression,
    name: expression.name,
  },);
  if ((typeof variable) === 'symbol')
    return false;
  return isNodeBuiltinSourceVariable({
    context,
    variable,
    seen,
  },);
}

/**
 * Returns `true` when scope variable is a Node builtin source object.
 *
 * @param context - Oxlint rule context.
 *
 * @param variable - Variable to classify.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Whether variable represents a Node builtin source object.
 *
 * @example
 * ```ts
 * isNodeBuiltinSourceVariable({ context, variable, seen: new Set() });
 * ```
 */
function isNodeBuiltinSourceVariable(
  {
    context,
    variable,
    seen,
  }: {
    readonly context: Context;
    readonly variable: Variable;
    readonly seen: ReadonlySet<Variable>;
  },
): boolean {
  if (seen.has(variable,))
    return false;
  /**
   * Seen set extended with this variable before following aliases.
   */
  const nextSeen = seenWith({
    seen,
    variable,
  },);
  /**
   * First definition site for variable.
   */
  const [definition,] = variable.defs;
  if (definition === undefined)
    return false;
  if (definition.type === 'ImportBinding') {
    if ((definition.node
      .type
      !== 'ImportDefaultSpecifier')
      && (definition.node
        .type
        !== 'ImportNamespaceSpecifier'))
      return false;
    /**
     * Import declaration that owns default or namespace import.
     */
    const declaration = getImportDeclaration({ definition, },);
    if ((typeof declaration) === 'symbol')
      return false;
    return isNodeBuiltinSource({ source: declaration.source
      .value, },);
  }
  if (definition.type !== 'Variable')
    return false;
  /**
   * Variable declarator that introduced this binding.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if ((typeof declarator) === 'symbol')
    return false;
  if (declarator.id
    .type
    !== 'Identifier')
    return false;
  if (declarator.id
    .name
    !== variable.name)
    return false;
  if (declarator.init === null)
    return false;
  return isNodeBuiltinSourceExpression({
    context,
    expression: declarator.init,
    seen: nextSeen,
  },);
}

//endregion Node builtin source provenance
