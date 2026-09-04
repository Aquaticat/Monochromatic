import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { consolidationNeedsRecovery, } from './consolidation-stage-repair.ts';
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
  readonly judgeModelIds?: readonly RosterModelId[];
  readonly subject: ConsolidateSubject & ConsolidationSubject;
  readonly standingText: string;
  readonly lineStructured: boolean;
  readonly sliceIndex: number;
  readonly polishConfig?: ConsolidationPolishConfig;
  readonly standingMayShip?: boolean;
  readonly standingEligible?: boolean;
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
 * @param roster - voices producing, and judging and gating when no narrower
 * judge roster is given
 *
 * @param judgeModelIds - voices judging the slate and gating the winner; the
 * producers' roster by default
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
 * @param standingEligible - whether the baseline passed the deterministic
 * publication gate; a baseline that did not is withheld from the slate
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
    judgeModelIds = roster,
    subject,
    standingText,
    lineStructured,
    sliceIndex,
    polishConfig,
    standingMayShip = true,
    standingEligible = true,
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
      judgeModelIds,
      subject,
      voices: [],
      validity: [],
      producedFindings: [],
      standingText,
      lineStructured,
      sliceIndex,
      ...((polishConfig === undefined) ? {} : { polishConfig, }),
      standingMayShip,
      standingEligible,
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
    judgeModelIds,
    subject,
    voices: produced.voices,
    validity: produced.validity,
    producedFindings: produced.findings,
    standingText,
    lineStructured,
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { polishConfig, }),
    standingMayShip,
    standingEligible,
    signal,
    perCallTimeoutMs,
    l,
  },);
}

/**
 * Buys one consolidation and settles it in a single attempt.
 *
 * SINGLE ATTEMPT BY DESIGN: when the standing baseline lacks contest
 * endorsement and the judged round still keeps it, the settlement returns
 * as it is with the non-endorsement recorded as a finding, because the
 * standing text is the only wording the deterministic gate has passed and
 * quality machinery may not withhold the entry over it
 * (doc/planning/translation-repair-no-loop-design.md). Zero produced voices
 * under a barred standing remain the bounded provider error inside the
 * attempt.
 *
 * @param input - stage clients, candidates, standing policy, and operation bounds
 *
 * @returns Complete settlement for this question
 *
 * @throws {@link TranslationRepairInterruptedError} when a barred standing hears no producer voice
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
  /**
   * Settlement from the single attempt.
   */
  const settlement = await buyConsolidationAttempt(input,);
  if (!consolidationNeedsRecovery({
    settlement,
    standingMayShip,
  }))
    return settlement;
  input.l
    .warn(
      `slice ${String(input.sliceIndex,)}: standing lacks contest endorsement and the single `
        + `consolidation attempt kept it (${settlement.terminal}); shipping with the finding recorded`,
    );
  return {
    ...settlement,
    findings: [
      ...settlement.findings,
      `consolidation-standing-unendorsed (terminal ${settlement.terminal}):`
        + ' the standing text ships with contest non-endorsement recorded as evidence',
    ],
  };
}

//endregion Consolidate slice buy
