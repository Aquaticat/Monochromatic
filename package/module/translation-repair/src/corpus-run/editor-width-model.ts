import type { SyntheticModelId, } from '../synthetic-catalog.ts';

//region Editor width model
// How a width comparison is read, kept apart from the calls that gather it so
// the reading can be tested without spending quota.
//
// The question this serves is `#186`: does seating more EDITORS produce a
// better repair, holding the judging panel fixed. Two things make that harder
// to read than it looks.
//
// First, most slices will not move at all. The same strong editor tends to win
// both slates, and a width-three winner often survives the wider slate intact.
// A comparison that judged those against themselves would spend calls to learn
// nothing and would dilute whatever signal the moved slices carry, so they are
// classified out before any head-to-head runs.
//
// Second, a winner that changed is not yet a winner that improved. The lane
// disagrees with itself run to run, so the fraction of slices where the
// shipped text moved means nothing until the same arm RUN TWICE says how often
// it moves with no width change at all. That repeat re-produces as well as
// re-judges, because the width arms differ in production and a band covering
// only judge churn would credit ordinary editor variation to the extra seats.

/**
 * Fate of one slice under the two widths, named exhaustively so a slice that
 * fits none of them is a defect rather than a silent omission.
 *
 * `nothing-shipped` covers both slates declining, which says nothing about
 * width. `same-text` is the common case and is the answer for that slice:
 * widening changed nothing here. Only `differs` earns a head-to-head.
 */
export type WidthComparison = 'nothing-shipped' | 'same-text' | 'differs';

/**
 * Which winner the panel preferred when both were put on one slate.
 *
 * `position-decided` is a REAL OUTCOME rather than a failure. The two orders
 * disagreed, so the slate position decided the ballot rather than the text, and
 * counting that as a win for whichever order ran first is how a position bias
 * gets reported as a quality difference.
 */
export type HeadToHeadVerdict = 'wide-wins' | 'narrow-wins' | 'position-decided' | 'tied';

/**
 * Which arm produced a text, so a verdict can name it without carrying it.
 */
export type WidthArm = 'narrow' | 'wide';

/**
 * Everything one slice contributed, with no passage text in it.
 *
 * TEXTS ARE DELIBERATELY ABSENT. This record is what the report prints and what
 * a later session reads, and the corpus is unlicensed, so the comparison keeps
 * hashes and lengths rather than the words they stand for.
 */
export type WidthRow = {
  /**
   * Entry the slice came from.
   */
  readonly entryId: string;

  /**
   * Slice within that entry.
   */
  readonly chunkIndex: number;

  /**
   * Accepted issues the editors were given, which is the work available to do.
   */
  readonly acceptedIssues: number;

  /**
   * How the two widths compared.
   */
  readonly comparison: WidthComparison;

  /**
   * Editors heard at each width, out of those seated. A width that seated six
   * and heard three did not run at six.
   */
  readonly heardNarrow: number;

  /**
   * {@link WidthRow.heardNarrow} for the wide arm.
   */
  readonly heardWide: number;

  /**
   * Whether the narrow arm, run a second time end to end, shipped the same
   * text. This is the null band: a flip here is the lane disagreeing with
   * itself, with no width change behind it.
   */
  readonly narrowRepeatAgreed: boolean;

  /**
   * Head-to-head reading, absent where the comparison earned none.
   */
  readonly verdict: HeadToHeadVerdict | 'not-run';

  /**
   * Ballots that named a candidate in the head-to-head, summed over both
   * orders. A verdict carried by two of twelve must be visible as such.
   */
  readonly usableBallots: number;

  /**
   * Models that wrote the winning text at each arm, for a roster-level reading
   * of who the extra seats actually bought.
   */
  readonly narrowProducers: readonly SyntheticModelId[];

  /**
   * {@link WidthRow.narrowProducers} for the wide arm.
   */
  readonly wideProducers: readonly SyntheticModelId[];
};

/**
 * Reads the two arms into one classification.
 *
 * @param narrowText - text the narrow arm shipped, blank when it shipped none
 *
 * @param wideText - text the wide arm shipped, blank when it shipped none
 *
 * @returns Which of the three cases this slice is
 *
 * @example
 * ```ts
 * const comparison = classifyWidths({ narrowText, wideText, },);
 * ```
 */
export function classifyWidths(
  {
    narrowText,
    wideText,
  }: {
    readonly narrowText: string;
    readonly wideText: string;
  },
): WidthComparison {
  if ((narrowText === '') && (wideText === ''))
    return 'nothing-shipped';

  // One arm shipping and the other not IS a difference, and the interesting
  // kind: the extra seats either found a repair the narrow roster missed or
  // spread the ballots thin enough to decline one it would have made.
  if (narrowText === wideText)
    return 'same-text';

  return 'differs';
}

/**
 * Reads two ordered head-to-head rounds into one verdict.
 *
 * ORDERS MUST AGREE. Each round is the same pair of texts judged by the same
 * panel, differing only in which sat first, so a disagreement is the position
 * talking. Reporting the first order alone would launder that into a result.
 *
 * @param firstOrderWinner - arm the panel preferred with the narrow text first
 *
 * @param secondOrderWinner - arm it preferred with the wide text first
 *
 * @returns Verdict for this pair
 *
 * @example
 * ```ts
 * const verdict = readHeadToHead({ firstOrderWinner: 'wide', secondOrderWinner: 'wide', },);
 * ```
 */
