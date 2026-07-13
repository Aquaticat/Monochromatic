import type {
  Context,
  Definition,
  ESTree,
  Variable,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  NOT_NODE_SYNC_CALLEE,
  SYNC_SUFFIX,
  type NodeSyncCalleeName,
  isNodeBuiltinSource,
} from './no-sync.constants.ts';
import {
  isNodeBuiltinSourceExpression,
  seenWith,
} from './no-sync.node-builtin-source.ts';
import { getNodeSyncMemberName, } from './no-sync.node-sync-member.ts';
import {
  getImportDeclaration,
  getStaticPropertyName,
  getVariableDeclarator,
} from './no-sync.syntax.ts';

//region Sync API from object-pattern bindings

/**
 * Finds sync API name bound by an object pattern variable: checks the
 * initializer via {@link isNodeBuiltinSourceExpression}, then delegates to
 * {@link getObjectPatternNodeSyncPropertyName}.
 *
 * @param context - Oxlint rule context.
 *
 * @param declarator - Variable declarator with an object pattern.
 *
 * @param variable - Variable being classified.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when pattern
 * does not bind one.
 *
 * @example
 * ```ts
 * getObjectPatternNodeSyncName({ context, declarator, variable, seen: new Set() });
 * ```
 */
function getObjectPatternNodeSyncName(
  {
    context,
    declarator,
    variable,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly declarator: ESTree.VariableDeclarator;
    readonly variable: Variable;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  if (declarator.id
    .type
    !== 'ObjectPattern')
    return NOT_NODE_SYNC_CALLEE;
  if (declarator.init === null)
    return NOT_NODE_SYNC_CALLEE;
  if (!isNodeBuiltinSourceExpression({
    context,
    expression: declarator.init,
    seen,
  }))
    return NOT_NODE_SYNC_CALLEE;
  return getObjectPatternNodeSyncPropertyName({
    pattern: declarator.id,
    variable,
  },);
}

/**
 * Finds sync API name among object-pattern properties: reads each property
 * key via {@link getStaticPropertyName} and keeps it only when it ends in
 * {@link SYNC_SUFFIX}.
 *
 * @param pattern - Object pattern being inspected.
 *
 * @param variable - Variable being classified.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when no
 * property matches.
 *
 * @example
 * ```ts
 * getObjectPatternNodeSyncPropertyName({ pattern, variable });
 * ```
 */
function getObjectPatternNodeSyncPropertyName(
  {
    pattern,
    variable,
  }: ForeignBorrowed<{
    readonly pattern: ESTree.ObjectPattern;
    readonly variable: Variable;
  }>,
): NodeSyncCalleeName {
  for (const property of pattern.properties) {
    if (property.type === 'RestElement')
      continue;
    if (property.value
      .type
      !== 'Identifier')
      continue;
    if (property.value
      .name
      !== variable.name)
      continue;
    /**
     * Object property name being destructured from the Node builtin source.
     */
    const propertyName = getStaticPropertyName({ key: property.key, },);
    if ((typeof propertyName) === 'symbol')
      return NOT_NODE_SYNC_CALLEE;
    if (!propertyName.endsWith(SYNC_SUFFIX,))
      return NOT_NODE_SYNC_CALLEE;
    return propertyName;
  }
  return NOT_NODE_SYNC_CALLEE;
}

//endregion Sync API from object-pattern bindings

//region Sync API from variable bindings

/**
 * Finds Node sync API name imported from a Node builtin source: resolves the
 * owning declaration via {@link getImportDeclaration}, checks its source via
 * {@link isNodeBuiltinSource}, reads the imported name via
 * {@link getStaticPropertyName}, and keeps it only when it ends in
 * {@link SYNC_SUFFIX}.
 *
 * @param definition - Import definition being classified.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when import
 * is not a sync API.
 *
 * @example
 * ```ts
 * getImportedNodeSyncName({ definition });
 * ```
 */
function getImportedNodeSyncName(
  { definition, }: ForeignBorrowed<{ readonly definition: Definition; }>,
): NodeSyncCalleeName {
  if (definition.node
    .type
    !== 'ImportSpecifier')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Import declaration that owns this named import.
   */
  const declaration = getImportDeclaration({ definition, },);
  if ((typeof declaration) === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  if (!isNodeBuiltinSource({ source: declaration.source
    .value, },))
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Imported property name from the Node builtin source.
   */
  const importedName = getStaticPropertyName({ key: definition.node
    .imported, },);
  if ((typeof importedName) === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  if (!importedName.endsWith(SYNC_SUFFIX,))
    return NOT_NODE_SYNC_CALLEE;
  return importedName;
}

/**
 * Finds Node sync API name represented by a local variable declarator: tries
 * {@link getObjectPatternNodeSyncName} first, then falls back to
 * {@link getNodeSyncMemberName} on the initializer.
 *
 * @param context - Oxlint rule context.
 *
 * @param declarator - Variable declarator being classified.
 *
 * @param variable - Variable to classify.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when
 * variable is not a sync API.
 *
 * @example
 * ```ts
 * getNodeSyncDeclaratorName({ context, declarator, variable, seen: new Set() });
 * ```
 */
function getNodeSyncDeclaratorName(
  {
    context,
    declarator,
    variable,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly declarator: ESTree.VariableDeclarator;
    readonly variable: Variable;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  /**
   * Sync API name from destructuring a Node builtin source object.
   */
  const objectPatternName = getObjectPatternNodeSyncName({
    context,
    declarator,
    variable,
    seen,
  },);
  if ((typeof objectPatternName) !== 'symbol')
    return objectPatternName;
  if (declarator.id
    .type
    !== 'Identifier')
    return NOT_NODE_SYNC_CALLEE;
  if (declarator.id
    .name
    !== variable.name)
    return NOT_NODE_SYNC_CALLEE;
  if (declarator.init === null)
    return NOT_NODE_SYNC_CALLEE;
  return getNodeSyncMemberName({
    context,
    expression: declarator.init,
    seen,
  },);
}

/**
 * Finds Node sync API name represented by a scope variable. Marks the
 * variable visited via {@link seenWith}, then resolves an import binding via
 * {@link getImportedNodeSyncName} or a local declarator via
 * {@link getVariableDeclarator} and {@link getNodeSyncDeclaratorName}.
 *
 * @param context - Oxlint rule context.
 *
 * @param variable - Variable to classify.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when
 * variable is not a sync API.
 *
 * @example
 * ```ts
 * getNodeSyncFunctionVariableName({ context, variable, seen: new Set() });
 * ```
 */
export function getNodeSyncFunctionVariableName(
  {
    context,
    variable,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly variable: Variable;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  if (seen.has(variable,))
    return NOT_NODE_SYNC_CALLEE;
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
    return NOT_NODE_SYNC_CALLEE;
  if (definition.type === 'ImportBinding')
    return getImportedNodeSyncName({ definition, },);
  if (definition.type !== 'Variable')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Variable declarator that introduced this binding.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if ((typeof declarator) === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  return getNodeSyncDeclaratorName({
    context,
    declarator,
    variable,
    seen: nextSeen,
  },);
}

//endregion Sync API from variable bindings
