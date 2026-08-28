import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import { produceConsolidations, } from './consolidate-produce.ts';
import {
  type ConsolidationSettlement,
  type ConsolidationSubject,
  settleConsolidation,
} from './consolidate-settle.ts';
import type { ConsolidateSubject, } from './consolidate-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Consolidate slice buy
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
export async function buyConsolidationSlice(
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
  }: ForeignBorrowed<{
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
  }>,
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

//endregion Consolidate slice buy
