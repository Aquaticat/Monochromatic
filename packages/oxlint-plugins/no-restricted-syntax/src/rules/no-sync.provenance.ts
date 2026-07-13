import type {
  Context,
  ESTree,
  Variable,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  NOT_NODE_SYNC_CALLEE,
  type NodeSyncCalleeName,
} from './no-sync.constants.ts';
import { getNodeSyncFunctionVariableName, } from './no-sync.node-sync-binding.ts';
import { getNodeSyncMemberName, } from './no-sync.node-sync-member.ts';
import {
  findVariable,
  getMemberName,
} from './no-sync.syntax.ts';

//region Sync API from call callees

/**
 * Finds Node sync API name represented by a direct identifier callee:
 * resolves the binding via {@link findVariable}, then delegates to
 * {@link getNodeSyncFunctionVariableName}.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Identifier callee expression.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when callee
 * is not a sync API.
 *
 * @example
 * ```ts
 * getIdentifierNodeSyncCalleeName({ context, expression, seen: new Set() });
 * ```
 */
function getIdentifierNodeSyncCalleeName(
  {
    context,
    expression,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.IdentifierReference;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  /**
   * Scope variable behind the direct function call.
   */
  const variable = findVariable({
    context,
    node: expression,
    name: expression.name,
  },);
  if ((typeof variable) === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  return getNodeSyncFunctionVariableName({
    context,
    variable,
    seen,
  },);
}

/**
 * Finds Node sync API name represented by a member-expression callee: tries
 * {@link getNodeSyncMemberName} directly, then, for an `apply`/`call`
 * outer member read via {@link getMemberName}, retries
 * {@link getNodeSyncMemberName} on the receiver.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Member-expression callee.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when callee
 * is not a sync API.
 *
 * @example
 * ```ts
 * getMemberNodeSyncCalleeName({ context, expression, seen: new Set() });
 * ```
 */
function getMemberNodeSyncCalleeName(
  {
    context,
    expression,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.MemberExpression;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  /**
   * Direct member call result.
   */
  const directMemberName = getNodeSyncMemberName({
    context,
    expression,
    seen,
  },);
  if ((typeof directMemberName) !== 'symbol')
    return directMemberName;
  /**
   * Outer member name for chained calls such as `fs.readFileSync.apply(...)`.
   */
  const outerName = getMemberName({ member: expression, },);
  if (((typeof outerName) !== 'symbol')
    && ((outerName === 'apply') || (outerName === 'call')))
    return getNodeSyncMemberName({
      context,
      expression: expression.object,
      seen,
    },);
  return NOT_NODE_SYNC_CALLEE;
}

/**
 * Finds Node sync API name represented by a call callee expression, via
 * {@link getIdentifierNodeSyncCalleeName} or {@link getMemberNodeSyncCalleeName}.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Call callee expression.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when callee
 * is not a sync API.
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
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
  }>,
): NodeSyncCalleeName {
  /**
   * Variables visited while resolving this callee.
   */
  const seen = new Set<Variable>();
  if (expression.type === 'Identifier')
    return getIdentifierNodeSyncCalleeName({
      context,
      expression,
      seen,
    },);
  if (expression.type !== 'MemberExpression')
    return NOT_NODE_SYNC_CALLEE;
  return getMemberNodeSyncCalleeName({
    context,
    expression,
    seen,
  },);
}

//endregion Sync API from call callees
