import { SELF_VOTE_WEIGHT, } from './candidate-select-model.ts';
import {
  type IssueAuthorship,
  wroteTextForIssue,
} from './resolution-authorship.ts';
import {
  isResolutionVerdict,
  type ResolutionReportWire,
  type ResolutionVerdict,
} from './resolution-wire.ts';

//region Resolution tally
// Checker replies resolve through the prompt plan exactly like panel
// ballots, and a strict majority of the WEIGHT behind `fixed` verdicts marks
// an issue resolved. `worse` majorities flag the repair as damaging, which
// candidate measurement counts as a regression. Weight rather than a count,
// because a checker that helped write the text it is judging is heard at
// `SELF_VOTE_WEIGHT`, matching the discount selection already applies.

/**
 * One checker's resolved verdicts over one sheet.
 *
 * @example
 * ```ts
 * const report: ResolutionBallot = {
 *   verdicts: { 'adjudicated/abc': 'fixed', },
 *   findings: [],
 * };
 * ```
 */
export type ResolutionBallot = {
  /**
   * Verdicts keyed by issue id.
   */
  readonly verdicts: Readonly<Record<string, ResolutionVerdict>>;

  /**
   * Wire irregularities in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Resolves one wire report into id-keyed verdicts through the prompt plan.
 * Fails closed per item: out-of-range or duplicate references and unknown
 * verdicts become findings, and issues left unanswered are recorded.
 *
 * @param wire - report as the checker reported it
 *
 * @param issueIds - issue ids in prompt numbering order
 *
 * @returns Resolved ballot with findings as data
 *
 * @example
 * ```ts
 * const ballot = resolveResolutionChecks({ wire, issueIds, },);
 * ```
 */
export function resolveResolutionChecks(
  {
    wire,
    issueIds,
  }: {
    readonly wire: ResolutionReportWire;
    readonly issueIds: readonly string[];
  },
): ResolutionBallot {
  /**
   * Findings accumulated across every wire item.
   */
  const findings: string[] = [];

  /**
   * Resolved verdicts keyed by issue id; first occurrence wins.
   */
  const verdicts: Record<string, ResolutionVerdict> = {};
  for (const check of wire.checks) {
    /**
     * Issue id referenced by this check's one-based number.
     */
    const issueId = issueIds[check.issue - 1];
    if ((check.issue < 1) || (issueId === undefined)) {
      findings.push(`check-index-out-of-range (${check.issue})`,);
      continue;
    }
    if (verdicts[issueId] !== undefined) {
      findings.push(`duplicate-check (${check.issue})`,);
      continue;
    }
    if (!isResolutionVerdict(check.verdict,)) {
      findings.push(`unknown-resolution-verdict (${check.verdict})`,);
      continue;
    }
    verdicts[issueId] = check.verdict;
  }
  for (const [index, issueId,] of issueIds.entries()) {
    if (verdicts[issueId] === undefined)
      findings.push(`missing-check (${index + 1})`,);
  }

  return {
    verdicts,
    findings,
  };
}

/**
 * Fate of one issue after the checker majority spoke.
 *
 * @example
 * ```ts
 * const fate: IssueResolutionTally = {
 *   fixed: 1.5, notFixed: 1, worse: 0, resolved: true, regressed: false,
 * };
 * ```
 */
export type IssueResolutionTally = {
  /**
   * Weight behind verdicts judging the defect gone. FRACTIONAL WHENEVER AN
   * AUTHOR VOTED, so this is not a head count.
   */
  readonly fixed: number;

  /**
   * {@inheritDoc IssueResolutionTally.fixed} Judging it still present.
   */
  readonly notFixed: number;

  /**
   * {@inheritDoc IssueResolutionTally.fixed} Judging the revision damaged the
   * region further.
   */
  readonly worse: number;

  /**
   * Whether fixed verdicts strictly outweigh the rest of the cast votes.
   */
  readonly resolved: boolean;

  /**
   * Whether worse verdicts strictly outweigh the rest of the cast votes.
   */
  readonly regressed: boolean;
};

/**
 * One cast verdict with the weight its checker earned on this issue.
 *
 * @example
 * ```ts
 * const weighed: WeighedVerdict = { verdict: 'fixed', weight: 1, };
 * ```
 */
type WeighedVerdict = {
  /**
   * What this checker answered.
   */
  readonly verdict: ResolutionVerdict;

  /**
   * Weight this answer carries: {@link SELF_VOTE_WEIGHT} when the checker helped
   * write the text it is judging, otherwise a whole vote.
   */
  readonly weight: number;
};

/**
 * Weight standing behind one answer.
 *
 * SUMMED PER ANSWER RATHER THAN SUBTRACTED FROM A TOTAL. Halves are exact in
 * binary so no rounding is at stake, but deriving one figure from the others
 * would silently credit an unrecognized answer to whatever was left over.
 *
 * @param weighed - cast verdicts with their weights
 *
 * @param answer - verdict being weighed
 *
 * @returns Summed weight behind that answer
 *
 * @example
 * ```ts
 * const backing = weightBehind({ weighed, answer: 'fixed', },);
 * ```
 */
function weightBehind(
  {
    weighed,
    answer,
  }: {
    readonly weighed: readonly WeighedVerdict[];
    readonly answer: ResolutionVerdict;
  },
): number {
  return weighed
    .filter(function isAnswer(one,) {
      return one.verdict === answer;
    },)
    .reduce(
      function add(
        total,
        one,
      ) {
        return total + one.weight;
      },
      0,
    );
}

/**
 * Tallies checker ballots per issue, discounting a checker that helped write the
 * text it is judging.
 * An issue with no cast verdicts stays unresolved and unregressed:
 * silence proves nothing in either direction.
 *
 * A DISCOUNT RATHER THAN A BAR. A model that wrote a repair is often best placed
 * to see whether it worked, so its verdict is heard at {@link SELF_VOTE_WEIGHT}
 * rather than discarded.
 *
 * THE DISCOUNT IS DIRECTION-BLIND. An author calling its own work `not-fixed` is
 * halved exactly as one calling it `fixed` is, because what is being weighed is
 * the stake in the text, not which way the answer points.
 *
 * KNOWN AND ACCEPTED: a lone author voting `fixed` with nobody opposing still
 * resolves the issue, since half of a vote still outweighs none. A half cannot
 * block an unopposed author, and nothing in the arithmetic picks a number that
 * would.
 *
 * @param issueIds - issue ids under check
 *
 * @param ballots - resolved ballots keyed by checker id
 *
 * @param authorship - who wrote the text under check
 *
 * @returns Per-issue tallies keyed by issue id
 *
 * @example
 * ```ts
 * const tallies = tallyResolutionChecks({ issueIds, ballots, authorship, },);
 * ```
 */
export function tallyResolutionChecks(
  {
    issueIds,
    ballots,
    authorship,
  }: {
    readonly issueIds: readonly string[];
    readonly ballots: Readonly<Record<string, ResolutionBallot>>;
    readonly authorship: IssueAuthorship;
  },
): Readonly<Record<string, IssueResolutionTally>> {
  return Object.fromEntries(issueIds.map(function toEntry(issueId,) {
    /**
     * Cast verdicts for this issue across every ballot, each carrying the weight
     * its checker earned on this issue.
     */
    const cast = Object
      .entries(ballots,)
      .flatMap(function toWeighed([modelId, ballot,],): readonly WeighedVerdict[] {
        /**
         * This checker's verdict, when cast.
         */
        const verdict = ballot.verdicts[issueId];
        if (verdict === undefined)
          return [];
        return [
          {
            verdict,
            weight: wroteTextForIssue({
              authorship,
              issueId,
              modelId,
            },)
              ? SELF_VOTE_WEIGHT
              : 1,
          },
        ];
      },);

    /**
     * Weight calling the defect gone.
     */
    const fixed = weightBehind({
      weighed: cast,
      answer: 'fixed',
    },);

    /**
     * Weight calling the defect still present.
     */
    const notFixed = weightBehind({
      weighed: cast,
      answer: 'not-fixed',
    },);

    /**
     * Weight calling the revision damaging.
     */
    const worse = weightBehind({
      weighed: cast,
      answer: 'worse',
    },);

    return [
      issueId,
      {
        fixed,
        notFixed,
        worse,
        resolved: fixed > (notFixed + worse),
        regressed: worse > (fixed + notFixed),
      },
    ];
  },),);
}

//endregion Resolution tally
