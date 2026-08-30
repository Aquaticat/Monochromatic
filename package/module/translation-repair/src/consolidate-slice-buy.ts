import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  consolidationFailureEvidence,
  consolidationNeedsRecovery,
} from './consolidation-stage-repair.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import { produceConsolidations, } from './consolidate-produce.ts';
import {
  type ConsolidationSettlement,
  type ConsolidationSubject,
  settleConsolidation,
} from './consolidate-settle.ts';
import type { ConsolidateSubject, } from './consolidate-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';

//region Consolidate slice buy

/**
 * Inputs shared by initial and continued consolidation attempts.
 */
type ConsolidationBuyInput = {
  readonly client: SyntheticClient;
  readonly roster: readonly RosterModelId[];
  readonly subject: ConsolidateSubject & ConsolidationSubject;
  readonly standingText: string;
  readonly lineStructured: boolean;
  readonly sliceIndex: number;
  readonly polishConfig?: ConsolidationPolishConfig;
  readonly standingMayShip?: boolean;
  readonly signal: AbortSignal;
  readonly perCallTimeoutMs: number;
  readonly l: Logger;
};
// Fresh model work for one consolidation question. Resume, twin reuse, cache
// eligibility and ordered document aggregation remain driver responsibilities.

/**
 * Buys and settles one third-rendering slate, or settles no standing text
 * without asking producers.
 *
 * @param client - provider client borrowed by every round
 *
 * @param roster - voices producing, judging and gating
 *
 * @param subject - slice and both lane candidates as every round sees them
 *
 * @param standingText - wording this consolidation must beat
 *
 * @param lineStructured - whether structural rule forbids merged lines
 *
 * @param sliceIndex - index used by logs and final polish records
 *
 * @param polishConfig - final body polish roles and guard facts
 *
 * @param standingMayShip - whether unchanged baseline has prior endorsement
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - driver logger
 *
 * @returns Complete settlement for this question
 *
 * @throws Whatever producer, judging, gate, or caller abort throws
 *
 * @example
 * ```ts
 * const settlement = await buyConsolidationSlice({
 *   client,
 *   roster,
 *   subject,
 *   standingText,
 *   lineStructured,
 *   sliceIndex,
 *   signal,
 *   perCallTimeoutMs,
 *   l,
 * },);
 * ```
 *
 * @internal
 */
async function buyConsolidationAttempt(
  {
    client,
    roster,
    subject,
    standingText,
    lineStructured,
    sliceIndex,
    polishConfig,
    standingMayShip = true,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<ConsolidationBuyInput>,
): Promise<ConsolidationSettlement> {
  // NO STANDING TEXT BUYS NO SLATE. Settlement still comes from one stage so
  // terminal, floor and findings retain their ordinary meanings.
  if (standingText === '') {
    l.info(
      `slice ${String(sliceIndex,)}: no standing text to consolidate against, so no slate is bought`,
    );
    return await settleConsolidation({
      client,
      roster,
      subject,
      voices: [],
      validity: [],
      producedFindings: [],
      standingText,
      lineStructured,
      sliceIndex,
      ...((polishConfig === undefined) ? {} : { polishConfig, }),
      standingMayShip,
      signal,
      perCallTimeoutMs,
      l,
    },);
  }

  /**
   * Slate produced once and judged once for this question.
   */
  const produced = await produceConsolidations({
    client,
    roster,
    subject,
    standingText,
    signal,
    perCallTimeoutMs,
    l,
  },);
  if ((!standingMayShip) && (produced.voices
    .length
    === 0)) {
    throw new TranslationRepairInterruptedError({
      reason: 'provider-unavailable',
      findings: produced.findings,
    },);
  }

  return await settleConsolidation({
    client,
    roster,
    subject,
    voices: produced.voices,
    validity: produced.validity,
    producedFindings: produced.findings,
    standingText,
    lineStructured,
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { polishConfig, }),
    standingMayShip,
    signal,
    perCallTimeoutMs,
    l,
  },);
}

/**
 * Continues consolidation until unendorsed standing wording is replaced or work is interrupted.
 *
 * @param input - stage clients, candidates, standing policy, and operation bounds
 *
 * @returns Complete settlement safe against prior contest standing
 *
 * @throws {@link TranslationRepairInterruptedError} on exact recovery cycle
 *
 * @example
 * ```ts
 * const settlement = await buyConsolidationSlice(input);
 * ```
 */
export async function buyConsolidationSlice(
  input: ForeignBorrowed<ConsolidationBuyInput>,
): Promise<ConsolidationSettlement> {
  /**
   * Whether archive or lane standing may already ship.
   */
  const standingMayShip = input.standingMayShip ?? true;
  if (standingMayShip)
    return await buyConsolidationAttempt(input,);
  /**
   * Latest failed strategy shown to next producers.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Stage-local recovery advances exact failed evidence until replacement or cycle.
  let priorFailure: ConsolidateSubject['priorFailure'] = undefined;
  /**
   * Exact recovery questions already attempted.
   */
  const attemptedTasks = new Set<string>();
  while (!input.signal
    .aborted) {
    /**
     * Exact prior evidence defining current recovery responsibility.
     */
    const identity = JSON.stringify(priorFailure ?? null,);
    if (attemptedTasks.has(identity,)) {
      throw new TranslationRepairInterruptedError({
        reason: 'final-selection-unresolved',
        findings: priorFailure?.findings ?? [],
      },);
    }
    attemptedTasks.add(identity,);
    /**
     * Settlement from initial or latest failed-strategy-aware attempt.
     */
    // oxlint-disable-next-line no-await-in-loop -- Every consolidation attempt depends on exact prior rejected settlement.
    const settlement = await buyConsolidationAttempt({
      ...input,
      subject: {
        ...input.subject,
        ...((priorFailure === undefined) ? {} : { priorFailure, }),
      },
    },);
    if (!consolidationNeedsRecovery({
      settlement,
      standingMayShip,
    }))
      return settlement;
    priorFailure = consolidationFailureEvidence({ settlement, });
  }
  input.signal
    .throwIfAborted();
  throw new TranslationRepairInterruptedError({
    reason: 'provider-unavailable',
    findings: priorFailure?.findings ?? [],
  },);
}

//endregion Consolidate slice buy
