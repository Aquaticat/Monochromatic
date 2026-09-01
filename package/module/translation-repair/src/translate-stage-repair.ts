import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { SliceSyntax, } from './chunk-document.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import {
  TranslateAbsenceError,
  type IncumbentKind,
} from './translate-absence.ts';
import { produceTranslateSlate, } from './translate-produce.ts';
import { judgeSlateWithRetry, } from './translate-retry.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';
import type { TranslateFollowupEvidence, } from './translate-wire.ts';

//region Translate stage repair
// FIXED DEPTH TWO BY DESIGN: one initial round, then at most one statically
// named follow-up round carrying the judges' located rejection evidence, the
// one rejection-driven re-ask the no-loop design retains
// (doc/planning/translation-repair-no-loop-design.md). A second rejection
// rethrows the absence, which the slice attempt settles as an unfilled slice
// rather than a thrown entry.

/**
 * Everything one produce-and-judge round needs, shared by both rounds.
 */
type TranslateRoundInput = ForeignBorrowed<{
  readonly client: SyntheticClient;
  readonly translatorModelIds: readonly RosterModelId[];
  readonly judgeModelIds: readonly RosterModelId[];
  readonly sourceText: string;
  readonly incumbentText: string;
  readonly incumbentKind: IncumbentKind;
  readonly incumbentEligible: boolean;
  readonly identityContext?: string;
  readonly neighbouringIncumbentText?: string;
  readonly neighbouringSourceText?: string;
  readonly pictureContext?: string;
  readonly syntax?: SliceSyntax;
  readonly lineStructured: boolean;
  readonly signal: AbortSignal;
  readonly perCallTimeoutMs: number;
  readonly l: Logger;
}>;

/**
 * Produces one slate and judges it, optionally under rejection evidence.
 *
 * @param input - round configuration shared by both fixed rounds
 *
 * @param followupEvidence - located rejection evidence, absent on the initial round
 *
 * @returns Settled text and evidence
 *
 * @throws {@link TranslateAbsenceError} when judging leaves an absent passage unwritten
 *
 * @example
 * ```ts
 * const result = await produceAndJudgeOnce({ input, },);
 * ```
 */
async function produceAndJudgeOnce(
  {
    input,
    followupEvidence,
  }: {
    readonly input: TranslateRoundInput;
    readonly followupEvidence?: TranslateFollowupEvidence;
  },
): Promise<{
  readonly result: TranslateStageResult;
  readonly candidateTexts: readonly string[];
} | {
  readonly rejection: TranslateAbsenceError;
  readonly candidateTexts: readonly string[];
}> {
  /**
   * Slate produced initially or from the located rejection evidence.
   */
  const produced = await produceTranslateSlate({
    client: input.client,
    translatorModelIds: input.translatorModelIds,
    sourceText: input.sourceText,
    incumbentText: input.incumbentText,
    incumbentEligible: input.incumbentEligible,
    ...((input.identityContext === undefined) ? {} : { identityContext: input.identityContext, }),
    ...((input.pictureContext === undefined) ? {} : { pictureContext: input.pictureContext, }),
    ...((input.syntax === undefined) ? {} : { syntax: input.syntax, }),
    ...((followupEvidence === undefined) ? {} : { followupEvidence, }),
    lineStructured: input.lineStructured,
    signal: input.signal,
    perCallTimeoutMs: input.perCallTimeoutMs,
    l: input.l,
  },);
  /**
   * Rejected candidate texts in deterministic slate order, for evidence.
   */
  const candidateTexts = produced
    .candidates
    .map(function candidateText(candidate,): string {
      return candidate
        .value
        .text;
    },);
  try {
    return {
      result: await judgeSlateWithRetry({
        judging: {
          client: input.client,
          produced,
          judgeModelIds: input.judgeModelIds,
          sourceText: input.sourceText,
          incumbentText: input.incumbentText,
          incumbentKind: input.incumbentKind,
          ...((input.identityContext === undefined) ? {} : { identityContext: input.identityContext, }),
          ...((input.neighbouringSourceText === undefined)
            ? {}
            : { neighbouringSourceText: input.neighbouringSourceText, }),
          ...((input.neighbouringIncumbentText === undefined)
            ? {}
            : { neighbouringIncumbentText: input.neighbouringIncumbentText, }),
          ...((input.pictureContext === undefined) ? {} : { pictureContext: input.pictureContext, }),
          ...((input.syntax === undefined) ? {} : { syntax: input.syntax, }),
          lineStructured: input.lineStructured,
          signal: input.signal,
          perCallTimeoutMs: input.perCallTimeoutMs,
          l: input.l,
        },
      },),
      candidateTexts,
    };
  }
  catch (error) {
    if (input.signal
      .aborted)
      throw input.signal
        .reason;
    if (!(error instanceof TranslateAbsenceError))
      throw error;
    if (error.reason === 'no-voice-heard') {
      throw new TranslationRepairInterruptedError({
        reason: 'provider-unavailable',
        findings: error.findings,
      },);
    }
    return {
      rejection: error,
      candidateTexts,
    };
  }
}