export function readHeadToHead(
  {
    firstOrderWinner,
    secondOrderWinner,
  }: {
    readonly firstOrderWinner: WidthArm | 'none';
    readonly secondOrderWinner: WidthArm | 'none';
  },
): HeadToHeadVerdict {
  // A panel that declined to rank in either order preferred neither, which is
  // a tie on the evidence rather than a missing measurement.
  if ((firstOrderWinner === 'none') && (secondOrderWinner === 'none'))
    return 'tied';

  if (firstOrderWinner !== secondOrderWinner)
    return 'position-decided';

  if (firstOrderWinner === 'wide')
    return 'wide-wins';

  if (firstOrderWinner === 'narrow')
    return 'narrow-wins';

  // Both orders agree and neither is `none`, which the check above already
  // handled, so the pair is `wide` or `narrow` and both returned. Reaching here
  // means an arm was added without a reading, and answering `tied` would report
  // that omission as a measurement.
  throw new Error(`unreachable: both orders named ${firstOrderWinner}, which is not an arm`,);
}

/**
 * What the whole draw says, in the terms `#186` has to answer in.
 */
export type WidthSummary = {
  /**
   * Slices that reached a comparison at all.
   */
  readonly slices: number;

  /**
   * Slices where the shipped text moved when the editors widened.
   */
  readonly moved: number;

  /**
   * Slices where the narrow arm run twice shipped different text. This is the
   * null band for {@link WidthSummary.moved} and is measured, not assumed.
   */
  readonly churned: number;

  /**
   * Head-to-head wins for the wide arm.
   */
  readonly wideWins: number;

  /**
   * Head-to-head wins for the narrow arm.
   */
  readonly narrowWins: number;

  /**
   * Pairs the slate position decided rather than the text.
   */
  readonly positionDecided: number;

  /**
   * Pairs the panel would not separate.
   */
  readonly tied: number;
};

/**
 * Whether widening moved this slice's shipped text.
 *
 * @param row - one slice's comparison
 *
 * @returns Whether the two arms shipped different text
 *
 * @example
 * ```ts
 * const moved = movedText(row,);
 * ```
 */
function movedText(row: WidthRow,): boolean {
  return row.comparison === 'differs';
}

/**
 * Whether the narrow arm run twice disagreed with itself.
 *
 * @param row - one slice's comparison
 *
 * @returns Whether the repeat shipped different text
 *
 * @example
 * ```ts
 * const churned = churnedOnRepeat(row,);
 * ```
 */
function churnedOnRepeat(row: WidthRow,): boolean {
  return !row.narrowRepeatAgreed;
}

/**
 * Counts rows a predicate holds for.
 *
 * @param rows - rows to count over
 *
 * @param holds - predicate naming what is being counted
 *
 * @returns How many held
 *
 * @example
 * ```ts
 * const moved = countWhere({ rows, holds: movedText, },);
 * ```
 */
function countWhere(
  {
    rows,
    holds,
  }: {
    readonly rows: readonly WidthRow[];
    readonly holds: (row: WidthRow) => boolean;
  },
): number {
  return rows
    .filter(holds,)
    .length;
}

/**
 * Counts rows carrying one verdict.
 *
 * @param rows - rows to count over
 *
 * @param verdict - verdict being counted
 *
 * @returns How many carried it
 *
 * @example
 * ```ts
 * const wins = countVerdict({ rows, verdict: 'wide-wins', },);
 * ```
 */
function countVerdict(
  {
    rows,
    verdict,
  }: {
    readonly rows: readonly WidthRow[];
    readonly verdict: HeadToHeadVerdict;
  },
): number {
  return rows
    .filter(function carries(row,) {
      return row.verdict === verdict;
    },)
    .length;
}

/**
 * Counts the rows into the summary the decision reads.
 *
 * @param rows - every slice the draw produced
 *
 * @returns Counts, with no rate computed: a rate over a handful of slices
 * invites reading three of seven as a percentage
 *
 * @example
 * ```ts
 * const summary = summarizeWidths({ rows, },);
 * ```
 */
export function summarizeWidths(
  { rows, }: { readonly rows: readonly WidthRow[]; },
): WidthSummary {
  /**
   * Rows that got far enough to say anything about width.
   */
  const compared = rows
    .filter(function reached(row,) {
      return row.comparison !== 'nothing-shipped';
    },);

  return {
    slices: compared.length,
    moved: countWhere({
      rows: compared,
      holds: movedText,
    },),
    churned: countWhere({
      rows: compared,
      holds: churnedOnRepeat,
    },),
    wideWins: countVerdict({
      rows: compared,
      verdict: 'wide-wins',
    },),
    narrowWins: countVerdict({
      rows: compared,
      verdict: 'narrow-wins',
    },),
    positionDecided: countVerdict({
      rows: compared,
      verdict: 'position-decided',
    },),
    tied: countVerdict({
      rows: compared,
      verdict: 'tied',
    },),
  };
}

//endregion Editor width model
