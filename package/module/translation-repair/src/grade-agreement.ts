import type {
  GradedItem,
  GradeVerdict,
} from './grade-sheet-read.ts';

//region Grade agreement
// Scoring a blind pre-grade against the human's grades, and scoring precision
// off the human's grades alone.
//
// Both denominators exclude items the human left unscored, and that exclusion is
// the whole reason `unscored` is a verdict rather than a missing value. Round
// two's sheet carries answers like "Not enough context to grade" and "Not sure
// which tense is best here"; counting either as a false positive would move a
// declined question into the precision denominator and report the pipeline as
// worse than measured, while counting it as a real defect would do the reverse.
//
// The agreement rate is what decides whether an agent may pre-filter a later
// round. It is deliberately computed from a round the human graded WITHOUT
// seeing the pre-grades, because an agreement rate measured against grades the
// agent influenced would certify the agent on its own suggestion.

/**
 * How a pre-grade compared against the human's grades.
 *
 * @example
 * ```ts
 * const tally: AgreementTally = {
 *   compared: 48, agreed: 44, disagreed: [3, 17,], unscored: [10, 12,],
 * };
 * ```
 */
export type AgreementTally = {
  /**
   * Items the human scored, which is the agreement denominator.
   */
  readonly compared: number;

  /**
   * Items where the pre-grade matched.
   */
  readonly agreed: number;

  /**
   * Sheet positions where the two disagreed, in order. Named rather than
   * counted, because every disagreement is a calibration case worth reading.
   */
  readonly disagreed: readonly number[];

  /**
   * Sheet positions the human declined to score, excluded from the denominator
   * and reported so their number is never invisible.
   */
  readonly unscored: readonly number[];
};

/**
 * Precision over the items a human actually scored.
 *
 * @example
 * ```ts
 * const precision: PrecisionTally = { scored: 48, realDefects: 39, unscored: [10,], };
 * ```
 */
export type PrecisionTally = {
  /**
   * Items carrying a verdict, the precision denominator.
   */
  readonly scored: number;

  /**
   * Items graded a real defect, the numerator.
   */
  readonly realDefects: number;

  /**
   * Sheet positions the human declined to score.
   */
  readonly unscored: readonly number[];
};

/**
 * Verdict meaning the grader declined to answer.
 */
const UNSCORED: GradeVerdict = 'unscored';

/**
 * Sheet positions the human declined to score.
 *
 * @param human - human's graded items
 *
 * @returns Positions carrying no verdict, in sheet order
 *
 * @example
 * ```ts
 * const declined = unscoredPositions({ human, },);
 * ```
 */
function unscoredPositions(
  { human, }: { readonly human: readonly GradedItem[]; },
): readonly number[] {
  return human.filter(function declined(item,) {
    return item.verdict === UNSCORED;
  },)
    .map(function toIndex(item,) {
      return item.index;
    },);
}

/**
 * Scores a blind pre-grade against the human's grades.
 *
 * @param agent - pre-grades, keyed by sheet position
 *
 * @param human - human's graded items off the same sheet
 *
 * @returns Agreement over the items the human scored
 *
 * @throws {@link Error} when the two sets cover different sheet positions,
 * which would silently compare one round's grades against another's
 *
 * @example
 * ```ts
 * const tally = scoreGradeAgreement({ agent, human, },);
 * ```
 */
export function scoreGradeAgreement(
  {
    agent,
    human,
  }: {
    readonly agent: readonly GradedItem[];
    readonly human: readonly GradedItem[];
  },
): AgreementTally {
  /**
   * Pre-grades by sheet position.
   */
  const byIndex = new Map(agent.map(function toEntry(item,) {
    return [
      item.index,
      item.verdict,
    ] as const;
  },),);
  if (byIndex.size !== human.length)
    throw new Error(
      `pre-grades cover ${String(byIndex.size,)} items but the graded sheet has `
        + `${String(human.length,)}; they are not the same draw.`,
    );

  /**
   * Items the human scored, which is the only population an agreement rate
   * means anything over.
   */
  const scored = human.filter(function hasVerdict(item,) {
    return item.verdict !== UNSCORED;
  },);

  /**
   * Positions where the pre-grade differed.
   */
  const disagreed = scored.filter(function differs(item,) {
    return byIndex.get(item.index,) !== item.verdict;
  },)
    .map(function toIndex(item,) {
      return item.index;
    },);

  return {
    compared: scored.length,
    agreed: scored.length - disagreed.length,
    disagreed,
    unscored: unscoredPositions({ human, },),
  };
}

/**
 * Scores accepted-issue precision off a graded sheet.
 *
 * @param human - human's graded items
 *
 * @returns Precision counts over the items carrying a verdict
 *
 * @example
 * ```ts
 * const tally = scoreGradedPrecision({ human, },);
 * ```
 */
export function scoreGradedPrecision(
  { human, }: { readonly human: readonly GradedItem[]; },
): PrecisionTally {
  return {
    scored: human.filter(function hasVerdict(item,) {
      return item.verdict !== UNSCORED;
    },)
      .length,
    realDefects: human.filter(function isReal(item,) {
      return item.verdict === 'real-defect';
    },)
      .length,
    unscored: unscoredPositions({ human, },),
  };
}

//endregion Grade agreement
