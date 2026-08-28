import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { CONSOLIDATE_GATE_QUORUM, } from './consolidate-gate-stage.ts';
import type {
  ConsolidationSettlement,
  ConsolidationTerminal,
} from './consolidate-settle.ts';
import type { SliceCache, } from './slice-cache.ts';
import type { TranslateDecision, } from './translate-stage-result.ts';

//region Consolidation persistence
// Cache eligibility belongs apart from document orchestration: it decides which
// settlements a warm run may treat as terminal, including whether unchanged
// baseline had prior approval.

/**
 * Judge decisions second panel might change.
 */
const UNSETTLED_DECISIONS: readonly TranslateDecision[] = [
  'declined-indecision',
  'declined-rejection',
];

/**
 * Terminals settled enough to keep without reading judged round.
 */
const SETTLED_WITHOUT_A_GATE: readonly ConsolidationTerminal[] = [
  'incumbent-only',
  'no-standing-text',
  'slate-endorsed-standing',
  'slate-unjudged-standing',
];

/**
 * Whether settlement is worth keeping across runs.
 *
 * SETTLED VERDICTS ONLY. Thin panel is transient provider fact. Settlement
 * retaining unendorsed baseline is nonterminal even when its own panel reached
 * quorum, because final-selection guard will refuse same result.
 *
 * @param settlement - what stage settled
 *
 * @param standingMayShip - whether standing baseline has prior endorsement
 *
 * @returns Whether to persist it
 *
 * @example
 * ```ts
 * const keep = consolidationWorthResuming({ settlement, standingMayShip: true, });
 * ```
 */
export function consolidationWorthResuming(
  {
    settlement,
    standingMayShip = true,
  }: {
    readonly settlement: ConsolidationSettlement;
    readonly standingMayShip?: boolean;
  },
): boolean {
  /**
   * Post-consolidation polish, absent before final candidate.
   */
  const { polish, } = settlement;
  if (polish?.kind === 'unsettled')
    return false;
  /**
   * Whether post-consolidation polish replaced otherwise unsafe baseline.
   */
  const polishSettled = (polish !== undefined)
    && (polish.kind === 'settled')
    && polish.changed;
  /**
   * Whether unchanged standing baseline is terminal for this question.
   */
  const baselineSettled = standingMayShip
    ? true
    : (settlement.terminal === 'consolidated') || polishSettled;
  if (!baselineSettled)
    return false;
  /**
   * What gate settled, absent where slice never reached it.
   */
  const { gate, } = settlement;
  if (gate !== undefined)
    return gate.usable >= CONSOLIDATE_GATE_QUORUM;

  /**
   * How slice left stage.
   */
  const { terminal, } = settlement;
  if (SETTLED_WITHOUT_A_GATE.some(function matches(settled,): boolean {
    return settled === terminal;
  },))
    return true;

  if (terminal !== 'slate-declined-standing')
    return false;

  /**
   * What judges decided, absent when no decision reached.
   */
  const { decided, } = settlement;
  if (decided === undefined)
    return false;

  return !UNSETTLED_DECISIONS.some(function matches(unsettled,): boolean {
    return unsettled === decided.decision;
  },);
}

/**
 * Persists bought consolidation only while caller remains live and settlement
 * is stable enough for warm run.
 *
 * @param key - exact consolidation question
 *
 * @param settlement - complete stage answer
 *
 * @param cache - consolidation persistence boundary
 *
 * @param standingMayShip - whether unchanged baseline may become final output
 *
 * @param signal - caller abort checked before write
 *
 * @returns Whether settlement persisted and may be reused
 *
 * @throws Whatever caller abort reason or persistence throws
 *
 * @example
 * ```ts
 * await persistConsolidationSettlement({ key, settlement, cache, standingMayShip: true, signal, });
 * ```
 */
export async function persistConsolidationSettlement(
  {
    key,
    settlement,
    cache,
    standingMayShip = true,
    signal,
  }: ForeignBorrowed<{
    readonly key: string;
    readonly settlement: ConsolidationSettlement;
    readonly cache: SliceCache<ConsolidationSettlement>;
    readonly standingMayShip?: boolean;
    readonly signal: AbortSignal;
  }>,
): Promise<boolean> {
  signal.throwIfAborted();
  if (!consolidationWorthResuming({
    settlement,
    standingMayShip,
  },))
    return false;
  await cache.persist({
    key,
    serialized: JSON.stringify(settlement,),
  },);
  return true;
}

//endregion Consolidation persistence
