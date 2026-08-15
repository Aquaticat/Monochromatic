import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { attemptStageCall, } from './stage-call.ts';
import type { HeardVoice, } from './stage-quorum.ts';
import {
  buildTranslateRepairMessages,
  isTranslateRepairWire,
  TRANSLATE_REPAIR_RESPONSE_FORMAT,
} from './translate-repair-wire.ts';
import { validateTranslatedSlice, } from './translate-validate.ts';
import type { TranslateReportWire, } from './translate-wire.ts';

//region Translate repair
// Structural validation, and the conversation a failing candidate gets instead
// of being dropped.
//
// User decision, 2026-08-14. The alternatives were dropping an invalid
// candidate, showing judges everything, and dropping only on reference damage;
// all three were rejected in favour of asking the model that wrote it. What
// comes back is one of three answers, and the interesting one is the third: a
// model can say the finding is a fact about the passage rather than about its
// work, which no filter could ever have collected.
//
// The INCUMBENT never passes through here. It is the fallback and the thing
// being defended, so a validator that could drop it would be a validator that
// could delete the archive.

/**
 * One translator's final text after validation, with what happened to it.
 *
 * @example
 * ```ts
 * const outcome: RepairOutcome = { voice, findings: [], };
 * ```
 */
export type RepairOutcome = {
  /**
   * Voice to build a candidate from, revised where the author revised it.
   */
  readonly voice: HeardVoice<TranslateReportWire>;

  /**
   * What validation and the follow-up turn recorded, in scorecard-stable
   * wording.
   */
  readonly findings: readonly string[];
};

/**
 * Validates one candidate and, when it fails, asks its author about it.
 *
 * @param client - injected model client
 *
 * @param voice - this translator's reply
 *
 * @param sourceText - original slice the candidate renders
 *
 * @param priorMessages - exact messages that produced the candidate
 *
 * @param signal - caller abort honored by the follow-up exchange
 *
 * @param perCallTimeoutMs - deadline for it
 *
 * @param l - stage logger
 *
 * @returns Final voice for this model plus what was recorded
 *
 * @example
 * ```ts
 * const outcome = await repairOneCandidate({ client, voice, sourceText, ... },);
 * ```
 */
async function repairOneCandidate(
  {
    client,
    voice,
    sourceText,
    priorMessages,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly voice: HeardVoice<TranslateReportWire>;
    readonly sourceText: string;
    readonly priorMessages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<RepairOutcome> {
  /**
   * Structural verdict over what this model returned.
   */
  const validation = validateTranslatedSlice({
    sourceText,
    candidateText: voice.value
      .translation,
  },);
  if (validation.kind === 'valid')
    return {
      voice,
      findings: [],
    };

  // Nothing to compare against says nothing about the candidate, so it stands
  // as written and the gap is recorded rather than charged to the model.
  if (validation.kind === 'unknown')
    return {
      voice,
      findings: [`translate-unvalidated (${validation.detail})`,],
    };

  /**
   * What validation found, recorded whatever the author answers.
   */
  const found = validation.findings
    .map(function toFinding(finding,): string {
      return `translate-invalid (${voice.modelId}): ${finding}`;
    },);

  /**
   * The author's answer to its own findings.
   */
  const answer = await attemptStageCall({
    client,
    modelId: voice.modelId,
    messages: buildTranslateRepairMessages({
      priorMessages,
      priorTranslation: voice.value
        .translation,
      findings: validation.findings,
    },),
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: TRANSLATE_REPAIR_RESPONSE_FORMAT,
    validate: isTranslateRepairWire,
    stage: 'translate-repair',
    l,
  },);
  if (!answer.heard) {
    return {
      voice,
      findings: [
        ...found,
        `translate-repair-unheard (${voice.modelId})`,
      ],
    };
  }

  /**
   * What the author decided, and why.
   */
  const {
    resolution,
    translation,
    explanation,
  } = answer.value;
  if (resolution !== 'revised') {
    return {
      voice,
      findings: [
        ...found,
        `translate-repair-${resolution} (${voice.modelId}): ${explanation}`,
      ],
    };
  }

  /**
   * Whether the revision actually resolved what was found.
   */
  const rechecked = validateTranslatedSlice({
    sourceText,
    candidateText: translation,
  },);

  // A revision that still fails is NOT taken. The model was asked to fix these
  // findings and did not, so nothing says the new text is better, while the
  // original is at least what it produced with the whole sheet in front of it.
  if (rechecked.kind === 'invalid') {
    return {
      voice,
      findings: [
        ...found,
        `translate-repair-unresolved (${voice.modelId}): ${explanation}`,
      ],
    };
  }
  l.info(`translate-repair: ${voice.modelId} revised its candidate`,);
  return {
    voice: {
      modelId: voice.modelId,
      value: { translation, },
    },
    findings: [
      ...found,
      `translate-repair-revised (${voice.modelId})`,
    ],
  };
}

/**
 * Validates every fresh candidate and gives each failing one back to its
 * author.
 *
 * Candidates are handled CONCURRENTLY, one follow-up call per failing model at
 * most, so a slice where every translator diverged costs one extra round rather
 * than one extra round each.
 *
 * @param client - injected model client
 *
 * @param voices - heard translator replies
 *
 * @param sourceText - original slice
 *
 * @param priorMessages - exact messages every translator was given
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - stage logger
 *
 * @returns Final voices in the order given, plus every finding
 *
 * @example
 * ```ts
 * const { voices, findings, } = await repairInvalidCandidates({ ... },);
 * ```
 */
export async function repairInvalidCandidates(
  {
    client,
    voices,
    sourceText,
    priorMessages,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly voices: readonly HeardVoice<TranslateReportWire>[];
    readonly sourceText: string;
    readonly priorMessages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<{
  readonly voices: readonly HeardVoice<TranslateReportWire>[];
  readonly findings: readonly string[];
}> {
  /**
   * One outcome per heard voice.
   */
  const outcomes = await Promise.all(
    voices.map(async function repairEach(voice,): Promise<RepairOutcome> {
      return await repairOneCandidate({
        client,
        voice,
        sourceText,
        priorMessages,
        signal,
        perCallTimeoutMs,
        l,
      },);
    },),
  );

  return {
    voices: outcomes.map(function toVoice(outcome,): HeardVoice<TranslateReportWire> {
      return outcome.voice;
    },),
    findings: outcomes.flatMap(function toFindings(outcome,): readonly string[] {
      return outcome.findings;
    },),
  };
}

//endregion Translate repair
