import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
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
   * One line per ballot, naming the checker, the issue and its verdict.
   *
   * BECAUSE THE TALLY THAT FOLLOWS IS A SUM, and a sum cannot be taken apart.
   * Nothing else in the pipeline records which checker said what, so a run that
   * resolves an issue two-to-one leaves no trace of who dissented and no later
   * question about this roster can be answered off a settled run without buying
   * the whole stage again.
   *
   * THE AUTHOR MARKER IS WHAT MAKES A RE-TALLY POSSIBLE. It is the one input to
   * each weight that is not in the ballot itself, so a reader holding these
   * lines can reproduce this tally, or any tally over a subset of these
   * checkers, without the authorship record.
   *
   * Ids and verdicts only: no line here carries a word of either document.
   */
  const ballotLines = gather.voices
    .flatMap(function toLines(voice,): readonly string[] {
      /**
       * This checker's ballot, present because `ballots` was built from these
       * same voices.
       */
      const ballot = nonNullishOrThrow(ballots[voice.modelId],);
      return Object
        .entries(ballot.verdicts,)
        .map(function toLine([issueId, verdict,],): string {
          return `checker-ballot ${voice.modelId} ${issueId} ${verdict} ${
            wroteTextForIssue({
              authorship,
              issueId,
              modelId: voice.modelId,
            },)
              ? 'author'
              : 'outsider'
          }`;
        },);
    },);
  for (const line of ballotLines)
    l.info(line,);

  /**
   * Majority tallies per issue.
   */
  const tallies = tallyResolutionChecks({
    issueIds: plan.issueIds,
    ballots,
    authorship,
  },);

  l.info(
    `checker stage: ${String(Object.keys(ballots,)
      .length,)}/${
      String(checkerModelIds.length,)
    } heard`,
  );

  return {
    tallies,
    heardCheckers: Object.keys(ballots,)
      .length,
    findings,
  };
}

//endregion Checker stage
