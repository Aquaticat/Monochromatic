import {
  addScore,
  beats,
  buildGrid,
  GAP,
  type Grid,
  type LexScore,
  pairScore,
  sameScore,
  UNREACHABLE,
} from './align-headings-grid.ts';

//region Forced heading alignment
// An aligner that can REFUSE. The shipped scorer cannot: a pairing scores
// `diagonal + headingAffinity`, which is never below zero, while a gap costs
// `GAP_PENALTY` per side, so pairing two headings that share nothing scores 0
// against -0.70 for leaving both unpaired and the maximum always prefers the
// unsupported pairing. Every gap it emits is the forced surplus of a length
// difference, never a judgement that two headings do not correspond.
//
// This one scores LEXICOGRAPHICALLY: trusted anchors first, then fewest gaps,
// then soft affinity. And it emits a pairing only when that pairing lies on
// EVERY optimal path, which is what makes "I cannot tell" expressible. Anything
// else comes back ambiguous, and an ambiguous section gets no critic work, per
// `doc/decision/translation-repair-unpairable-section.md`.
//
// Measured against production over 92 entries: 90 align identically, XingZ60
// keeps 12 of its 13 pairs and loses only the wrong one, and XIEPT2 refuses all
// 8 rather than pairing Chinese prose against bare English headings.

/**
 * Why a heading ended up with no partner.
 *
 * `forced-gap` means no optimal path pairs it at all, so the other side simply
 * has nothing for it. `ambiguous` means several optimal pairings exist and the
 * aligner declines to guess, which is the outcome the shipped scorer cannot
 * produce.
 */
export type UnpairedReason = 'forced-gap' | 'ambiguous';

/**
 * One decision about one heading.
 *
 * @example
 * ```ts
 * const step: ForcedAlignStep = { kind: 'paired', sourceIndex: 0, targetIndex: 0, affinity: 1, };
 * ```
 */
export type ForcedAlignStep =
  | {
    /**
     * Both sides correspond on every optimal path.
     */
    readonly kind: 'paired';

    /**
     * Source unit index.
     */
    readonly sourceIndex: number;

    /**
     * Target unit index.
     */
    readonly targetIndex: number;

    /**
     * Affinity of the pairing.
     */
    readonly affinity: number;
  }
  | {
    /**
     * Original carries a section the translation does not, or the aligner
     * refuses to say which one it is.
     */
    readonly kind: 'source-only';

    /**
     * Source unit index.
     */
    readonly sourceIndex: number;

    /**
     * Whether nothing could pair, or too much could.
     */
    readonly reason: UnpairedReason;
  }
  | {
    /**
     * Translation carries a section the original does not, or the aligner
     * refuses to say which one it is.
     */
    readonly kind: 'target-only';

    /**
     * Target unit index.
     */
    readonly targetIndex: number;

    /**
     * Whether nothing could pair, or too much could.
     */
    readonly reason: UnpairedReason;
  };

/**
 * Fills a lexicographic DP table over the two sequences.
 *
 * @param grid - affinity and trust
 *
 * @param rows - source length
 *
 * @param columns - target length
 *
 * @param forward - true to fill from the origin, false from the far corner
 *
 * @returns Table of best scores
 *
 * @example
 * ```ts
 * const table = fillTable({ grid, rows, columns, forward: true, },);
 * ```
 */
