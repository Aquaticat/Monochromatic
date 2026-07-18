import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import {
  applyPatchOperations,
  type PatchOutcome,
} from './apply-patch.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { buildEditorMessages, } from './edit-prompt.ts';
import {
  EDITOR_RESPONSE_FORMAT,
  isEditorReportWire,
  resolveEditorEdits,
} from './edit-wire.ts';
import type { EditableEnvelope, } from './patch-model.ts';
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

//region Editor and checker stages
// The candidate-producing stages of one chunk's repair: one editor rewrites
// inside envelopes through the deterministic apply gate, then checker
// models judge whether each accepted issue is actually gone. A lost editor
// voice means an unchanged chunk; lost checker voices weaken the proof and
// with it the candidate's measurements.

/**
 * Everything the editor stage produced for one chunk.
 *
 * @example
 * ```ts
 * const { patch, editorHeard, } = await runEditorStage({ ... },);
 * ```
 */
export type EditorStageResult = {
  /**
   * Apply-gate outcome; unchanged text when the editor voice was lost.
   */
  readonly patch: PatchOutcome;

  /**
   * Whether the editor's reply arrived and validated.
   */
  readonly editorHeard: boolean;

  /**
   * Wire irregularities in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs one editor over one chunk's envelopes and applies the result.
 *
 * @param client - injected model client
 *
 * @param editorModelId - editor voice for this chunk
 *
 * @param editorRuleAddendum - extra rule line for prompt calibration
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text the envelopes were cut from
 *
 * @param envelopes - non-overlapping envelopes in document order
 *
 * @param issues - adjudicated issues the envelopes serve
 *
 * @param signal - caller abort honored by the exchange
 *
 * @param perCallTimeoutMs - deadline for the exchange
 *
 * @param l - pipeline logger
 *
 * @returns Apply-gate outcome plus findings
 *
 * @example
 * ```ts
 * const editor = await runEditorStage({ ... },);
 * ```
 */
export async function runEditorStage(
  {
    client,
    editorModelId,
    editorRuleAddendum,
    sourceText,
    targetText,
    envelopes,
    issues,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly editorModelId: SyntheticModelId;
    readonly editorRuleAddendum?: string;
    readonly sourceText: string;
    readonly targetText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<EditorStageResult> {
  /**
   * Editor sheet for this chunk.
   */
  const plan = buildEditorMessages({
    sourceText,
    targetText,
    envelopes,
    issues,
    ...(editorRuleAddendum === undefined ? {} : { editorRuleAddendum, }),
  },);

  /**
   * Editor's reply after retry-to-quorum;
   * a one-model roster means retries continue until the voice is heard
   * or the rounds are spent.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: [editorModelId,],
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: EDITOR_RESPONSE_FORMAT,
    validate: isEditorReportWire,
    stage: 'editor',
    l,
  },);

  /**
   * Sole editor voice, when heard.
   */
  const [voice,] = gather.voices;
  if (voice === undefined) {
    return {
      patch: {
        patchedText: targetText,
        applied: [],
        rejected: [],
      },
      editorHeard: false,
      findings: gather.findings,
    };
  }

  /**
   * Operations bound through the prompt plan.
   */
  const {
    operations,
    findings,
  } = resolveEditorEdits({
    wire: voice.value,
    envelopes: plan.envelopes,
  },);

  /**
   * Apply-gate outcome over the resolved operations.
   */
  const patch = applyPatchOperations({
    targetText,
    envelopes,
    operations,
  },);

  l.info(
    `editor stage: ${String(patch.applied
      .length,)} applied, ${
      String(patch.rejected
        .length,)
    } rejected, ${String(findings.length,)} findings`,
  );

  return {
    patch,
    editorHeard: true,
    findings,
  };
}

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
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly checkerModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly patchedText: string;
    readonly issues: readonly AdjudicatedIssue[];
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

//endregion Editor and checker stages
