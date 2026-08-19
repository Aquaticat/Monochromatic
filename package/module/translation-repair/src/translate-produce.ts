import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { Candidate, } from './candidate-select-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import {
  buildTranslateCandidates,
  type TranslateCandidateValue,
} from './translate-candidates.ts';
import { repairInvalidCandidates, } from './translate-repair.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import {
  buildTranslateMessages,
  isTranslateReportWire,
  TRANSLATE_RESPONSE_FORMAT,
} from './translate-wire.ts';

//region Translate produce
// The half of the translate stage that WRITES: several models render the slice
// independently, invalid renderings go back to their authors, and the distinct
// survivors become a slate with the incumbent among them.
//
// SPLIT FROM JUDGING so one slate can be judged more than once. Everything here
// is stochastic and expensive, and everything after it is a question put to
// judges about a fixed set of texts. While the two were one call, any caller
// wanting to ask that question twice had to buy a second slate, so the two
// answers differed in the candidates as well as in whatever the caller meant to
// vary. `#108` wants the judged evidence varied with the slate held still, and
// `#84`'s position-bias attempt wants the slate held still while ballot position
// moves; neither is expressible against a stage that reproduces on every call.
//
// The rosters are NOT checked here. `assertJudgeableProducerRoster` needs both
// sides, so it belongs to whoever holds both: `runTranslateStage` does it, and a
// caller driving the halves directly has to do it too.

/**
 * A slate as the judges will receive it, with what producing it cost and found.
 *
 * @example
 * ```ts
 * const slate: ProducedSlate = await produceTranslateSlate({ ... },);
 * ```
 */
export type ProducedSlate = {
  /**
   * Distinct proposals, incumbent among them when it has text.
   */
  readonly candidates: readonly Candidate<TranslateCandidateValue>[];

  /**
   * Translators that answered usably, out of those seated.
   *
   * Carried because a decision taken over a thin slate is not the same
   * decision, and the judging half has no other way to know.
   */
  readonly heardTranslators: number;

  /**
   * Everything gathering, repairing and building recorded, in scorecard-stable
   * wording. Every exit of the judging half reports these ahead of its own.
   */
  readonly findings: readonly string[];
};

/**
 * Renders one slice several times and returns the slate to judge.
 *
 * @param client - injected model client
 *
 * @param translatorModelIds - models rendering the slice independently
 *
 * @param sourceText - original slice text
 *
 * @param incumbentText - translation as it stands, blank where this slice has
 * none
 *
 * @param identityContext - declared names from both sides' front matter,
 * omitted when neither declares anything
 *
 * @param lineStructured - whether the enclosing chunk's original is
 * line-structured, decided by the caller
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Slate, heard count and findings
 *
 * @example
 * ```ts
 * const slate = await produceTranslateSlate({ client, translatorModelIds, sourceText, incumbentText, lineStructured, signal, perCallTimeoutMs, l, },);
 * ```
 */
export async function produceTranslateSlate(
  {
    client,
    translatorModelIds,
    sourceText,
    incumbentText,
    identityContext,
    pictureContext,
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly translatorModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly identityContext?: string;
    readonly pictureContext?: string;
    readonly lineStructured: boolean;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ProducedSlate> {
  /**
   * Logger tagged with this half.
   */
  const tl = tagged({
    tag: produceTranslateSlate.name,
    l,
  },);

  /**
   * Translator sheet shared by every translator, so their renderings answer the
   * same question and stay comparable.
   */
  const plan = buildTranslateMessages({
    sourceText,
    existingText: incumbentText,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    ...((pictureContext === undefined) ? {} : { pictureContext, }),
    lineStructured,
  },);

  /**
   * Translator replies after retry-to-quorum.
   */
  const gather = await gatherStageVoices({
    client,
    modelIds: translatorModelIds,
    messages: plan.messages,
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    responseFormat: TRANSLATE_RESPONSE_FORMAT,
    validate: isTranslateReportWire,
    stage: 'translate',
    l: tl,
  },);

  /**
   * Candidates after structural validation, with anything that failed handed
   * back to its own author.
   *
   * The INCUMBENT is not among these and is never validated into or out of
   * the slate. It is the fallback and the text being defended, so a check
   * that could drop it would be a check that could delete the archive.
   */
  const repaired = await repairInvalidCandidates({
    client,
    voices: gather.voices,
    sourceText,
    incumbentText,
    priorMessages: plan.messages,
    signal,
    perCallTimeoutMs,
    l: tl,
  },);

  /**
   * Slate of distinct proposals with the incumbent among them.
   */
  const built = buildTranslateCandidates({
    voices: repaired.voices,
    translatorModelIds,
    incumbentText,
  },);

  return {
    candidates: built.candidates,
    heardTranslators: gather.voices
      .length,
    /**
     * Findings shared by every exit after the fan-out.
     */
    findings: [
      ...gather.findings,
      ...repaired.findings,
      ...built.findings,
      `translate-candidates (${String(gather.voices
        .length,)}/${String(translatorModelIds.length,)} heard, ${
        String(built.candidates
          .length,)
      } distinct, ${String(built.collapsed,)} collapsed)`,
    ],
  };
}

//endregion Translate produce
