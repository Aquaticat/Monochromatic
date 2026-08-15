import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { writeFileAtomic, } from './atomic-write.ts';
import { resolveRunsDir, } from './run-config.ts';
import type { BenchRow, } from './roster-bench.ts';

//region Bench report
// What the roster bench writes down, and what it prints.
//
// Counts are reported with the number of incumbent-bearing slices beside them.
// The corpus is mostly incumbent-bearing, so a bare decline rate would quietly
// generalize from the case the lane is least needed for to the case it exists
// for, and the split is what keeps that readable.

/**
 * Narrowest producer roster worth benching: below two there is nothing to
 * choose between except the incumbent.
 */
const NARROWEST_WIDTH = 2;

/**
 * Adds a list of numbers.
 *
 * @param values - numbers to add
 *
 * @returns Their sum, zero when there are none
 *
 * @example
 * ```ts
 * const total = sumOf({ values: [1, 2,], },);
 * ```
 */
function sumOf({ values, }: { readonly values: readonly number[]; },): number {
  return values.reduce(
    function add(
      total,
      value,
    ): number {
      return total + value;
    },
    0,
  );
}

/**
 * Distinct numbers in a list, ascending.
 *
 * @param values - numbers to reduce to a sorted set
 *
 * @returns Each distinct value once
 *
 * @example
 * ```ts
 * const widths = distinctAscending({ values: rowWidths, },);
 * ```
 */
function distinctAscending(
  { values, }: { readonly values: readonly number[]; },
): readonly number[] {
  return [...new Set(values,),].toSorted(function ascending(
    left,
    right,
  ): number {
    return left - right;
  },);
}

/**
 * Widths this roster supports, and which one is measured twice.
 *
 * Derived from the roster length rather than written down, because the provider
 * changes its offering often and a bench that hardcoded six would silently stop
 * measuring the widest case the day a model is added.
 *
 * @param roster - models available to seat
 *
 * @returns Every width from the narrowest to the whole roster, plus the width
 * whose repeat measures the run-to-run band
 *
 * @throws Error when the roster is too small to vary at all
 *
 * @example
 * ```ts
 * const { widths, repeated, } = benchWidths({ roster: RUN_ROSTER, },);
 * ```
 */
export function benchWidths(
  { roster, }: { readonly roster: readonly string[]; },
): {
  readonly widths: readonly number[];
  readonly repeated: number;
} {
  /**
   * Every width from the narrowest up to the whole roster.
   */
  const widths = Array.from(
    { length: Math.max(
      0,
      (roster.length - NARROWEST_WIDTH) + 1,
    ), },
    function toWidth(
      _unused,
      position,
    ): number {
      return NARROWEST_WIDTH + position;
    },
  );
  if (widths.length === 0)
    throw new Error(
      `a roster of ${String(roster.length,)} cannot be benched: nothing to vary`,
    );

  return {
    widths,
    // The MIDDLE width carries the repeat. The band is meant to describe the
    // bench as a whole, and the extremes are its two least representative
    // points.
    repeated: widths[Math.floor(widths.length / 2,)] ?? NARROWEST_WIDTH,
  };
}

/**
 * Writes every row so far, replacing the report each time.
 *
 * Rewritten after every row rather than once at the end: a bench that spends
 * hours of quota and is then killed must leave everything it already bought.
 *
 * @param rows - rows accumulated so far
 *
 * @param headSha - pipeline commit these rows were produced by
 *
 * @param widths - widths this run sweeps
 *
 * @param repeated - width run twice
 *
 * @param roster - full judge roster, which every width shares
 *
 * @example
 * ```ts
 * await writeBenchReport({ rows, headSha, widths, repeated, roster, },);
 * ```
 */
