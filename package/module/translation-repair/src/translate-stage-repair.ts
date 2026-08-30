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

/**
 * Sentinel identifying initial rendering before any rejected slate exists.
 */
const INITIAL_TRANSLATION_TASK: unique symbol = Symbol('translation stage has no rejected slate yet',);

/**
 * Produces and judges until absent passage settles or unique evidence cycles.
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
 * @param incumbentKind - whether fallback text exists
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Settled text and evidence
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
   * Canonical follow-up tasks already attempted in this stage invocation.
   */
  const attemptedFollowups = new Set<string>();
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- sequential repair state advances only from latest exact rejection */
  /**
   * Initial task sentinel or latest exact rejection evidence.
   */
  let task: typeof INITIAL_TRANSLATION_TASK | TranslateFollowupEvidence = INITIAL_TRANSLATION_TASK;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */
  while (!signal.aborted) {
    if ((typeof task) !== 'symbol') {
      /**
       * Canonical task identity excluding transport metadata.
       */
      const followupIdentity = JSON.stringify(task,);
      if (attemptedFollowups.has(followupIdentity,)) {
        throw new TranslationRepairInterruptedError({
          reason: 'production-cycle',
          findings: task.findings,
        },);
      }
      attemptedFollowups.add(followupIdentity,);
    }

    /* oxlint-disable no-await-in-loop -- each rendering task depends on latest rejected slate */
    /**
     * Slate produced initially or from latest exact rejection evidence.
     */
    const produced = await produceTranslateSlate({
      client,
      translatorModelIds,
      sourceText,
      incumbentText,
      ...((identityContext === undefined) ? {} : { identityContext, }),
      ...((pictureContext === undefined) ? {} : { pictureContext, }),
      ...((syntax === undefined) ? {} : { syntax, }),
      ...(((typeof task) === 'symbol') ? {} : { followupEvidence: task, }),
      lineStructured,
      signal,
      perCallTimeoutMs,
      l,
    },);
    /* oxlint-enable no-await-in-loop */

    try {
      // oxlint-disable-next-line no-await-in-loop -- judging result determines next rendering evidence
      return await judgeSlateWithRetry({
        judging: {
          client,
          produced,
          judgeModelIds,
          sourceText,
          incumbentText,
          incumbentKind,
          ...((identityContext === undefined) ? {} : { identityContext, }),
          ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
          ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
          ...((pictureContext === undefined) ? {} : { pictureContext, }),
          ...((syntax === undefined) ? {} : { syntax, }),
          lineStructured,
          signal,
          perCallTimeoutMs,
          l,
        },
      },);
    }
    catch (error) {
      if (signal.aborted)
        throw signal.reason;
      if (!(error instanceof TranslateAbsenceError))
        throw error;
      if (error.reason === 'no-voice-heard') {
        throw new TranslationRepairInterruptedError({
          reason: 'provider-unavailable',
          findings: error.findings,
        },);
      }
      /**
       * Latest exact rejected candidate texts in deterministic slate order.
       */
      const candidateTexts = produced
        .candidates
        .map(function candidateText(candidate,): string {
          return candidate
            .value
            .text;
        },);
      /**
       * Rejected candidate count safe for operational log.
       */
      const candidateCount = candidateTexts.length;
      task = {
        reason: error.reason,
        candidateTexts,
        findings: error.findings,
      };
      l.info(
        `translate stage: continuing absent-passage repair after ${error.reason}; `
          + `${String(candidateCount,)} rejected candidates`,
      );
    }
  }
  throw signal.reason;
}

//endregion Translate stage repair