function fillTable(
  {
    grid,
    rows,
    columns,
    forward,
  }: {
    readonly grid: Grid;
    readonly rows: number;
    readonly columns: number;
    readonly forward: boolean;
  },
): readonly (readonly LexScore[])[] {
  /**
   * Best score reachable at each cell.
   */
  const table: LexScore[][] = Array.from(
    { length: rows + 1, },
    function emptyRow(): LexScore[] {
      return Array.from(
        { length: columns + 1, },
        function emptyCell(): LexScore {
          return UNREACHABLE;
        },
      );
    },
  );

  /**
   * Cell the walk starts from.
   */
  const originRow = forward ? 0 : rows;

  /**
   * Column the walk starts from.
   */
  const originColumn = forward ? 0 : columns;
  (table[originRow] ?? [])[originColumn] = [
    0,
    0,
    0
  ];

  for (let step = 0; step <= rows; step += 1) {
    for (let column = 0; column <= columns; column += 1) {
      /**
       * Row under consideration, walked in the direction of travel.
       */
      const row = forward ? step : (rows - step);

      /**
       * Column under consideration, walked in the direction of travel.
       */
      const at = forward ? column : (columns - column);
      if ((row === originRow) && (at === originColumn))
        continue;

      /**
       * Best score found for this cell so far.
       */
      let best = UNREACHABLE;

      /**
       * Neighbouring cells and what reaching this one from them costs.
       */
      const moves: readonly (readonly [
        number,
        number,
        LexScore
      ])[] = forward
        ? [
          [
            row - 1,
            at - 1,
            ((row > 0) && (at > 0))
              ? pairScore({
                grid,
                sourceIndex: row - 1,
                targetIndex: at - 1,
              },)
              : UNREACHABLE,
          ],
          [
            row - 1,
            at,
            (row > 0) ? GAP : UNREACHABLE,
          ],
          [
            row,
            at - 1,
            (at > 0) ? GAP : UNREACHABLE,
          ],
        ]
        : [
          [
            row + 1,
            at + 1,
            ((row < rows) && (at < columns))
              ? pairScore({
                grid,
                sourceIndex: row,
                targetIndex: at,
              },)
              : UNREACHABLE,
          ],
          [
            row + 1,
            at,
            (row < rows) ? GAP : UNREACHABLE,
          ],
          [
            row,
            at + 1,
            (at < columns) ? GAP : UNREACHABLE,
          ],
        ];

      for (const [neighbourRow, neighbourColumn, cost,] of moves) {
        if (cost === UNREACHABLE)
          continue;

        /**
         * Score at the neighbour this move comes from.
         */
        const from = table[neighbourRow]?.[neighbourColumn];
        if ((from === undefined) || sameScore({
          left: from,
          right: UNREACHABLE,
        },))
          continue;

        /**
         * Score of reaching this cell that way.
         */
        const candidate = addScore({
          left: from,
          right: cost,
        },);
        if (beats({
          candidate,
          incumbent: best,
        },))
          best = candidate;
      }

      (table[row] ?? [])[at] = best;
    }
  }

  return table;
}

/**
 * Aligns two heading sequences, emitting a pairing only when it is forced.
 *
 * A pairing is forced when it lies on EVERY optimal path. Anything else is
 * reported unpaired with `ambiguous`, which is the outcome that lets a caller
 * skip a section rather than guess at it.
 *
 * @param sourceHeadings - original-side unit labels in document order
 *
 * @param targetHeadings - translation-side unit labels in document order
 *
 * @returns One step per source unit, then the unpaired target units
 *
 * @example
 * ```ts
 * const steps = alignHeadingsForced({ sourceHeadings, targetHeadings, },);
 * ```
 */
