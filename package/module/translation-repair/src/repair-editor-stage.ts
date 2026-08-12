import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { PatchOutcome, } from './apply-patch.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { buildEditorMessages, } from './edit-prompt.ts';
import {
  EDITOR_RESPONSE_FORMAT,
  isEditorReportWire,
} from './edit-wire.ts';
import {
  buildChunkCandidates,
  buildEditorCandidates,
  pickFallbackPatch,
} from './editor-candidates.ts';
import {
  applyCandidate,
  selectChunkPatch,
  selectPerEnvelope,
} from './editor-ensemble.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import { assertJudgeableEditorRoster, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Editor stage
// Several editors rewrite one chunk's envelopes independently, every proposal
// passes the same deterministic apply gate, and judges that wrote none of them
// choose what ships. This is the stage that used to be one model deciding
// alone.
//
// The stage never returns the untouched translation just because judging failed
// to converge: a decline ships the fallback repair. It returns the untouched
// translation only when no editor produced an operation that survived the gate,
// which is the same condition the single-editor stage exited on.

/**
 * Everything the editor stage produced for one chunk.
 *
 * @example
 * ```ts
 * const { patch, heardEditors, } = await runEditorStage({ ... },);
 * ```
 */
export type EditorStageResult = {
  /**
   * Apply-gate outcome of the winning candidate;
   * unchanged text when every editor voice was lost or every operation was
   * refused.
   */
  readonly patch: PatchOutcome;

  /**
   * Editors whose reply arrived and validated.
   */
  readonly heardEditors: number;

  /**
   * Wire irregularities and selection telemetry in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the editor ensemble over one chunk and returns the patch that ships.
 *
 * @param client - injected model client
 *
 * @param editorModelIds - editors proposing candidates
 *
 * @param judgeModelIds - whole roster selection draws judges from
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
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Winning patch plus findings
 *
 * @throws {@link import('./repair-contract.ts').EditorRosterError} when every
 * judge also edits
 *
 * @example
 * ```ts
 * const editor = await runEditorStage({ ... },);
 * ```
 */
export async function runEditorStage(
  {
    client,
    editorModelIds,
    judgeModelIds,
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
    readonly editorModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
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
  assertJudgeableEditorRoster({
    editorModelIds,
    judgeModelIds,
  },);

  /**
   * Editor sheet shared by every editor, so their candidates answer the same
   * question and stay comparable.
   */
  const plan = buildEditorMessages({
    sourceText,
    targetText,
    envelopes,
    issues,
    ...(editorRuleAddendum === undefined ? {} : { editorRuleAddendum, }),
  },);

  /**
   * Editor replies after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: editorModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: EDITOR_RESPONSE_FORMAT,
    validate: isEditorReportWire,
    stage: 'editor',
    // Every voice, not half of them. This stage is an ENSEMBLE, and the
    // quorum rule computes ceil(rosterSize / 2), which on a small roster is
    // satisfied by a single model: that is how one provider-side output
    // change halved the editor pair on 71 of 405 chunks without any run
    // reporting a fault. Retries cost tokens, which this plan does not
    // meter, and losing an independent voice costs the property the stage
    // exists to provide.
    retryTarget: 'full-roster',
    l,
  },);

  /**
   * Untouched outcome shared by both early exits.
   */
  const unchanged: PatchOutcome = {
    patchedText: targetText,
    applied: [],
    rejected: [],
  };

  /**
   * One gated patch per heard editor, in roster order.
   */
  const built = buildEditorCandidates({
    voices: gather.voices,
    editorModelIds,
    promptEnvelopes: plan.envelopes,
    targetText,
    envelopes,
  },);

  /**
   * Candidates that actually repair something; one that landed no operation is
   * the untouched translation, which competes downstream anyway.
   */
  const repairing = built.candidates
    .filter(function landedWork(candidate,) {
      return candidate.patch
        .applied
        .length
        > 0;
    },);

  /**
   * Findings shared by every exit after the fan-out.
   */
  const stageFindings = [
    ...gather.findings,
    ...built.findings,
    `editor-candidates (${String(gather.voices
      .length,)}/${String(editorModelIds.length,)} heard, ${
      String(repairing.length,)
    } repairing)`,
  ];
  if (repairing.length === 0) {
    l.info('editor stage: no operation survived the gate',);
    return {
      patch: unchanged,
      heardEditors: gather.voices
        .length,
      findings: stageFindings,
    };
  }

  /**
   * Per-envelope winners assembled into one operation set.
   */
  const perEnvelope = await selectPerEnvelope({
    client,
    candidates: repairing,
    envelopes,
    judgeModelIds,
    sourceText,
    targetText,
    signal,
    perCallTimeoutMs,
    l,
  },);

  /**
   * Composite candidate, scored through the same gate as a model's own.
   */
  const composite = applyCandidate({
    targetText,
    envelopes,
    operations: perEnvelope.operations,
  },);

  /**
   * Distinct whole-chunk proposals for the judges.
   */
  const chunkSet = buildChunkCandidates({
    candidates: repairing,
    composite,
    contributors: perEnvelope.contributors,
  },);

  /**
   * Winning patch, or the strongest editor patch when judges declined.
   */
  const patch = await selectChunkPatch({
    client,
    candidates: chunkSet.candidates,
    judgeModelIds,
    sourceText,
    indecisionFallback: pickFallbackPatch({ candidates: repairing, },),
    rejectionFallback: unchanged,
    signal,
    perCallTimeoutMs,
    l,
  },);

  l.info(
    `editor stage: ${String(patch.applied
      .length,)} applied, ${
      String(patch.rejected
        .length,)
    } rejected across ${String(chunkSet.candidates
      .length,)} distinct candidates`,
  );

  return {
    patch,
    heardEditors: gather.voices
      .length,
    findings: [
      ...stageFindings,
      `editor-envelope-select (${String(perEnvelope.soleCount,)} sole, ${
        String(perEnvelope.judgedCount,)
      } judged, ${String(perEnvelope.declinedCount,)} declined)`,
      `editor-chunk-select (${String(chunkSet.candidates
        .length,)} distinct, ${String(chunkSet.collapsed,)} collapsed)`,
    ],
  };
}

//endregion Editor stage
