/**
 * Binary search for character offset within a line div.
 *
 * Given a line element and an x coordinate, collects all text nodes
 * and uses Range measurement to binary-search for the character
 * whose left edge is closest to the target x position.
 */

/**
 * Estimates the character offset within a line div closest to the x coordinate.
 * Uses a binary search with Range measurement for efficiency.
 *
 * @returns 0-based character offset
 */
export function findCharAtX({
  lineDiv,
  x,
}: {
  lineDiv: Element;
  x: number;
},): number {
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: textContent is null for Document/DocumentType nodes per spec
  const text = lineDiv.textContent ?? '';
  if (text.length === 0 || text === '\n')
    return 0;

  /** Get the first text node in the line. */
  const walker = document.createTreeWalker(
    lineDiv,
    NodeFilter.SHOW_TEXT,
  );
  const firstTextNode = walker.nextNode();
  if (firstTextNode === null)
    return 0;

  // Mutable accumulator is unavoidable here: TreeWalker is imperative and does not expose a functional iterator
  /** Collect all text nodes with cumulative offsets. */
  const textNodes: {
    node: Text;
    start: number;
    length: number;
  }[] = [];
  let total = 0;
  let current: Node | null = firstTextNode;
  while (current !== null) {
    const len = current.textContent?.length ?? 0;
    textNodes.push({
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- TreeWalker SHOW_TEXT yields Text nodes
      node: current as Text,
      start: total,
      length: len,
    },);
    total += len;
    current = walker.nextNode();
  }

  /** Binary search for the character whose midpoint is closest to x. */
  let lo = 0;
  let hi = total;
  const range = document.createRange();

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const {
      node,
      localOffset,
    } = resolveOffset({
      textNodes,
      offset: mid,
    },);
    range.setStart(
      node,
      localOffset,
    );
    range.setEnd(
      node,
      localOffset,
    );
    const rect = range.getBoundingClientRect();

    if (rect.left < x)
      lo = mid + 1;
    else
      hi = mid;
  }

  return lo;
}

/**
 * Resolves a global character offset to a text node and local offset.
 *
 * @returns text node and the local character offset within it
 */
function resolveOffset({
  textNodes,
  offset,
}: {
  textNodes: {
    node: Text;
    start: number;
    length: number;
  }[];
  offset: number;
},): {
  node: Text;
  localOffset: number;
} {
  for (const entry of textNodes) {
    if (offset <= entry.start + entry.length) {
      return {
        node: entry.node,
        localOffset: offset - entry.start,
      };
    }
  }
  /** Clamp to end of last text node. */
  const last = textNodes.at(-1,);
  if (last !== undefined) {
    return {
      node: last.node,
      localOffset: last.length,
    };
  }
  /** Fallback: should never reach here with non-empty text. */
  const [first,] = textNodes;
  if (first === undefined)
    throw new Error('resolveOffset called with empty textNodes',);
  return {
    node: first.node,
    localOffset: 0,
  };
}
