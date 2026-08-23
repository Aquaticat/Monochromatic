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

//region Optimal heading paths
// The DP behind the forced aligner, and the scan that reads every optimal path
// out of it.
//
// Split from `align-headings-forced.ts` when that file reached its line budget.
// The split is by AUDIENCE: everything here answers "what does some optimal
// alignment do", a question about the table, while the caller answers "what may
// we therefore claim", a question about policy. The second is where a wrong
// answer writes into a page, and it is worth reading without the table
// arithmetic around it.
//
// WHY COLUMNS AND NOT FLAGS. A source section with no partner anywhere still
// has to be PUT somewhere before its translation can be inserted, and the
// column at which it is skipped is that place. Recording only that a gap was
// possible answers "is this section untranslated" and loses "and where does it
// belong", which is the half an insertion cannot proceed without.

/**
 * What every optimal alignment does with each unit.
 */
export type OptimalPaths = {
  /**
   * Target units each source unit pairs with on SOME optimal path.
   */
  readonly partnersOfSource: readonly ReadonlySet<number>[];

  /**
   * Source units each target unit pairs with on SOME optimal path.
   */
  readonly partnersOfTarget: readonly ReadonlySet<number>[];

  /**
   * Target columns at which each source unit goes unpaired on SOME optimal
   * path, which is where an insertion for it could land.
   */
  readonly sourceGapColumns: readonly ReadonlySet<number>[];

  /**
   * Target units that go unpaired on SOME optimal path.
   */
  readonly targetCanGap: readonly boolean[];
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
 * Reads every optimal alignment out of the table.
 *
 * @param sourceHeadings - original-side unit labels in document order
 *
 * @param targetHeadings - translation-side unit labels in document order
 *
 * @returns What some optimal path does with each unit on either side
 *
 * @example
 * ```ts
 * const paths = scanOptimalPaths({ sourceHeadings, targetHeadings, },);
 * ```
 */
export function scanOptimalPaths(
  {
    sourceHeadings,
    targetHeadings,
  }: {
    readonly sourceHeadings: readonly string[];
    readonly targetHeadings: readonly string[];
  },
): OptimalPaths {
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
   * Target columns at which each source unit goes unpaired on SOME optimal
   * path.
   *
   * A SET OF COLUMNS rather than a flag, because a source section with no
   * partner still has to be PUT somewhere, and the column is where. Recording
   * only that a gap was possible loses the one fact an insertion needs.
   *
   * Column `c` means the source unit is skipped while the target cursor sits
   * before target unit `c`, so an insertion for it lands there.
   */
  const sourceGapColumns = sourceHeadings.map(function empty(): Set<number> {
    return new Set<number>();
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
          sourceGapColumns[row]
            ?.add(column,);
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

  return {
    partnersOfSource,
    partnersOfTarget,
    sourceGapColumns,
    targetCanGap,
  };
}

//endregion Optimal heading paths
