import type { ReadonlyDeep, } from 'type-fest';
import type {
  Nodes,
  Parents,
  Root,
} from 'mdast';

/**
 * MDX node types whose entire subtree is skipped in the MVP. A rule that walks
 * the tree never sees these nodes, nor their descendants (including any
 * standard Markdown authored inside a JSX element), which is how the
 * JSX-adjacency risk is handled without withholding a rule from `.mdx`.
 */
const MDX_NODE_TYPES: ReadonlySet<string> = new Set([
  'mdxjsEsm',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
],);

/**
 * One visited node together with the parent chain above it, root first. The
 * immediate parent is the last ancestor; a top-level node (direct child of the
 * root) has exactly one ancestor, the root.
 */
export type WalkEntry = {
  /**
   * Visited node, in document (pre-order) position.
   */
  readonly node: ReadonlyDeep<Nodes>;
  /**
   * Ancestors from the root down to the immediate parent, never empty.
   */
  readonly ancestors: readonly ReadonlyDeep<Parents>[];
};

/**
 * Whether a node can contain children, narrowing it to the parent union so its
 * `children` are typed.
 *
 * @param node - any mdast node
 *
 * @returns whether the node has a `children` array
 */
function isParent(node: ReadonlyDeep<Nodes>,): node is ReadonlyDeep<Parents> {
  return 'children' in node;
}

/**
 * Walk an mdast tree in document order, yielding every node except the root
 * paired with its ancestor chain. Traversal is an explicit work-stack rather
 * than recursion: a deeply nested blockquote or list spine cannot overflow the
 * call stack, matching the repo rule against recursing over potentially
 * degenerate input. MDX nodes and their subtrees are skipped wholesale.
 *
 * @param root - mdast root from {@link parse}
 *
 * @returns generator over each non-root node with its ancestors, root first
 *
 * @example
 * ```ts
 * for (const { node, ancestors } of walk(tree)) {
 *   if (node.type === 'heading') { ... }
 * }
 * ```
 */
export function* walk(root: ReadonlyDeep<Root>,): Generator<WalkEntry> {
  /**
   * Pending nodes paired with the ancestors above them. Seeded with the root's
   * children so the root itself is never yielded.
   */
  const stack: WalkEntry[] = [{
    node: root,
    ancestors: [],
  },];
  while (stack.length > 0) {
    /**
     * Frame popped from the work-stack; the loop guard guarantees it exists.
     */
    const frame = stack.pop();
    if (frame === undefined) {
      continue;
    }
    /**
     * Current node under inspection.
     */
    const { node, } = frame;
    /**
     * Ancestor chain above the current node.
     */
    const { ancestors, } = frame;
    if (node.type !== 'root') {
      yield frame;
    }
    if (MDX_NODE_TYPES.has(node.type,)) {
      continue;
    }
    if (!isParent(node,)) {
      continue;
    }
    /**
     * Ancestor chain for this node's children: the current node appended.
     */
    const childAncestors: readonly ReadonlyDeep<Parents>[] = [
      ...ancestors,
      node,
    ];
    // Push children in reverse so the LIFO stack pops them in document order.
    for (let index = node.children
      .length
      - 1; index >= 0; index -= 1) {
      /**
       * Child at the descending cursor; the index stays within bounds.
       */
      const child = node.children[index];
      if (child === undefined) {
        continue;
      }
      stack.push({
        node: child,
        ancestors: childAncestors,
      },);
    }
  }
}
