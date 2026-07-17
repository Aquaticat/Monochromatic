import {
  isResolutionVerdict,
  type ResolutionReportWire,
  type ResolutionVerdict,
} from './resolution-wire.ts';

//region Resolution tally
// Checker replies resolve through the prompt plan exactly like panel
// ballots, and a strict majority of `fixed` verdicts among cast verdicts
// marks an issue resolved. `worse` majorities flag the repair as damaging,
// which candidate measurement counts as a regression.

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
 *   fixed: 2, notFixed: 1, worse: 0, resolved: true, regressed: false,
 * };
 * ```
 */
export type IssueResolutionTally = {
  /**
   * Checkers judging the defect gone.
   */
  readonly fixed: number;

  /**
   * Checkers judging the defect still present.
   */
  readonly notFixed: number;

  /**
   * Checkers judging the revision damaged the region further.
   */
  readonly worse: number;

  /**
   * Whether fixed verdicts strictly outnumber the rest of the cast votes.
   */
  readonly resolved: boolean;

  /**
   * Whether worse verdicts strictly outnumber the rest of the cast votes.
   */
  readonly regressed: boolean;
};

/**
 * Tallies checker ballots per issue.
 * An issue with no cast verdicts stays unresolved and unregressed:
 * silence proves nothing in either direction.
 *
 * @param issueIds - issue ids under check
 *
 * @param ballots - resolved ballots keyed by checker id
 *
 * @returns Per-issue tallies keyed by issue id
 *
 * @example
 * ```ts
 * const tallies = tallyResolutionChecks({ issueIds, ballots, },);
 * ```
 */
export function tallyResolutionChecks(
  {
    issueIds,
    ballots,
  }: {
    readonly issueIds: readonly string[];
    readonly ballots: Readonly<Record<string, ResolutionBallot>>;
  },
): Readonly<Record<string, IssueResolutionTally>> {
  return Object.fromEntries(issueIds.map(function toEntry(issueId,) {
    /**
     * Cast verdicts for this issue across every ballot.
     */
    const cast = Object
      .values(ballots,)
      .flatMap(function toVerdict(ballot,): readonly ResolutionVerdict[] {
        /**
         * This checker's verdict, when cast.
         */
        const verdict = ballot.verdicts[issueId];
        return verdict === undefined ? [] : [verdict,];
      },);

    /**
     * Count of fixed verdicts.
     */
    const fixed = cast.filter(function isFixed(verdict,) {
      return verdict === 'fixed';
    },)
      .length;

    /**
     * Count of not-fixed verdicts.
     */
    const notFixed = cast.filter(function isNotFixed(verdict,) {
      return verdict === 'not-fixed';
    },)
      .length;

    /**
     * Count of worse verdicts.
     */
    const worse = cast.length - fixed
      - notFixed;

    return [
      issueId,
      {
        fixed,
        notFixed,
        worse,
        resolved: fixed > (cast.length - fixed),
        regressed: worse > (cast.length - worse),
      },
    ];
  },),);
}

//endregion Resolution tally
