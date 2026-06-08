import type { Nodes, } from 'mdast';

/**
 * Concatenated plain text of a node's subtree: the `value` of every `text` and
 * `inlineCode` descendant, in document order. This recovers a heading's or
 * paragraph's rendered text without `mdast-util-to-string` (whose parameter is
 * a mutable node), walking iteratively so a degenerate subtree cannot overflow
 * the stack.
 *
 * @param root - node whose subtree text is collected
 *
 * @returns concatenated descendant text
 *
 * @example
 * ```ts
 * collectText(headingNode); // 'Section 2: Setup'
 * ```
 */
export function collectText(root: Nodes,): string {
  /**
   * Text fragments gathered in document order; joined on return.
   */
  const parts: string[] = [];
  /**
   * Work-stack of nodes still to inspect, seeded with the root.
   */
  const stack: Nodes[] = [root,];
  while (stack.length > 0) {
    /**
     * Node currently inspected; the loop guard guarantees it exists.
     */
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if ((node.type === 'text') || (node.type === 'inlineCode')) {
      parts.push(node.value,);
    }
    if ('children' in node) {
      // Push children in reverse (on a copy) so the LIFO stack pops them in
      // document order without mutating the tree.
      for (const child of node.children
        .toReversed()) {
        stack.push(child,);
      }
    }
  }
  return parts.join('',);
}
