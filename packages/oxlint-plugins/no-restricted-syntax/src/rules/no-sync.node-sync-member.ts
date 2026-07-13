import type {
  Context,
  ESTree,
  Variable,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  NOT_NODE_SYNC_CALLEE,
  SYNC_SUFFIX,
  type NodeSyncCalleeName,
} from './no-sync.constants.ts';
import { isNodeBuiltinSourceExpression, } from './no-sync.node-builtin-source.ts';
import { getMemberName, } from './no-sync.syntax.ts';

//region Sync API from member expressions

/**
 * Finds sync API name from a Node builtin source member expression: reads
 * the property via {@link getMemberName}, keeps it only when it ends in
 * {@link SYNC_SUFFIX}, and confirms the receiver via
 * {@link isNodeBuiltinSourceExpression}.
 *
 * @param context - Oxlint rule context.
 *
 * @param expression - Initializer or call-callee expression.
 *
 * @param seen - Variables already inspected, preventing alias cycles.
 *
 * @returns Node sync API name, or {@link NOT_NODE_SYNC_CALLEE} when
 * expression is not a sync member.
 *
 * @example
 * ```ts
 * getNodeSyncMemberName({ context, expression: init, seen: new Set() });
 * ```
 */
export function getNodeSyncMemberName(
  {
    context,
    expression,
    seen,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<Variable>;
  }>,
): NodeSyncCalleeName {
  if (expression.type !== 'MemberExpression')
    return NOT_NODE_SYNC_CALLEE;
  /**
   * Member property name being called or aliased.
   */
  const propertyName = getMemberName({ member: expression, },);
  if ((typeof propertyName) === 'symbol')
    return NOT_NODE_SYNC_CALLEE;
  if (!propertyName.endsWith(SYNC_SUFFIX,))
    return NOT_NODE_SYNC_CALLEE;
  if (!isNodeBuiltinSourceExpression({
    context,
    expression: expression.object,
    seen,
  }))
    return NOT_NODE_SYNC_CALLEE;
  return propertyName;
}

//endregion Sync API from member expressions
