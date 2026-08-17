import type {
  CandidateProducer,
  CandidateWeight,
  SelectionBallot,
  SelectionTally,
} from './candidate-select-model.ts';
import type { TranslateOrigin, } from './translate-candidates.ts';
import type { TranslateSlateEntry, } from './translate-slate.ts';

//region Translate stage result
// What one slice's round DECIDED, apart from the code that decides it.
//
// Split from `translate-stage.ts` when that file reached its line budget, and
// along the seam that was already there: this is the record every later reader
// joins to, while the stage is the fan-out, the slate and the judging that
// produce it. A reader of an artifact needs this file and none of that one.

/**
 * How a slice's shipped text was decided.
 *
 * Kept apart from the origin because "the incumbent shipped" and "the judges
 * chose the incumbent" are different facts, and only the second is evidence
 * about the incumbent. A tie, a lost round or an empty slate all ship the
 * incumbent too, and counting those as wins would report the archive as
 * vindicated by exactly the rounds that examined nothing.
 *
 * @example
 * ```ts
 * const decision: TranslateDecision = 'judged';
 * ```
 */
export type TranslateDecision =
  | 'judged'
  | 'sole-candidate'
  | 'declined-indecision'
  | 'declined-rejection'
  | 'no-candidate-backed'
  | 'no-candidate';

/**
 * Everything the translate stage decided for one slice.
 *
 * @example
 * ```ts
 * const { text, origin, decision, } = await runTranslateStage({ ... },);
 * ```
 */
export type TranslateStageResult = {
  /**
   * Text that ships for this slice.
   */
  readonly text: string;

  /**
   * Whether that text was already there.
   */
  readonly origin: TranslateOrigin;

  /**
   * Who produced it.
   */
  readonly producer: CandidateProducer;

  /**
   * How it was decided.
   */
  readonly decision: TranslateDecision;

  /**
   * Ballot weight the winner drew, zero when no round decided it. A weight
   * rather than a count because a judge voting for its own work counts for
   * less; see `SELF_VOTE_WEIGHT`.
   */
  readonly voteWeight: number;

  /**
   * What the judging round counted; zeros when none ran.
   */
  readonly tally: SelectionTally;

  /**
   * Every ballot cast, so a replaced human translation carries the reasons it
   * was replaced for rather than leaving them in a log.
   */
  readonly ballots: readonly SelectionBallot[];

  /**
   * Translators whose reply arrived and validated.
   */
  readonly heardTranslators: number;

  /**
   * Distinct proposals the judges saw, incumbent included.
   */
  readonly candidateCount: number;

  /**
   * Voice loss, blank replies, incumbent matches and fallbacks, in
   * scorecard-stable wording.
   */
  readonly findings: readonly string[];

  /**
   * Candidates in the order the judges saw them, which is what makes a stored
   * ballot readable: ballots name a position, and the slate is rotated per
   * slice.
   *
   * The ASSEMBLED rotated order, whether or not judges were called. A slice
   * with one distinct proposal ships it without a round and still records the
   * slate, because what was on the ballot is the same question either way and
   * `decision` already says whether anyone voted. Empty only when the slice had
   * no candidates at all.
   */
  readonly slate: readonly TranslateSlateEntry[];

  /**
   * Position the judges chose, or {@link NOT_ON_SLATE} when they chose nothing.
   */
  readonly selectedIndex: number;

  /**
   * Position of the text that actually shipped, which differs from the
   * selection on every fallback and is {@link NOT_ON_SLATE} when the shipped
   * text was never a candidate, as a blank incumbent never is.
   */
  readonly shippedIndex: number;

  /**
   * What each position drew, so a decline says by how much and against what.
   */
  readonly perCandidate: readonly CandidateWeight[];
};

/**
 * Tally of a stage that never reached the judges.
 *
 * @example
 * ```ts
 * const tally = EMPTY_TALLY;
 * ```
 */
export const EMPTY_TALLY: SelectionTally = {
  judgesAvailable: 0,
  ballots: 0,
  abstentions: 0,
  selfVotes: 0,
};

//endregion Translate stage result
