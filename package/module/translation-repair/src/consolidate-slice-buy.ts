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
import type { LaneText, } from './translate-candidates.ts';
import { TranslationRepairInterruptedError, } from './translation-repair-interrupted-error.ts';

//region Consolidate slice buy

/**
 Inputs shared by initial and continued consolidation attempts.
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
  /**
   Why the deterministic gate refused the standing, for the gate sheet
   (class fifty-six, 2026-09-18).
   */
  readonly standingRefusal?: string;
  readonly standingFindings?: readonly string[];
  /**
   Lane texts the slate offers beside the proposals (class forty,
   2026-09-17).
   */
  readonly laneTexts?: readonly LaneText[];
  readonly signal: AbortSignal;
  readonly perCallTimeoutMs: number;
  readonly l: Logger;
};
// Fresh model work for one consolidation question. Resume, twin reuse, cache
// eligibility and ordered document aggregation remain driver responsibilities.

/**
 Buys and settles one third-rendering slate, or settles no standing text
 without asking producers.
 
 @param client - provider client borrowed by every round
 
 @param roster - voices producing, and judging and gating when no narrower
 judge roster is given
 
 @param judgeModelIds - voices judging the slate and gating the winner; the
 producers' roster by default
 
 @param subject - slice and both lane candidates as every round sees them
 
 @param standingText - wording this consolidation must beat
 
 @param lineStructured - whether structural rule forbids merged lines
 
 @param sliceIndex - index used by logs and final polish records
 
 @param polishConfig - final body polish roles and guard facts
 
 @param standingMayShip - whether unchanged baseline has prior endorsement
 
 @param standingFindings - what reading the standing recorded, the
 incumbent's replacement of an ineligible standing among them
 
 @param standingEligible - whether the baseline passed the deterministic
 publication gate; a baseline that did not is withheld from the slate

 @param standingRefusal - why the deterministic gate refused the baseline,
 shown to the gate judges
 
 @param signal - caller abort honored by every exchange
 
 @param perCallTimeoutMs - deadline per exchange
 
 @param l - driver logger
 
 @returns Complete settlement for this question
 
 @throws Whatever producer, judging, gate, or caller abort throws
 
 @example
 ```ts
 const settlement = await buyConsolidationSlice({
   client,
   roster,
   subject,
   standingText,
   lineStructured,
   sliceIndex,
   signal,
   perCallTimeoutMs,
   l,
 },);
 ```
 
 @internal
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
    standingRefusal,
    standingFindings = [],
    laneTexts = [],
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<ConsolidationBuyInput>,
): Promise<ConsolidationSettlement> {
  // NO STANDING TEXT BUYS NO SLATE. Settlement still comes from one stage so
  // terminal, floor and findings retain their ordinary meanings. The producers
  // write from the standing text, so with none they are not asked; a lane text
  // the rule admits still reaches the slate judges through the settlement
  // (class eighty-seven, XingZ623 slice 89, 2026-09-22).
  if (standingText === '') {
    l.info((laneTexts.length === 0)
      ? `slice ${String(sliceIndex,)}: no standing text to consolidate against, so no slate is bought`
      : `slice ${String(sliceIndex,)}: no standing text to consolidate against; the lane texts alone go to the slate judges`,);
    return await settleConsolidation({
      client,
      roster,
      judgeModelIds,
      subject,
      voices: [],
      validity: [],
      producedFindings: standingFindings,
      standingText,
      lineStructured,
      sliceIndex,
      ...((polishConfig === undefined) ? {} : { polishConfig, }),
      standingMayShip,
      standingEligible,
      ...((standingRefusal === undefined) ? {} : { standingRefusal, }),
      laneTexts,
      signal,
      perCallTimeoutMs,
      l,
    },);
  }

  /**
   Slate produced once and judged once for this question.
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
  // SILENT PRODUCERS ARE THE HOUR, not the passage, lane texts or none: a
  // slate the judges would be as silent about must not settle as unjudged
  // and persist (`PAUSES provider-silent unsafe standing` in the driver
  // tests), so the lane texts of class forty change nothing here.
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
    // THE VERDICT'S FINDINGS RIDE WITH THE PRODUCERS', so the judges read
    // them on the slate and the settlement carries them once.
    producedFindings: [
      ...standingFindings,
      ...produced.findings,
    ],
    standingText,
    lineStructured,
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { polishConfig, }),
    standingMayShip,
    standingEligible,
    ...((standingRefusal === undefined) ? {} : { standingRefusal, }),
    laneTexts,
    signal,
    perCallTimeoutMs,
    l,
  },);
}

/**
 Buys one consolidation and settles it in a single attempt.
 
 SINGLE ATTEMPT BY DESIGN: when the standing baseline lacks contest
 endorsement and the judged round still keeps it, the settlement returns
 as it is with the non-endorsement recorded as a finding, because the
 standing text is the only wording the deterministic gate has passed and
 quality machinery may not withhold the entry over it
 (doc/planning/translation-repair-no-loop-design.md). Zero produced voices
 under a barred standing remain the bounded provider error inside the
 attempt.
 
 @param input - stage clients, candidates, standing policy, and operation bounds
 
 @returns Complete settlement for this question
 
 @throws {@link TranslationRepairInterruptedError} when a barred standing hears no producer voice
 
 @example
 ```ts
 const settlement = await buyConsolidationSlice(input);
 ```
 */
export async function buyConsolidationSlice(
  input: ForeignBorrowed<ConsolidationBuyInput>,
): Promise<ConsolidationSettlement> {
  /**
   Whether archive or lane standing may already ship.
   */
  const standingMayShip = input.standingMayShip ?? true;
  /**
   Settlement from the single attempt.
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
