import type { ChunkPair, } from './chunk-document.ts';
import type { DocumentNode, } from './document-node.ts';

//region Slice coverage
// The one thing slicing cannot prove about itself: that carving a chunk pair
// into slices kept every block of it.
//
// `assertSpanContiguity` checks a slice against the range it claims, which
// catches a slice carrying fewer nodes than its own offsets cover. It cannot
// see a block that reached NO slice, because no range covers it and so no range
// disagrees with itself. That is a different failure and it is silent: the
// block leaves the document between alignment and the lanes, and every later
// reader works from the slices.
//
// WHAT IT COST ON 2026-08-20: `lintong`s closing paragraph, a friend's last
// message and its date, reached no slice while its English sat in a slice's
// incumbent. The repair lane, shown English with no original behind it, deleted
// the rendering of one clause and left a bare blockquote marker in the shipped
// text. Nothing reported anything; the entry settled with zero alignment
// findings.
//
// CHECKED PER SIDE AND IN ORDER, because the three failures are distinct and
// each is worth naming: a block placed nowhere, a block placed twice, which
// inflates a run past its budget, and blocks placed out of document order,
// which gathers text from two places into one slice.

/**
 * Raised when carving a chunk pair loses, repeats or reorders its blocks.
 *
 * @example
 * ```ts
 * throw new SliceCoverageError({ message: 'source block 6 reached no slice', },);
 * ```
 */
export class SliceCoverageError extends Error {
  /**
   * Builds the failure naming the side and the blocks it cannot account for.
   *
   * @param message - which blocks went missing, repeated or moved
   *
   * @example
   * ```ts
   * throw new SliceCoverageError({ message: 'source block 6 reached no slice', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'SliceCoverageError';
  }
}

/**
 * Reads the ids of node runs, in the order they were placed.
 *
 * @param runs - node runs, one per slice
 *
 * @returns Ids in placement order
 *
 * @example
 * ```ts
 * const placed = idsOf({ runs: [pair.source.nodes,], },);
 * ```
 */
function idsOf(
  { runs, }: { readonly runs: readonly (readonly DocumentNode[])[]; },
): readonly string[] {
  return runs.flatMap(function toIds(run,): readonly string[] {
    return run.map(function toId(node,): string {
      return node.id;
    },);
  },);
}

/**
 * Names how a side's placement departs from the blocks it was given.
 *
 * @param expected - ids the chunk pair carried, in document order
 *
 * @param placed - ids the slices carry, in placement order
 *
 * @returns Every way this side departed, empty when placement is exact
 *
 * @example
 * ```ts
 * const faults = describePlacement({ expected: ['block/0',], placed: [], },);
 * ```
 */
function describePlacement(
  {
    expected,
    placed,
  }: {
    readonly expected: readonly string[];
    readonly placed: readonly string[];
  },
): readonly string[] {
  /**
   * Ids the slices never carried.
   */
  const missing = expected.filter(function unplaced(id,): boolean {
    return !placed.includes(id,);
  },);
  if (missing.length > 0)
    return [
      `${String(missing.length,)} of ${String(expected.length,)} blocks reached no slice: ${missing.join(', ',)}`,
    ];

  /**
   * Ids carried by more than one slice, or twice by one.
   */
  const repeated = placed.filter(function isRepeat(
    id,
    at,
  ): boolean {
    return placed.indexOf(id,) !== at;
  },);
  if (repeated.length > 0)
    return [ `${String(repeated.length,)} blocks were placed more than once: ${repeated.join(', ',)}`, ];
  if (placed.join(' ',) !== expected.join(' ',))
    return [ `blocks were placed out of document order: ${placed.join(', ',)}`, ];
  return [];
}

/**
 * Asserts that slices carved from a chunk pair carry its blocks exactly once.
 *
 * @param pair - chunk pair that went in
 *
 * @param carved - slices it was carved into
 *
 * @throws SliceCoverageError when either side loses, repeats or reorders a block
 *
 * @example
 * ```ts
 * assertSliceCoverage({ pair, carved, },);
 * ```
 */
export function assertSliceCoverage(
  {
    pair,
    carved,
  }: {
    readonly pair: ChunkPair;
    readonly carved: readonly ChunkPair[];
  },
): void {
  /**
   * Both sides, each with the blocks it was given and the blocks it placed.
   */
  const sides = [
    {
      name: 'source',
      expected: idsOf({
        runs: [ pair.source
          .nodes, ],
      },),
      placed: idsOf({
        runs: carved.map(function toRun(slice,): readonly DocumentNode[] {
          return slice.source
            .nodes;
        },),
      },),
    },
    {
      name: 'target',
      expected: idsOf({
        runs: [ pair.target
          .nodes, ],
      },),
      placed: idsOf({
        runs: carved.map(function toRun(slice,): readonly DocumentNode[] {
          return slice.target
            .nodes;
        },),
      },),
    },
  ];
  for (const side of sides) {
    /**
     * How this side departed from its blocks, empty when it did not.
     */
    const faults = describePlacement({
      expected: side.expected,
      placed: side.placed,
    },);
    for (const fault of faults)
      throw new SliceCoverageError({
        message: `slicing chunk ${String(pair.source
          .chunkIndex,)}: ${side.name} ${fault}`,
      },);
  }
}

//endregion Slice coverage