export async function writeBenchReport(
  {
    rows,
    headSha,
    widths,
    repeated,
    roster,
  }: {
    readonly rows: readonly BenchRow[];
    readonly headSha: string;
    readonly widths: readonly number[];
    readonly repeated: number;
    readonly roster: readonly string[];
  },
): Promise<void> {
  /**
   * Directory this run may write to.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Where bench reports live, beside the run's other artifacts.
   */
  const benchDir = join(
    runsDir,
    'roster-bench',
  );
  await mkdir(
    benchDir,
    { recursive: true, },
  );
  await writeFileAtomic({
    path: join(
      benchDir,
      'rows.json',
    ),
    text: JSON.stringify(
      {
        headSha,
        widths,
        repeated,
        roster,
        rows,
      },
      undefined,
      2,
    ),
  },);
}

/**
 * One line describing what a set of rows decided and cost.
 *
 * @param rows - rows to describe, all of one width and pass
 *
 * @returns Printable summary, or a note that nothing ran
 *
 * @example
 * ```ts
 * console.log(describeRows({ rows, },),);
 * ```
 */
function describeRows(
  { rows, }: { readonly rows: readonly BenchRow[]; },
): string {
  if (rows.length === 0)
    return 'no rows';

  /**
   * Rows whose slice already had a translation.
   */
  const withIncumbent = rows.filter(function hasIncumbent(row,): boolean {
    return row.incumbentChars > 0;
  },);

  /**
   * Rows the judges declined either way.
   */
  const declined = rows.filter(function wasDeclined(row,): boolean {
    return row.decision
      .startsWith('declined',);
  },);

  /**
   * Rows that shipped the text already there.
   */
  const kept = rows.filter(function wasKept(row,): boolean {
    return row.keptIncumbent;
  },);

  /**
   * Exchanges every row in this set made.
   */
  const calls = sumOf({ values: rows.map(function toCalls(row,): number {
    return row.calls
      .length;
  },), },);

  /**
   * Tokens those exchanges moved.
   */
  const tokens = sumOf({ values: rows.map(function toTokens(row,): number {
    return sumOf({ values: row.calls
      .map(function toCallTokens(call,): number {
        return call.tokens;
      },), },);
  },), },);

  /**
   * Wall time this set took.
   */
  const ms = sumOf({ values: rows.map(function toMs(row,): number {
    return row.ms;
  },), },);

  /**
   * Self-votes cast across the set.
   */
  const selfVotes = sumOf({ values: rows.map(function toSelfVotes(row,): number {
    return row.selfVotes;
  },), },);

  return [
    `${String(rows.length,)} slices (${String(withIncumbent.length,)} with an incumbent)`,
    `declined ${String(declined.length,)}`,
    `kept ${String(kept.length,)}`,
    `self-votes ${String(selfVotes,)}`,
    `calls ${String(calls,)}`,
    `tokens ${String(tokens,)}`,
    `${String(Math.round(ms / rows.length,),)}ms per slice`,
  ].join(', ',);
}

/**
 * Prints the comparison the bench exists for.
 *
 * @param rows - every row the run produced
 *
 * @example
 * ```ts
 * summarizeBench({ rows, },);
 * ```
 */
export function summarizeBench(
  { rows, }: { readonly rows: readonly BenchRow[]; },
): void {
  /**
   * Widths these rows cover.
   */
  const widths = distinctAscending({ values: rows.map(function toWidth(row,): number {
    return row.width;
  },), },);
  for (const width of widths) {
    /**
     * Rows recorded at this width.
     */
    const atWidth = rows.filter(function matchesWidth(row,): boolean {
      return row.width === width;
    },);

    /**
     * Passes recorded at this width.
     */
    const passes = distinctAscending({ values: atWidth.map(function toPass(row,): number {
      return row.pass;
    },), },);
    for (const pass of passes) {
      /**
       * Rows of this width and pass.
       */
      const atPass = atWidth.filter(function matchesPass(row,): boolean {
        return row.pass === pass;
      },);
      console.log(
        `BENCH width ${String(width,)} pass ${String(pass,)}: ${
          describeRows({ rows: atPass, },)
        }`,
      );
    }
  }
}

//endregion Bench report
