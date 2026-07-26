import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { RootContent, } from 'mdast';

//region Container unwrapping
// Corpus pages wrap material in disclosure elements: an `en` page collapses a
// whole trailing gallery into one `<details>`, while its `zh` counterpart
// carries the same blocks at top level. Because chunking and alignment walk
// TOP-LEVEL blocks only, that page counted 17 blocks against the original's 25,
// alignment degraded to proportional merging, and critics were handed
// non-corresponding material. The graded milestone-three sample scored the
// result as omissions of content that was present all along, merely nested.
//
// Flattening promotes a container's block children to peers so both sides
// expose comparable structure. Offsets are untouched: a promoted child keeps
// its own absolute span, and the container's opening and closing tags simply
// fall outside every promoted span, so they survive as inter-block text and
// offset-based splicing keeps working.
//
// Thirty of the pinned corpus's pages carry a disclosure element, so this is
// ordinary structure rather than one document's quirk.

/**
 * mdast types that stand alone as document blocks. A container holding any of
 * these is structural packaging around content, so its children are the real
 * blocks. Anything else (a `<summary>` holding only phrasing content) is a
 * block in its own right and stays whole.
 */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'code',
  'table',
  'thematicBreak',
  'footnoteDefinition',
  'mdxJsxFlowElement',
],);

/**
 * mdast types that can hold block children worth promoting. Restricted to JSX
 * flow elements because those are the only containers the pinned corpus uses
 * for packaging; list items and block quotes carry meaning of their own and
 * must never be dissolved.
 */
const CONTAINER_TYPE = 'mdxJsxFlowElement';

/**
 * A JSX flow element carrying block children. mdast's own `RootContent` union
 * has no member for JSX elements (they arrive from the MDX extension), so the
 * shape is named structurally, which is also all the walk needs.
 *
 * @example
 * ```ts
 * const container = node as BlockContainer;
 * ```
 */
type BlockContainer = {
  /**
   * Blocks the container packages, in source order.
   */
  readonly children: readonly ForeignBorrowed<RootContent>[];
};

/**
 * Whether a node carries the position offsets every later stage anchors
 * against. Parsed trees always do; a constructed one does not, and promoting
 * an unpositioned child would produce a block that cannot anchor an issue.
 *
 * @param node - candidate mdast node
 *
 * @returns Whether both start and end offsets are present
 *
 * @example
 * ```ts
 * if (isPositioned(child,)) { }
 * ```
 */
function isPositioned(node: ForeignBorrowed<RootContent>,): boolean {
  return ((node.position
    ?.start
    .offset)
    !== undefined)
    && ((node.position
      .end
      .offset)
      !== undefined);
}

/**
 * Whether a node is a container whose children should be promoted: a JSX flow
 * element holding at least one real block, every child positioned. A
 * self-closing component such as a photo scroll has no children and stays a
 * block, which is correct: it is content, not packaging.
 *
 * @param node - candidate mdast node
 *
 * @returns Whether the node packages blocks rather than being one
 *
 * @example
 * ```ts
 * if (isUnwrappableContainer(node,)) { }
 * ```
 */
function isUnwrappableContainer(
  node: ForeignBorrowed<RootContent>,
): node is ForeignBorrowed<RootContent> & BlockContainer {
  if (node.type !== CONTAINER_TYPE)
    return false;
  if (!('children' in node))
    return false;

  /**
   * Child blocks the container holds, empty for a self-closing element.
   */
  const { children, } = node as BlockContainer;
  return (children.length > 0)
    && children.every(isPositioned,)
    && children.some(function isBlock(child,) {
      return BLOCK_TYPES.has(child.type,);
    },);
}

/**
 * Promotes container children to top-level blocks, repeatedly, so a
 * disclosure nested inside a disclosure also flattens. Walks with an explicit
 * work stack rather than recursion, and preserves document order: a
 * container's children take its place exactly where it stood.
 *
 * @param children - top-level mdast blocks in source order
 *
 * @returns Blocks in source order with containers replaced by their children
 *
 * @example
 * ```ts
 * const blocks = flattenContainers({ children: root.children, },);
 * ```
 */
export function flattenContainers(
  { children, }: { readonly children: ForeignBorrowed<readonly RootContent[]>; },
): readonly ForeignBorrowed<RootContent>[] {
  /**
   * Blocks still to inspect, in reverse so popping yields document order.
   */
  const pending: ForeignBorrowed<RootContent>[] = [...children,].toReversed();

  /**
   * Flattened blocks in document order.
   */
  const flattened: ForeignBorrowed<RootContent>[] = [];
  while (pending.length > 0) {
    /**
     * Next block in document order, present by the loop condition.
     */
    const node = pending.pop();
    /* v8 ignore next 2 -- @preserve the loop condition guarantees an element */
    if (node === undefined)
      break;

    if (isUnwrappableContainer(node,)) {
      // Children replace the container in place, and go back through the
      // stack so a nested container flattens on a later turn.
      pending.push(...node.children
        .toReversed(),);
      continue;
    }
    flattened.push(node,);
  }
  return flattened;
}

//endregion Container unwrapping
