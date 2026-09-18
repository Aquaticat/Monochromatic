import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { gateConsolidatedSlice, } from './consolidate-gate-stage.ts';
import {
  requireShippableTerminal,
  shipPastUndecidedGate,
} from './consolidate-ineligible-standing.ts';
import type {
  ConsolidationSettlement,
  ConsolidationSubject,
  ConsolidationTerminal,
} from './consolidate-settle.ts';
import type {
  ProposalVerdict,
  SettlementIdentity,
} from './consolidate-settle-context.ts';
import type { SlateFloor, } from './consolidate-validity-floor.ts';
import { wrapConsolidation, } from './consolidate-wrap.ts';
import { applyFinalPolish, } from './consolidation-polish-apply.ts';
import type { ConsolidationPolishConfig, } from './consolidation-polish.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Consolidate settle gate
// THE SETTLEMENT'S LAST TWO STEPS, gate what won the slate and wrap what
// ships, split out of `consolidate-settle.ts` at the line cap on 2026-09-04.
// The order and the reasons are that file's; this one only carries them out.

/**
 Gates the consolidation the judges chose, wraps what ships, and polishes it.
 
 @param client - provider client the gate borrows
 
 @param judgeModelIds - voices seated for the gate
 
 @param subject - slice in the archive's terms
 
 @param decided - what the slate judges settled, a fresh consolidation
 
 @param standingText - wording the consolidation has to beat
 
 @param lineStructured - whether structural rule forbids merged lines
 
 @param floor - what the validity floor made of the slate
 
 @param verdicts - every voice's verdict without its text
 
 @param sliceIndex - prepared position used by records and refusals
 
 @param polishConfig - final body polish roles and document guard facts
 
 @param standingMayShip - whether unchanged baseline has prior endorsement
 
 @param standingEligible - whether the standing passed the deterministic
 gate; a gate that keeps an ineligible standing ends the slice, and one
 that settles on neither over it ships the proposal the slate chose

 @param standingRefusal - why the deterministic gate refused the standing,
 shown to the gate judges so keeping it is not taken for the safe choice
 
 @param identity - front matter identity as the gate takes it
 
 @param signal - cancellation for the whole settlement
 
 @param perCallTimeoutMs - bound on any single exchange
 
 @param l - stage logger
 
 @returns What ships, and every round that decided it
 
 @throws {@link import('./consolidate-ineligible-standing.ts').ConsolidationStandingIneligibleError}
 when the gate keeps a standing the deterministic gate refused
 
 @example
 ```ts
 const settled = await gateAndShip({ client, judgeModelIds, subject, decided, standingText, lineStructured, floor, verdicts, sliceIndex, standingMayShip, standingEligible, identity, signal, perCallTimeoutMs, l, },);
 ```
 */
export async function gateAndShip(
  {
    client,
    judgeModelIds,
    subject,
    decided,
    standingText,
    lineStructured,
    floor,
    verdicts,
    sliceIndex,
    polishConfig,
    standingMayShip,
    standingEligible,
    standingRefusal,
    identity,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly judgeModelIds: readonly RosterModelId[];
    readonly subject: ConsolidationSubject;
    readonly decided: TranslateStageResult;
    readonly standingText: string;
    readonly lineStructured: boolean;
    readonly floor: SlateFloor;
    readonly verdicts: readonly ProposalVerdict[];
    readonly sliceIndex: number;
    readonly polishConfig?: ConsolidationPolishConfig;
    readonly standingMayShip: boolean;
    readonly standingEligible: boolean;
    readonly standingRefusal?: string;
    readonly identity: SettlementIdentity;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ConsolidationSettlement> {
  /**
   What the gate made of the consolidation that won the slate.
   */
  const gate = await gateConsolidatedSlice({
    client,
    modelIds: judgeModelIds,
    subject: {
      sourceText: subject.sourceText,
      incumbentText: subject.incumbentText,
      consolidatedText: decided.text,
      standingText,
      ...((subject.syntax === undefined) ? {} : { syntax: subject.syntax, }),
      ...((standingRefusal === undefined) ? {} : { standingRefusal, }),
      ...identity,
    },
    signal,
    exchangeTimeoutMs: perCallTimeoutMs,
    l,
  },);

  /**
   Gate outcome as it ships, the neither verdict over an ineligible
   standing resolved toward the slate's choice.
   */
  const gated = shipPastUndecidedGate({
    outcome: gate,
    standingEligible,
    l,
  },);

  /**
   What ships once the semantic wrap has been applied and demotion re-derived.
   */
  const wrapped = wrapConsolidation({
    outcome: gated,
    consolidatedText: decided.text,
    standingText,
    lineStructured,
    l,
  },);

  /**
   Which of the three ways this slice could keep its standing text it took,
   kept apart because they answer different questions about the roster.
   */
  const terminal: ConsolidationTerminal = (wrapped.ships === 'consolidated')
    ? 'consolidated'
    : (wrapped.demoted ? 'wrap-erased-difference' : 'gate-kept-standing');
  requireShippableTerminal({
    standingEligible,
    terminal,
    sliceIndex,
  },);

  return await applyFinalPolish({
    client,
    settlement: {
      terminal,
      text: wrapped.text,
      floor,
      verdicts,
      decided,
      gate: gated,
      rewrapped: wrapped.rewrapped,
      demoted: wrapped.demoted,

      // The judged round already carries the produce half's findings, so
      // adding them again here would report one voice loss twice.
      findings: [
        ...decided.findings,
        ...gated.findings,
      ],
    },
    subject,
    lineStructured,
    sliceIndex,
    ...((polishConfig === undefined) ? {} : { polishConfig, }),
    eligible: (terminal === 'consolidated') || standingMayShip,
    signal,
    perCallTimeoutMs,
    l,
  },);
}

//endregion Consolidate settle gate
