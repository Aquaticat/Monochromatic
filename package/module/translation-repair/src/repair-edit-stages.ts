import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type {
  IssueCheckerBallot,
  IssueCheckerReading,
} from './checker-reading.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  type IssueAuthorship,
  wroteTextForIssue,
} from './resolution-authorship.ts';
import {
  buildResolutionMessages,
  isResolutionReportWire,
  RESOLUTION_RESPONSE_FORMAT,
} from './resolution-wire.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  type IssueResolutionTally,
  type ResolutionBallot,
  resolveResolutionChecks,
  tallyResolutionChecks,
} from './tally-resolution.ts';

//region Checker stage
// The proving stage of one chunk's repair: checker models judge whether each
// accepted issue is actually gone from the candidate the editor ensemble chose.
// Lost checker voices weaken the proof and with it the candidate's
// measurements. The editors themselves live in `repair-editor-stage.ts`.

/**
 * Everything the checker stage produced for one chunk.
 *
 * @example
 * ```ts
 * const { tallies, } = await runCheckerStage({ ... },);
 * ```
 */
export type CheckerStageResult = {
  /**
   * Per-issue resolution tallies keyed by issue id.
   */
  readonly tallies: Readonly<Record<string, IssueResolutionTally>>;

  /**
   * Per-issue ballots and seated roster beside those tallies, keyed the same.
   *
   * Carried so what lands in the artifact is the round rather than its sum. The
   * tally inside each reading is the very object {@link CheckerStageResult.tallies}
   * holds, so the two cannot disagree.
   */
  readonly readings: Readonly<Record<string, IssueCheckerReading>>;

  /**
   * Checkers whose reply arrived and validated.
   */
  readonly heardCheckers: number;

  /**
   * Wire irregularities across checkers in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the resolution checkers over one chunk's patched candidate.
 *
 * @param client - injected model client
 *
 * @param checkerModelIds - checker voices
 *
 * @param sourceText - original chunk text
 *
 * @param patchedText - candidate text after the apply gate
 *
 * @param issues - accepted issues the editors addressed
 *
 * @param authorship - who wrote `patchedText`, so a checker judging its own
 * work is heard at a discount rather than at full weight
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Per-issue tallies plus findings
 *
 * @example
 * ```ts
 * const checker = await runCheckerStage({ ... },);
 * ```
 */
export async function runCheckerStage(
  {
    client,
    checkerModelIds,
    sourceText,
    patchedText,
    issues,
    authorship,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly checkerModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly patchedText: string;
    readonly issues: readonly AdjudicatedIssue[];
    readonly authorship: IssueAuthorship;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<CheckerStageResult> {
  /**
   * Checker sheet for the patched candidate.
   */
  const plan = buildResolutionMessages({
    sourceText,
    patchedText,
    issues,
  },);

  /**
   * Heard checkers after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: checkerModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: RESOLUTION_RESPONSE_FORMAT,
    validate: isResolutionReportWire,
    stage: 'checker',
    l,
  },);

  /**
   * Resolved ballots keyed by checker id.
   */
  const ballots: Record<string, ResolutionBallot> = Object.fromEntries(
    gather.voices
      .map(function toEntry(voice,): readonly [
        string,
        ResolutionBallot,
      ] {
      return [
        voice.modelId,
        resolveResolutionChecks({
          wire: voice.value,
          issueIds: plan.issueIds,
        },),
      ];
    },),
  );

  /**
   * Quorum degradation plus ballot irregularities across heard checkers.
   */
  const findings = [
    ...gather.findings,
    ...Object
      .values(ballots,)
      .flatMap(function toFindings(ballot,) {
        return ballot.findings;
      },),
  ];

  /**
   * Majority tallies per issue.
   */
  const tallies = tallyResolutionChecks({
    issueIds: plan.issueIds,
    ballots,
    authorship,
  },);

  /**
   * Everything this round decided about each issue, kept rather than summed
   * away, so a settled run can answer who dissented and be re-read at another
   * roster width without buying the stage again.
   */
  const readings: Record<string, IssueCheckerReading> = Object.fromEntries(
    plan.issueIds
      .map(function toReading(issueId,): readonly [
        string,
        IssueCheckerReading,
      ] {
        return [
          issueId,
          {
            ballots: gather.voices
              .flatMap(function toBallot(voice,): readonly IssueCheckerBallot[] {
                /**
                 * This checker's answer, absent where its ballot skipped this
                 * issue.
                 */
                const verdict = nonNullishOrThrow(ballots[voice.modelId],)
                  .verdicts[issueId];
                if (verdict === undefined)
                  return [];
                return [
                  {
                    modelId: voice.modelId,
                    verdict,
                    wroteTheText: wroteTextForIssue({
                      authorship,
                      issueId,
                      modelId: voice.modelId,
                    },),
                  },
                ];
              },),
            configuredCheckers: checkerModelIds.length,
            tally: nonNullishOrThrow(tallies[issueId],),
          },
        ];
      },),
  );

  // ALSO PUBLISHED AS LINES, because an operator watching a live pass has the
  // log and not the artifact, and because a run that aborts before settling
  // still leaves them. Derived from the readings so the two cannot drift.
  //
  // Ids and verdicts only: no line here carries a word of either document.
  for (
    const line of Object
      .entries(readings,)
      .flatMap(function toLines([issueId, reading,],): readonly string[] {
        return reading.ballots
          .map(function toLine(ballot,): string {
            return `checker-ballot ${ballot.modelId} ${issueId} ${ballot.verdict} ${
              ballot.wroteTheText
                ? 'author'
                : 'outsider'
            }`;
          },);
      },)
  )
    l.info(line,);

  l.info(
    `checker stage: ${String(Object.keys(ballots,)
      .length,)}/${
      String(checkerModelIds.length,)
    } heard`,
  );

  return {
    tallies,
    readings,
    heardCheckers: Object.keys(ballots,)
      .length,
    findings,
  };
}

//endregion Checker stage
