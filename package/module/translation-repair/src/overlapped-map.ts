import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

//region Overlapped map
// Runs one job per item with a bounded number in flight, and hands the results
// back in item order.
//
// WHY THIS EXISTS. Every per-slice driver in the pipeline ran its slices one
// after another under the rule that aggregate concurrency beyond one stream
// per model collapses throughput. The calibration arms of 2026-08-26 measured
// that rule on four bench slices and found the opposite
// (`doc/decision/translation-repair-calibration-overlap.md`): four slices in
// flight took the same call time in 0.23 of the wall clock that one at a time
// took in 0.41. This is the dial those drivers turn so a corpus pass can be
// measured the same way (`#261`), and `overlap: 1` is exactly the loop it
// replaces.
//
// WHAT A DRIVER'S LOOP HAD THAT THIS KEEPS. Items START in item order, so a
// twin memoized by an earlier slice is registered before its twin looks for
// it. A failure stops further items from starting; the items already in
// flight finish, or throw under the same abort; and the error thrown is the
// lowest position's, which is the one the sequential loop would have thrown.
// Results come back in item order whatever order the items finished in, so
// records and findings aggregate the same way at any overlap.
//
// NOT `p-limit`, which the calibration uses. Its queue keeps draining after
// one job fails, so a pass that lost an entry to a fault would go on buying
// every remaining slice of it.

/**
 * Refusal for an overlap that cannot bound anything.
 *
 * REFUSED HERE AS WELL AS AT THE DIAL. `readOverlap` refuses what an invoker
 * mistypes; this refuses what a caller computes, since zero lanes would settle
 * a document with no slices in it and report every position missing.
 */
export class OverlapRefusedError extends Error {
  /**
   * Declares this message safe to print whole at a boundary: it carries one
   * number and nothing from any text.
   */
  readonly messageNamesOnly: true = true;

  /**
   * @param overlap - what the caller asked for
   */
  constructor({ overlap, }: { readonly overlap: number; },) {
    super(
      `overlap must be a whole number of at least one, and ${String(overlap,)} is not`,
    );
    this.name = 'OverlapRefusedError';
  }
}

/**
 * Refuses an overlap that cannot describe a lane count.
 *
 * Exposed to drivers with a no-work branch, so disabled stages cannot make an
 * invalid overlap valid merely by returning before {@link mapOverlapped}.
 *
 * @param overlap - value requiring validation
 *
 * @throws OverlapRefusedError when value is fractional or below one
 *
 * @example
 * ```ts
 * assertOverlap({ overlap: 4, },);
 * ```
 *
 * @internal
 */
export function assertOverlap(
  { overlap, }: { readonly overlap: number; },
): void {
  if ((!Number.isInteger(overlap,)) || (overlap < 1))
    throw new OverlapRefusedError({ overlap, },);
}

/**
 * One item beside where it sits, which every driver needs for its window and
 * for the index its records carry.
 */
export type OverlappedRow<Item,> = {
  readonly item: Item;
  readonly position: number;
};

/**
 * Runs `oneItem` over every item with at most `overlap` in flight, starting
 * them in item order and returning their results in item order.
 *
 * @param items - what to run over, in the order results come back
 *
 * @param overlap - most items in flight at once; one reproduces a sequential
 * loop
 *
 * @param oneItem - job for one item, handed the item and its position; its
 * result must not be nullish, since a missing result is indistinguishable from
 * a job that never ran
 *
 * @returns One result per item, in item order
 *
 * @throws OverlapRefusedError when `overlap` is not a whole number of at least
 * one
 *
 * @throws Whatever the lowest-positioned failing job threw, once every job
 * already in flight has finished; no job past it is started
 *
 * @example
 * ```ts
 * const records = await mapOverlapped({
 *   items: prepared.slices,
 *   overlap: 4,
 *   oneItem: async function settleOne({ item, position, },) {
 *     return await settleSlice({ slice: item, slicePosition: position, },);
 *   },
 * },);
 * ```
 */
export async function mapOverlapped<Item, Result,>(
  {
    items,
    overlap,
    oneItem,
  }: {
    readonly items: readonly Item[];
    readonly overlap: number;
    readonly oneItem: (row: OverlappedRow<Item>,) => Promise<Result>;
  },
): Promise<readonly Result[]> {
  assertOverlap({ overlap, },);

  /**
   * Every item beside its position, which is what each job is handed.
   */
  const rows = items.map(function toRow(
    item,
    position,
  ): OverlappedRow<Item> {
    return {
      item,
      position,
    };
  },);

  /**
   * What each finished job returned, by position.
   */
  const results = new Map<number, Result>();

  /**
   * What each failed job threw, by position.
   */
  const failures = new Map<number, unknown>();

  /**
   * Next row nobody has taken yet.
   */
  const cursor = { next: 0, };

  /**
   * One lane: takes the next row while there is one and nothing has failed,
   * and runs it to the end before taking another.
   */
  async function drain(): Promise<void> {
    while ((cursor.next < rows.length) && (failures.size === 0)) {
      /**
       * Row this lane runs now, taken before the first await so no other lane
       * takes the same one.
       */
      const row = nonNullishOrThrow(rows[cursor.next],);
      cursor.next += 1;
      try {
        /* oxlint-disable no-await-in-loop -- one lane is sequential by construction; the overlap is the number of lanes, not the number of awaits */
        results.set(
          row.position,
          await oneItem(row,),
        );
        /* oxlint-enable no-await-in-loop */
      }
      catch (error) {
        failures.set(
          row.position,
          error,
        );
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(
      overlap,
      rows.length,
    ), },
    function openLane(): Promise<void> {
      return drain();
    },
  ),);

  if (failures.size > 0) {
    /**
     * Position of the first failure in item order, whose error the sequential
     * loop would have thrown.
     */
    const earliest = Math.min(...failures.keys(),);
    throw failures.get(earliest,);
  }

  return rows.map(function toResult(row,): Result {
    return nonNullishOrThrow(results.get(row.position,),);
  },);
}

//endregion Overlapped map