/**
 * Produces and judges an absent passage at fixed depth two.
 *
 * The follow-up round carries the judges' located rejection evidence,
 * the form the redesign measured as the one safe re-ask shape;
 * a second rejection rethrows so the slice settles unfilled,
 * never as a thrown entry.
 *
 * @param client - injected model client
 *
 * @param translatorModelIds - models rendering each task independently
 *
 * @param judgeModelIds - models judging each produced slate
 *
 * @param sourceText - original passage to render
 *
 * @param incumbentText - existing translation, blank for absent passage
 *
 * @param incumbentKind - whether fallback text exists and passes deterministic source floor
 *
 * @param incumbentEligible - whether existing text may appear on candidate slate
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Settled text and evidence
 *
 * @throws {@link TranslateAbsenceError} when both fixed rounds leave the passage unwritten
 *
 * @throws {@link TranslationRepairInterruptedError} when no judging voice was heard
 *
 * @example
 * ```ts
 * const result = await runTranslateRepairs({ ...inputs, });
 * ```
 */
export async function runTranslateRepairs(
  {
    client,
    translatorModelIds,
    judgeModelIds,
    sourceText,
    incumbentText,
    incumbentKind,
    incumbentEligible = true,
    identityContext,
    neighbouringIncumbentText,
    neighbouringSourceText,
    pictureContext,
    syntax,
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly translatorModelIds: readonly RosterModelId[];
    readonly judgeModelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly incumbentKind: IncumbentKind;
    readonly incumbentEligible?: boolean;
    readonly identityContext?: string;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
    readonly pictureContext?: string;
    readonly syntax?: SliceSyntax;
    readonly lineStructured: boolean;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateStageResult> {
  /**
   * Round configuration shared by the initial and follow-up rounds.
   */
  const input: TranslateRoundInput = {
    client,
    translatorModelIds,
    judgeModelIds,
    sourceText,
    incumbentText,
    incumbentKind,
    incumbentEligible,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
    ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
    ...((pictureContext === undefined) ? {} : { pictureContext, }),
    ...((syntax === undefined) ? {} : { syntax, }),
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  };
  /**
   * Initial round with no rejection evidence.
   */
  const first = await produceAndJudgeOnce({ input, },);
  if ('result' in first)
    return first.result;
  l.info(
    `translate stage: one follow-up round after ${first.rejection
      .reason}; `
      + `${String(first.candidateTexts
        .length,)} rejected candidates`,
  );
  /**
   * Single follow-up round carrying the located rejection evidence.
   */
  const second = await produceAndJudgeOnce({
    input,
    followupEvidence: {
      reason: first.rejection
        .reason,
      candidateTexts: first.candidateTexts,
      findings: first.rejection
        .findings,
    },
  },);
  if ('result' in second)
    return second.result;
  // Depth two is spent: the absence is settled evidence now, and the slice
  // attempt records the passage as unfilled instead of throwing the entry.
  throw second.rejection;
}

//endregion Translate stage repair