export function alignHeadingsForced(
  {
    sourceHeadings,
    targetHeadings,
  }: {
    readonly sourceHeadings: readonly string[];
    readonly targetHeadings: readonly string[];
  },
): readonly ForcedAlignStep[] {
  /**
   * Source length.
   */
  const rows = sourceHeadings.length;

  /**
   * Target length.
   */
  const columns = targetHeadings.length;

  /**
   * Affinity and trust over every pairing.
   */
  const grid = buildGrid({
    sourceHeadings,
    targetHeadings,
  },);

  /**
   * Best score reaching each cell from the origin.
   */
  const forward = fillTable({
    grid,
    rows,
    columns,
    forward: true,
  },);

  /**
   * Best score reaching the far corner from each cell.
   */
  const backward = fillTable({
    grid,
    rows,
    columns,
    forward: false,
  },);

  /**
   * Score of an optimal alignment.
   */
  const optimal = forward[rows]?.[columns] ?? UNREACHABLE;

  /**
   * Target units each source unit pairs with on SOME optimal path.
   */
  const partnersOfSource = sourceHeadings.map(function empty(): Set<number> {
    return new Set<number>();
  },);

  /**
   * Source units each target unit pairs with on SOME optimal path.
   */
  const partnersOfTarget = targetHeadings.map(function empty(): Set<number> {
    return new Set<number>();
  },);

  /**
   * Source units that go unpaired on SOME optimal path.
   */
  const sourceCanGap = sourceHeadings.map(function no(): boolean {
    return false;
  },);

  /**
   * Target units that go unpaired on SOME optimal path.
   */
  const targetCanGap = targetHeadings.map(function no(): boolean {
    return false;
  },);

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      /**
       * Best score reaching this cell.
       */
      const here = forward[row]?.[column];
      if ((here === undefined) || sameScore({
        left: here,
        right: UNREACHABLE,
      },))
        continue;

      if ((row < rows) && (column < columns)) {
        /**
         * Affinity of pairing these two units.
         */
        const value = grid.affinity[row]?.[column] ?? 0;

        /**
         * Whole-path score if this pairing is taken here.
         */
        const through = addScore({
          left: addScore({
            left: here,
            right: [
              (grid.trusted[row]?.[column] ?? false) ? value : 0,
              0,
              value,
            ],
          },),
          right: backward[row + 1]?.[column + 1] ?? UNREACHABLE,
        },);
        if (sameScore({
          left: through,
          right: optimal,
        },)) {
          partnersOfSource[row]
            ?.add(column,);
          partnersOfTarget[column]
            ?.add(row,);
        }
      }

      if (row < rows) {
        /**
         * Whole-path score if the source unit gaps here.
         */
        const through = addScore({
          left: addScore({
            left: here,
            right: GAP,
          },),
          right: backward[row + 1]?.[column] ?? UNREACHABLE,
        },);
        if (sameScore({
          left: through,
          right: optimal,
        },))
          sourceCanGap[row] = true;
      }

      if (column < columns) {
        /**
         * Whole-path score if the target unit gaps here.
         */
        const through = addScore({
          left: addScore({
            left: here,
            right: GAP,
          },),
          right: backward[row]?.[column + 1] ?? UNREACHABLE,
        },);
        if (sameScore({
          left: through,
          right: optimal,
        },))
          targetCanGap[column] = true;
      }
    }
  }

  /**
   * Decisions for every source unit, then the target units left over.
   */
  const steps: ForcedAlignStep[] = [];

  /**
   * Target units claimed by a forced pairing.
   */
  const claimed = new Set<number>();

  for (let row = 0; row < rows; row += 1) {
    /**
     * Targets this source unit could pair with optimally.
     */
    const partners = partnersOfSource[row] ?? new Set<number>();

    /**
     * The single partner, when there is exactly one and no gap competes.
     */
    const only = ((partners.size === 1) && (!(sourceCanGap[row] ?? false)))
      ? [...partners,][0]
      : undefined;

    if ((only !== undefined)
      && ((partnersOfTarget[only]
        ?.size
        ?? 0) === 1)
      && (!(targetCanGap[only] ?? false))) {
      steps.push({
        kind: 'paired',
        sourceIndex: row,
        targetIndex: only,
        affinity: grid.affinity[row]?.[only] ?? 0,
      },);
      claimed.add(only,);
      continue;
    }

    steps.push({
      kind: 'source-only',
      sourceIndex: row,
      reason: (partners.size === 0) ? 'forced-gap' : 'ambiguous',
    },);
  }

  for (let column = 0; column < columns; column += 1) {
    if (claimed.has(column,))
      continue;
    steps.push({
      kind: 'target-only',
      targetIndex: column,
      reason: ((partnersOfTarget[column]
        ?.size
        ?? 0) === 0) ? 'forced-gap' : 'ambiguous',
    },);
  }

  return steps;
}

//endregion Forced heading alignment
