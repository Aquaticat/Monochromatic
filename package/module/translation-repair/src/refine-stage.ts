import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { applyPatchOperations, } from './apply-patch.ts';
import {
  type Candidate,
  producerModelIds,
} from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { gateParagraphRewrite, } from './inspect-paragraph.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import { buildRefineMessages, } from './refine-prompt.ts';
import {
  isRefineReportWire,
  REFINE_RESPONSE_FORMAT,
  resolveRefineRewrites,
} from './refine-wire.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Refinement stage
// One slice's naturalness pass over already-repaired text.
//
// Every exit that is not a clear win returns the input text unchanged. That is
// stricter than the editor stage on purpose: the editor works from issues a
// panel accepted and checkers afterwards prove each one gone, while nothing
// here ever claimed the text was wrong. When judges fail to agree, the right
// answer is the text that was already good enough, so BOTH decline
// dispositions fall back rather than only rejection.

/**
 * Everything one slice's refinement decided.
 *
 * @example
 * ```ts
 * const { refinedText, changed, } = await runRefineStage({ ... },);
 * ```
 */
export type RefineStageResult = {
  /**
   * Text that ships; equals the input whenever nothing clearly won.
   */
  readonly refinedText: string;

  /**
   * Whether a refinement actually won.
   */
  readonly changed: boolean;

  /**
   * Models whose rewrites the shipped text carries, empty when unchanged;
   * the caller bars them from rechecking their own work.
   */
  readonly contributors: readonly SyntheticModelId[];

  /**
   * Stage telemetry in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Runs the naturalness lane over one repaired slice.
 *
 * @param client - injected model client
 *
 * @param refinerModelIds - rewriters proposing refinements
 *
 * @param judgeModelIds - whole roster selection draws judges from
 *
 * @param sourceText - original chunk text, the faithfulness anchor
 *
 * @param repairedText - `T1`, the text refinement may improve
 *
 * @param envelopes - eligible paragraphs of `repairedText`, in document order
 *
 * @param definitions - link and footnote definitions from the whole document,
 * so a paragraph's references resolve during gating
 *
 * @param identityContext - declared names and handles, when any
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Shipped text plus what decided it
 *
 * @throws {@link import('./repair-contract.ts').EditorRosterError} when too few
 * judges sit outside the refiner roster
 *
 * @example
 * ```ts
 * const refined = await runRefineStage({ ... },);
 * ```
 */
export async function runRefineStage(
  {
    client,
    refinerModelIds,
    judgeModelIds,
    sourceText,
    repairedText,
    envelopes,
    definitions,
    identityContext,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly refinerModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly repairedText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly definitions: string;
    readonly identityContext?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RefineStageResult> {
  /**
   * Logger tagged with this stage.
   */
  const rl = tagged({
    tag: runRefineStage.name,
    l,
  },);

  /**
   * Outcome shared by every exit that ships the input untouched.
   */
  const unchanged: RefineStageResult = {
    refinedText: repairedText,
    changed: false,
    contributors: [],
    findings: [`refine-skipped (${String(envelopes.length,)} eligible paragraphs)`,],
  };
  if (envelopes.length === 0)
    return unchanged;
  assertJudgeableProducerRoster({
    producerModelIds: refinerModelIds,
    judgeModelIds,
    role: 'refiner',
  },);

  /**
   * Rewriter sheet, one call per slice so a rewriter sees the paragraphs
   * together rather than one at a time.
   */
  const plan = buildRefineMessages({
    sourceText,
    envelopes,
    ...(identityContext === undefined ? {} : { identityContext, }),
  },);

  /**
   * Rewriter replies after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: refinerModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: REFINE_RESPONSE_FORMAT,
    validate: isRefineReportWire,
    stage: 'refiner',
    // Retries stop at QUORUM, which on this three-refiner roster is two voices.
    // See the same note in `repair-editor-stage.ts`: waiting for every voice
    // let one degraded model stall every gather that seated it, and the user
    // removed the option on 2026-08-14.
    l,
  },);

  /**
   * One gated candidate per rewriter that proposed anything surviving.
   */
  const candidates = gather.voices
    .flatMap(function toCandidate(voice,) {
      /**
       * Operations bound to real paragraphs.
       */
      const resolution = resolveRefineRewrites({
        wire: voice.value,
        envelopes: plan.envelopes,
      },);

      /**
       * Operations whose replacement carried every protected atom through
       * unchanged and in order.
       */
      const gated = resolution.operations
        .filter(function survivesGate(operation,) {
          /**
           * Paragraph this operation replaces.
           */
          const envelope = plan.envelopes
            .find(function matches(candidate,) {
              return candidate.envelopeId === operation.envelopeId;
            },);
          if (envelope === undefined)
            return false;

          /**
           * Structural verdict over the proposed replacement.
           */
          const verdict = gateParagraphRewrite({
            base: envelope.baseText,
            candidate: operation.newText,
            definitions,
          },);
          if (verdict.kind === 'preserved')
            return true;
          rl.info(`${voice.modelId}: ${verdict.detail}`,);
          return false;
        },);
      if (gated.length === 0)
        return [];

      /**
       * This rewriter's whole-slice proposal through the deterministic gate.
       */
      const patch = applyPatchOperations({
        targetText: repairedText,
        envelopes,
        operations: gated,
        // EXEMPT, stated rather than defaulted. This lane rewrites a whole
        // paragraph for naturalness and has no accepted-issue quotes to license
        // that, so enforcing preservation here would reject exactly the work
        // the lane exists to do.
        preservation: { mode: 'skip', },
      },);
      if (patch.applied
        .length
        === 0)
        return [];
      return [
        {
          producer: {
            kind: 'model',
            modelId: voice.modelId,
          },
          value: patch.patchedText,
          rendered: patch.patchedText,
        } satisfies Candidate<string>,
      ];
    },);

  /**
   * Telemetry every exit after the fan-out carries.
   */
  const stageFindings = [
    ...gather.findings,
    `refine-candidates (${String(gather.voices
      .length,)}/${String(refinerModelIds.length,)} heard, ${
      String(candidates.length,)
    } proposing)`,
  ];
  if (candidates.length === 0) {
    return {
      ...unchanged,
      findings: stageFindings,
    };
  }

  /**
   * Judges verdict over the whole-slice proposals.
   */
  const outcome = await selectBestCandidate({
    client,
    candidates,
    judgeModelIds,
    task:
      'Each candidate is a revision of the CURRENT English translation below, meant to read more naturally without changing what it says.',
    criteria: [
      'Says exactly what the CURRENT text says: nothing added, dropped, softened, sharpened, or reattributed.',
      'Faithful to the Chinese ORIGINAL.',
      'Reads more naturally than the CURRENT text by a clear margin.',
    ],
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: sourceText,
      },
      {
        label: 'CURRENT English translation, which ships unchanged unless a candidate clearly beats it',
        text: repairedText,
      },
    ],
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (outcome.kind === 'declined') {
    // BOTH dispositions fall back, unlike the editor stage. There, judges
    // failing to rank repairs still leaves repairs the panel ruled necessary,
    // and a later gate makes them prove themselves. Here nothing claimed the
    // text was wrong and nothing downstream re-examines a refusal, so an
    // unresolved vote means the text that was already good enough ships.
    rl.info(`${outcome.reason}; keeping the repaired text`,);
    return {
      ...unchanged,
      findings: [
        ...stageFindings,
        ...outcome.findings,
        `refine-declined (${outcome.reason})`,
      ],
    };
  }

  /**
   * Models whose work the winning text carries.
   *
   * Read through `producerModelIds` rather than by branching on the kind here,
   * so a producer variant this lane never emits, the incumbent one the translate
   * lane needs, cannot break a stage that has no opinion about it.
   */
  const contributors = [...producerModelIds(outcome.producer,),];
  rl.info(`refinement from ${contributors.join(' + ',)} won weight ${String(outcome.voteWeight,)}`,);
  return {
    refinedText: outcome.value,
    changed: true,
    contributors,
    findings: [
      ...stageFindings,
      ...outcome.findings,
      `refine-selected (weight ${String(outcome.voteWeight,)} of ${String(outcome.tally
        .ballots,)} ballots)`,
    ],
  };
}

//endregion Refinement stage
