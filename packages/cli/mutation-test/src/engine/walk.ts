/**
 * Iterative AST traversal with parent tracking.
 *
 * @example
 * ```ts
 * walk({ root: program, visit: ({ node }) => console.log(node.type) });
 * ```
 */

import type { EstreeNode, } from './types.ts';

/**
 * Work-stack entry pairing a node with its structural parent; the root
 * entry carries no parent.
 */
type WalkEntry = {
  readonly node: EstreeNode;
  readonly parent?: EstreeNode;
};

/**
 * Returns whether a value looks like an oxc ESTree node.
 *
 * @param value - Candidate value from a node property.
 *
 * @returns Whether value carries `type` plus span offsets.
 *
 * @example
 * ```ts
 * isEstreeNode({ type: 'Literal', start: 0, end: 1 });
 * // true
 * ```
 */
export function isEstreeNode(value: unknown,): value is EstreeNode {
  return (value !== null)
    && ((typeof value) === 'object')
    && ((typeof (value as { type?: unknown; }).type) === 'string')
    && ((typeof (value as { start?: unknown; }).start) === 'number')
    && ((typeof (value as { end?: unknown; }).end) === 'number');
}

/**
 * Walks every node reachable from root with an explicit work stack.
 *
 * Explicit stack instead of recursion so degenerate expression spines
 * (deeply chained binary expressions) cannot overflow the call stack.
 * Visit order is structural, not source order; operators must not rely
 * on ordering.
 *
 * @param options - Root node and visitor callback.
 *
 * @example
 * ```ts
 * walk({ root: program, visit: ({ node, parent }) => collect(node, parent) });
 * ```
 */
export function walk(options: {
  readonly root: EstreeNode;
  readonly visit: (entry: WalkEntry,) => void;
},): void {
  /**
   * Remaining nodes to visit with their parents.
   */
  const stack: WalkEntry[] = [{ node: options.root, },];

  while (stack.length > 0) {
    /**
     * Current node and parent popped off the work stack.
     */
    const entry = stack.pop();

    if (entry === undefined)
      break;

    options.visit(entry,);

    for (const [
      key,
      value,
    ] of Object.entries(entry.node,)) {
      if (key === 'type')
        continue;

      if (isEstreeNode(value,)) {
        stack.push({
          node: value,
          parent: entry.node,
        },);
        continue;
      }

      if (Array.isArray(value,)) {
        for (const item of value) {
          if (isEstreeNode(item,))
            stack.push({
              node: item,
              parent: entry.node,
            },);
        }
      }
    }
  }
}
