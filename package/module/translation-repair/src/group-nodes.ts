import type { DocumentNode, } from './document-node.ts';

//region Node grouping
// Partitioning one side's blocks into runs a slice can carry.
//
// ITS OWN MODULE so that both groupers can use it. `slice-pair.ts` carves
// section pairs and `group-source-first.ts` splits an untranslated passage by
// budget; while this lived in the first, the second could only reach it by
// importing the file that was about to import it back.

/**
 * Groups one side's nodes into paragraph-bound runs within budget.
 * A node longer than the budget forms its own run; nodes never split.
 *
 * @param nodes - block nodes of one side in document order
 *
 * @param budget - characters one run aims for
 *
 * @returns Node runs partitioning input order without splitting any node
 *
 * @example
 * ```ts
 * const runs = groupNodes({ nodes: chunk.nodes, budget: 400, },);
 * ```
 */
export function groupNodes(
  {
    nodes,
    budget,
  }: {
    readonly nodes: readonly DocumentNode[];
    readonly budget: number;
  },
): readonly (readonly DocumentNode[])[] {
  /**
   * Completed runs in document order.
   */
  const runs: DocumentNode[][] = [];

  /**
   * Characters accumulated in the open run.
   */
  let openChars = 0;
  for (const node of nodes) {
    /**
     * Span length of this node in document characters.
     */
    const nodeChars = node.endOffset - node.startOffset;

    /**
     * Currently open run, when any node was grouped already.
     */
    const open = runs.at(-1,);
    if ((open === undefined) || ((openChars + nodeChars) > budget)) {
      runs.push([node,],);
      openChars = nodeChars;
      continue;
    }
    open.push(node,);
    openChars += nodeChars;
  }
  return runs;
}

//endregion Node grouping
