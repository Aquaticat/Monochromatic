import { scorePairing, } from './align-blocks.ts';
import type { DocumentNode, } from './document-node.ts';

//region Block alignment walk
// The monotone alignment itself: a Needleman-Wunsch walk over two block lists,
// scoring candidate partnerships with `scorePairing` and paying `GAP_PENALTY`
// to leave a block unpartnered. Monotone because translations preserve order:
// blocks may be dropped, added, or merged, but never reordered wholesale, so a
// crossing alignment would be evidence of a different failure entirely.
//
// The walk reports skips rather than hiding them. The drift this replaces left
// no trace at all in any artifact, which is why it survived until a human
// graded the output.

/**
 * Cost of leaving a block unpartnered, mirrored from the scoring module's
 * calibration: below the swing between a kind match and a kind mismatch, so
 * one dropped block is cheaper to skip than to force onto its neighbour.
 */
const GAP_PENALTY = -1.5;

/**
 * One step of the alignment: a partnered pair, or a block skipped on one side.
 *
 * @example
 * ```ts
 * const step: AlignmentStep = { kind: 'paired', sourceIndex: 7, targetIndex: 6, };
 * ```
 */
export type AlignmentStep =
  | {
    /**
     * Both sides contributed a block.
     */
    readonly kind: 'paired';

    /**
     * Original-side block index.
     */
    readonly sourceIndex: number;

    /**
     * Translation-side block index.
     */
    readonly targetIndex: number;
  }
  | {
    /**
     * The original carries a block the translation does not.
     */
    readonly kind: 'source-only';

    /**
     * Original-side block index.
     */
    readonly sourceIndex: number;
  }
  | {
    /**
     * The translation carries a block the original does not.
     */
    readonly kind: 'target-only';

    /**
     * Translation-side block index.
     */
    readonly targetIndex: number;
  };

/**
 * Cell of the score table plus the move that produced it.
 */
type Cell = {
  /**
   * Best cumulative score reaching this cell.
   */
  readonly score: number;

  /**
   * Move taken to reach it, `start` only at the origin.
   */
  readonly move: 'start' | 'pair' | 'skip-source' | 'skip-target';
};

/**
 * Builds the score table for the two block lists. Row zero and column zero are
 * pure gap runs, so a document whose counterpart is empty aligns as all skips
 * rather than failing.
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @returns Filled table with one extra row and column for the empty prefixes
 */
function buildTable(
  {
    sourceNodes,
    targetNodes,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
  },
): readonly (readonly Cell[])[] {
  /**
   * Mutable table under construction; rows are built in order and never
   * revisited once complete.
   */
  const table: Cell[][] = [];
  for (let row = 0; row <= sourceNodes.length; row += 1) {
    /**
     * Row being filled.
     */
    const cells: Cell[] = [];
    for (let column = 0; column <= targetNodes.length; column += 1) {
      if ((row === 0) && (column === 0)) {
        cells.push({
          score: 0,
          move: 'start',
        },);
        continue;
      }
      if (row === 0) {
        cells.push({
          score: GAP_PENALTY * column,
          move: 'skip-target',
        },);
        continue;
      }
      if (column === 0) {
        cells.push({
          score: GAP_PENALTY * row,
          move: 'skip-source',
        },);
        continue;
      }

      /**
       * Original block this cell considers, present by the loop bounds.
       */
      const sourceNode = sourceNodes[row - 1];

      /**
       * Translation block this cell considers, present by the loop bounds.
       */
      const targetNode = targetNodes[column - 1];
      /* v8 ignore next 2 -- @preserve loop bounds guarantee both blocks */
      if ((sourceNode === undefined) || (targetNode === undefined))
        throw new Error('unreachable: alignment walked outside its inputs',);

      /**
       * Score for partnering the two blocks.
       */
      const pairScore = (table[row - 1]?.[column - 1]
        ?.score
        ?? 0)
        + scorePairing({
          source: sourceNode,
          target: targetNode,
        },);

      /**
       * Score for leaving the original's block unpartnered.
       */
      const skipSourceScore = (table[row - 1]?.[column]
        ?.score
        ?? 0) + GAP_PENALTY;

      /**
       * Score for leaving the translation's block unpartnered.
       */
      const skipTargetScore = (cells[column - 1]
        ?.score
        ?? 0) + GAP_PENALTY;

      /**
       * Best of the three moves; pairing wins ties so the alignment stays as
       * connected as the scores allow.
       */
      const best = Math.max(
        pairScore,
        skipSourceScore,
        skipTargetScore,
      );
      cells.push({
        score: best,
        move: best === pairScore
          ? 'pair'
          : (best === skipSourceScore
            ? 'skip-source'
            : 'skip-target'),
      },);
    }
    table.push(cells,);
  }
  return table;
}

/**
 * Aligns two block lists monotonically, skipping rather than forcing a partner
 * where no partner fits. Order is preserved on both sides.
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @returns Steps in document order, covering every block on both sides exactly
 * once
 *
 * @example
 * ```ts
 * const steps = alignBlocks({ sourceNodes, targetNodes, },);
 * ```
 */
export function alignBlocks(
  {
    sourceNodes,
    targetNodes,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
  },
): readonly AlignmentStep[] {
  /**
   * Filled score table.
   */
  const table = buildTable({
    sourceNodes,
    targetNodes,
  },);

  /**
   * Steps recovered from the table, built backwards then reversed.
   */
  const reversed: AlignmentStep[] = [];

  /**
   * Position in the table, walked backwards from the far corner. A mutable
   * record rather than two loose bindings, so the traceback's state is one
   * named thing.
   */
  const cursor = {
    row: sourceNodes.length,
    column: targetNodes.length,
  };
  while ((cursor.row > 0) || (cursor.column > 0)) {
    /**
     * Move recorded for the current cell.
     */
    const move = table[cursor.row]?.[cursor.column]
      ?.move;
    if ((move === 'pair') && (cursor.row > 0)
      && (cursor.column > 0)) {
      reversed.push({
        kind: 'paired',
        sourceIndex: cursor.row - 1,
        targetIndex: cursor.column - 1,
      },);
      cursor.row -= 1;
      cursor.column -= 1;
      continue;
    }
    if ((move === 'skip-source') && (cursor.row > 0)) {
      reversed.push({
        kind: 'source-only',
        sourceIndex: cursor.row - 1,
      },);
      cursor.row -= 1;
      continue;
    }
    if (cursor.column > 0) {
      reversed.push({
        kind: 'target-only',
        targetIndex: cursor.column - 1,
      },);
      cursor.column -= 1;
      continue;
    }
    /* v8 ignore next 4 -- @preserve every reachable cell records a usable move */
    reversed.push({
      kind: 'source-only',
      sourceIndex: cursor.row - 1,
    },);
    cursor.row -= 1;
  }
  return reversed.toReversed();
}

//endregion Block alignment walk
