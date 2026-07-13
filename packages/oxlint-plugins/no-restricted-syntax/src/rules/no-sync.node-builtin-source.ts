import type {
  Context,
  ESTree,
  Variable,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

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
  }: ForeignBorrowed<{
    readonly seen: ReadonlySet<Variable>;
    readonly variable: Variable;
  }>,
): ReadonlySet<Variable> {
  /**
   * Fresh alias-visited set; keeps O(1) membership while isolating sibling branches.
   */
  const nextSeen = new Set(seen,);
  nextSeen.add(variable,);
  return nextSeen;
}

//endregion Seen-variable tracking

//region Node builtin loader calls

/**
 * Returns `true` when a call expression directly loads a Node builtin
 * source: the static source argument is read via
 * {@link getSingleStringArgument} (or, for the member-call shape, via
 * {@link getMemberName} and {@link getSingleStringArgument}), the receiver
 * is checked with {@link isUnshadowedGlobalIdentifier}, and the source with
 * {@link isNodeBuiltinSource}.
 *
 * @param context - Oxlint rule context.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Whether call is `require('<node builtin>')` or
 * `process.getBuiltinModule('<node builtin>')`.
 *
 * @example
 * ```ts
 * isNodeBuiltinSourceLoadCall({ context, call: requireCall });
 * ```
 */
function isNodeBuiltinSourceLoadCall(
  {
    context,
    call,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly call: ESTree.CallExpression;
  }>,
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
      === 'require')
      && isUnshadowedGlobalIdentifier({
        context,
        identifier: call.callee,
      },)
      && isNodeBuiltinSource({ source, },);
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
    === 'process')
    && isUnshadowedGlobalIdentifier({
      context,
      identifier: call.callee
        .object,
    },)
    && isNodeBuiltinSource({ source, },);
}

/**
 * Returns whether identifier is not shadowed by a local declaration,
 * resolved via {@link findVariable}.
 *
 * @param context - Oxlint rule context.
 *
 * @param identifier - Identifier reference to classify.
 *
 * @returns Whether identifier is unresolved or a global variable without local definitions.
 *
 * @example
 * ```ts
 * isUnshadowedGlobalIdentifier({ context, identifier: requireIdentifier });
 * ```
 */
function isUnshadowedGlobalIdentifier(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  /**
   * Scope variable behind the identifier, if oxlint scope metadata has one.
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

//endregion Node builtin loader calls

//region Node builtin source provenance

/**
 * Returns `true` when expression resolves to a Node builtin source object,
 * via {@link isNodeBuiltinSourceLoadCall} for call expressions or, after
 * resolving the identifier's binding with {@link findVariable}, via
 * {@link isNodeBuiltinSourceVariable}.
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
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<Variable>;
  }>,
): boolean {
  if (expression.type === 'CallExpression')
    return isNodeBuiltinSourceLoadCall({
      context,
      call: expression,
    },);
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
 * Marks the variable visited via {@link seenWith}, then resolves an import
 * binding via {@link getImportDeclaration} and {@link isNodeBuiltinSource},
 * or a local declarator via {@link getVariableDeclarator} and a recursive
 * {@link isNodeBuiltinSourceExpression} call on its initializer.
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
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly variable: Variable;
    readonly seen: ReadonlySet<Variable>;
  }>,
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
