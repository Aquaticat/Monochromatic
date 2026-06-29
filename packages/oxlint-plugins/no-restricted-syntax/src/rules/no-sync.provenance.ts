import type {
  Context,
  ESTree,
  Variable,
} from '@oxlint/plugins';

import {
  NOT_NODE_SYNC_CALLEE,
  SYNC_SUFFIX,
  type NodeSyncCalleeName,
  isNodeBuiltinSource,
} from './no-sync.constants.ts';
import {
  findVariable,
  getImportDeclaration,
  getMemberName,
  getSingleStringArgument,
  getStaticPropertyName,
  getVariableDeclarator,
} from './no-sync.syntax.ts';

//region Node module provenance

/**
 * Returns `true` when a call expression directly loads a Node builtin module.
 *
 * @param call - Call expression to inspect.
 *
 * @returns Whether call is `require('<node builtin>')` or
 * `process.getBuiltinModule('<node builtin>')`.
 *
 * @example
 * ```ts
 * isNodeBuiltinModuleCall({ call: requireCall });
 * ```
 */
function isNodeBuiltinModuleCall(
  { call, }: { readonly call: ESTree.CallExpression; },
): boolean {
  /**
   * Static source argument shared by both accepted call shapes.
   */
  const source = getSingleStringArgument({ call, },);
  if (typeof source === 'symbol')
    return false;
  if (call.callee.type
    === 'Identifier') {
    return (call.callee.name
      === 'require') && isNodeBuiltinSource({ source, },);
  }
  if (call.callee.type
    !== 'MemberExpression')
    return false;
  /**
   * Static method name on call target.
   */
  const methodName = getMemberName({ member: call.callee, },);
  if ((typeof methodName === 'symbol') || (methodName
    !== 'getBuiltinModule'))
    return false;
  if (call.callee.object.type
    !== 'Identifier')
    return false;
  return (call.callee.object.name
    === 'process') && isNodeBuiltinSource({ source, },);
}

/**
 * Returns `true` when expression resolves to a Node builtin module object.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Expression to inspect.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Whether expression is a Node builtin module object.
 *
 * @example
 * ```ts
 * isNodeBuiltinModuleExpression({ context, expression: fsIdentifier, seen: new Set() });
 * ```
 */
function isNodeBuiltinModuleExpression(
  {
    context,
    expression,
    seen,
  }: {
    readonly context: Context;
    readonly expression: ESTree.Expression;
    readonly seen: Set<Variable>;
  },
): boolean {
  if (expression.type
    === 'CallExpression')
    return isNodeBuiltinModuleCall({ call: expression, },);
  if (expression.type
    !== 'Identifier')
    return false;
  /**
   * Scope variable behind module-object identifier.
   */
  const variable = findVariable({
    context,
    node: expression,
    name: expression.name,
  },);
  if (typeof variable === 'symbol')
    return false;
  return isNodeBuiltinModuleVariable({
    context,
    variable,
    seen,
  },);
}

/**
 * Returns `true` when a scope variable is a Node builtin module object.
 *
 * @param context - Oxlint rule context.
 *
 * @param variable - Variable to classify.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Whether variable represents a Node builtin module object.
 *
 * @example
 * ```ts
 * isNodeBuiltinModuleVariable({ context, variable, seen: new Set() });
 * ```
 */
function isNodeBuiltinModuleVariable(
  {
    context,
    variable,
    seen,
  }: {
    readonly context: Context;
    readonly variable: Variable;
    readonly seen: Set<Variable>;
  },
): boolean {
  if (seen.has(variable,))
    return false;
  seen.add(variable,);
  /**
   * First definition site for variable.
   */
  const [definition,] = variable.defs;
  if (definition === undefined)
    return false;
  if (definition.type
    === 'ImportBinding') {
    if ((definition.node.type
      !== 'ImportDefaultSpecifier') && (definition.node.type
        !== 'ImportNamespaceSpecifier'))
      return false;
    /**
     * Import declaration that owns default or namespace import.
     */
    const declaration = getImportDeclaration({ definition, },);
    if (typeof declaration === 'symbol')
      return false;
    return isNodeBuiltinSource({ source: declaration.source.value, },);
  }
  if (definition.type
    !== 'Variable')
    return false;
  /**
   * Variable declarator that introduced this binding.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if (typeof declarator === 'symbol')
    return false;
  if (declarator.id.type
    !== 'Identifier')
    return false;
  if (declarator.id.name
    !== variable.name)
    return false;
  if (declarator.init === null)
    return false;
  return isNodeBuiltinModuleExpression({
    context,
    expression: declarator.init,
    seen,
  },);
}

//endregion Node module provenance

//region Sync API provenance

/**
 * Finds sync API name bound by an object pattern variable.
 *
 * @param context - Oxlint rule context.
 *
 * @param declarator - Variable declarator with an object pattern.
 *
 * @param variable - Variable being classified.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or sentinel when pattern does not bind one.
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
  }: {
    readonly context: Context;
    readonly declarator: ESTree.VariableDeclarator;
    readonly variable: Variable;
    readonly seen: Set<Variable>;
  },
): NodeSyncCalleeName {
  if (declarator.id.type
    !== 'ObjectPattern')
    return NOT_NODE_SYNC_CALLEE;
  if (declarator.init === null)
    return NOT_NODE_SYNC_CALLEE;
  if (!isNodeBuiltinModuleExpression({
    context,
    expression: declarator.init,
    seen,
  }))
    return NOT_NODE_SYNC_CALLEE;
  for (const property of declarator.id.properties) {
    if (property.type
      === 'RestElement')
      continue;
    if (property.value.type
      !== 'Identifier')
      continue;
    if (property.value.name
      !== variable.name)
      continue;
    /**
     * Object property name being destructured from the Node module.
     */
    const propertyName = getStaticPropertyName({ key: property.key, },);
    if (typeof propertyName === 'symbol')
      return NOT_NODE_SYNC_CALLEE;
    if (!propertyName.endsWith(SYNC_SUFFIX,))
      return NOT_NODE_SYNC_CALLEE;
    return propertyName;
  }
  return NOT_NODE_SYNC_CALLEE;
}

