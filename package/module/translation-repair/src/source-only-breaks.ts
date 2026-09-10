import type {
  Root,
  RootContent,
} from 'mdast';

import type { DeepReadonlyData, } from './readonly-data.ts';

//region Explicit source line structure
// A single-block poem can miss the blank-block verse heuristic. Its explicit
// breaks still belong to the source when no archive rendering exists to choose.

/**
 * Read-only syntax node borrowed from the shared document parser.
 */
type ReadonlyNode = DeepReadonlyData<RootContent>;

/**
 * Counts explicit rendered breaks within each top-level block.
 * Markdown hard breaks and intrinsic lowercase br elements are equivalent;
 * soft newlines, code, custom components and paragraph boundaries are not.
 *
 * @param root - already parsed skeleton tree, avoiding another grammar pass
 *
 * @returns Break counts aligned with skeleton block order
 *
 * @example
 * ```ts
 * const explicitBreaks = explicitBreakCounts({ root, });
 * ```
 */
export function explicitBreakCounts({ root, }: { readonly root: DeepReadonlyData<Root>; },): readonly number[] {
  return root.children
    .map(function countBlock(block,): number {
    /**
     * Owned work list grows as descendant nodes are visited.
     */
    const pending: ReadonlyNode[] = [block,];
    /**
     * Explicit breaks in this block, not in unrelated neighboring blocks.
     */
    let count = 0;
    for (const node of pending) {
      if (
        (node.type === 'break')
        || (((node.type === 'mdxJsxTextElement') || (node.type === 'mdxJsxFlowElement')) && (node.name === 'br'))
      )
        count += 1;
      if ('children' in node)
        pending.push(...node.children,);
    }
    return count;
  },);
}

/**
 * Refuses an explicit-break shortfall where the original alone sets the floor.
 * Nonempty archive text stays outside this check even if its parser found no
 * blocks. Expansion remains legal; unrelated blocks cannot compensate.
 *
 * @param pageText - canonical incumbent text, empty where no archive span exists
 *
 * @param source - original break counts, one per top-level block
 *
 * @param candidate - corresponding candidate counts
 *
 * @returns Model-facing findings for missing rendered breaks
 *
 * @example
 * ```ts
 * sourceOnlyBreakFindings({ pageText: '', source: [2], candidate: [0] });
 * ```
 */
export function sourceOnlyBreakFindings(
  {
    pageText,
    source,
    candidate,
  }: {
    readonly pageText: string;
    readonly source: readonly number[];
    readonly candidate: readonly number[];
  },
): readonly string[] {
  if (pageText !== '')
    return [];
  return source.flatMap(function compareBlock(
    owed,
    index,
  ): readonly string[] {
    /**
     * Missing blocks carry no breaks; the block floor diagnoses their shape.
     */
    const carried = candidate[index] ?? 0;
    if (carried >= owed)
      return [];
    return [
      `ORIGINAL block ${String(index + 1,)} carries ${String(owed,)} explicit line break(s), `
        + `but your corresponding block carries ${String(carried,)}. No archive rendering exists here. `
        + 'Keep at least the original count with Markdown hard breaks or intrinsic <br/> elements; '
        + 'soft newlines render as spaces and do not preserve these lines. Keep your chosen wording.',
    ];
  },);
}

//endregion Explicit source line structure