/**
 * Finds sync API name from a Node member alias initializer.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Initializer expression.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or sentinel when initializer is not a sync member.
 *
 * @example
 * ```ts
 * getNodeSyncMemberName({ context, expression: init, seen: new Set() });
 * ```
 */
function getNodeSyncMemberName(
  {
    context,
    expression,
    seen,
  }: {
    readonly context: Context;
    readonly expression: ESTree.Expression;
    readonly seen: Set<Variable>;
  },
): NodeSyncCalleeName {
  if (expression.type
    !== 'MemberExpression')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Member property name being called or aliased.
   */
  const propertyName = getMemberName({ member: expression, },);
  if (typeof propertyName === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  if (!propertyName.endsWith(SYNC_SUFFIX,))
    return NOT_NODE_SYNC_CALLEE;
  if (!isNodeBuiltinModuleExpression({
    context,
    expression: expression.object,
    seen,
  }))
    return NOT_NODE_SYNC_CALLEE;
  return propertyName;
}

/**
 * Finds Node sync API name represented by a scope variable.
 *
 * @param context - Oxlint rule context.
 *
 * @param variable - Variable to classify.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or sentinel when variable is not a sync API.
 *
 * @example
 * ```ts
 * getNodeSyncFunctionVariableName({ context, variable, seen: new Set() });
 * ```
 */
function getNodeSyncFunctionVariableName(
  {
    context,
    variable,
    seen,
  }: {
    readonly context: Context;
    readonly variable: Variable;
    readonly seen: Set<Variable>;
  },
): NodeSyncCalleeName {
  if (seen.has(variable,))
    return NOT_NODE_SYNC_CALLEE;
  seen.add(variable,);
  /**
   * First definition site for variable.
   */
  const [definition,] = variable.defs;
  if (definition === undefined)
    return NOT_NODE_SYNC_CALLEE;
  if (definition.type
    === 'ImportBinding') {
    if (definition.node.type
      !== 'ImportSpecifier')
      return NOT_NODE_SYNC_CALLEE;
    /**
     * Import declaration that owns this named import.
     */
    const declaration = getImportDeclaration({ definition, },);
    if (typeof declaration === 'symbol')
      return NOT_NODE_SYNC_CALLEE;
    if (!isNodeBuiltinSource({ source: declaration.source.value, },))
      return NOT_NODE_SYNC_CALLEE;
    /**
     * Imported property name from the Node module.
     */
    const importedName = getStaticPropertyName({ key: definition.node.imported, },);
    if (typeof importedName === 'symbol')
      return NOT_NODE_SYNC_CALLEE;
    if (!importedName.endsWith(SYNC_SUFFIX,))
      return NOT_NODE_SYNC_CALLEE;
    return importedName;
  }
  if (definition.type
    !== 'Variable')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Variable declarator that introduced this binding.
   */
  const declarator = getVariableDeclarator({ definition, },);
  if (typeof declarator === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Sync API name from destructuring a Node module object.
   */
  const objectPatternName = getObjectPatternNodeSyncName({
    context,
    declarator,
    variable,
    seen,
  },);
  if (typeof objectPatternName !== 'symbol')
    return objectPatternName;
  if (declarator.id.type
    !== 'Identifier')
    return NOT_NODE_SYNC_CALLEE;
  if (declarator.id.name
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
 * Finds Node sync API name represented by a call callee expression.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Call callee expression.
 *
 * @returns Node sync API name, or sentinel when callee is not a sync API.
 *
 * @example
 * ```ts
 * getNodeSyncCalleeName({ context, expression: node.callee });
 * ```
 */
export function getNodeSyncCalleeName(
  {
    context,
    expression,
  }: {
    readonly context: Context;
    readonly expression: ESTree.Expression;
  },
): NodeSyncCalleeName {
  /**
   * Variables visited while resolving this callee.
   */
  const seen = new Set<Variable>();
  if (expression.type
    === 'Identifier') {
    /**
     * Scope variable behind the direct function call.
     */
    const variable = findVariable({
      context,
      node: expression,
      name: expression.name,
    },);
    if (typeof variable === 'symbol')
      return NOT_NODE_SYNC_CALLEE;
    return getNodeSyncFunctionVariableName({
      context,
      variable,
      seen,
    },);
  }
  if (expression.type
    !== 'MemberExpression')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Direct member call result.
   */
  const directMemberName = getNodeSyncMemberName({
    context,
    expression,
    seen,
  },);
  if (typeof directMemberName !== 'symbol')
    return directMemberName;
  /**
   * Outer member name for chained calls such as `fs.readFileSync.apply(...)`.
   */
  const outerName = getMemberName({ member: expression, },);
  if ((typeof outerName !== 'symbol')
    && ((outerName === 'apply') || (outerName === 'call')))
    return getNodeSyncMemberName({
      context,
      expression: expression.object,
      seen,
    },);
  return NOT_NODE_SYNC_CALLEE;
}

//endregion Sync API provenance
