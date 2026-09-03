import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { syntheticIsDry, } from '../budget-routing.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { RepairModels, } from '../repair-contract.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { TranslateModels, } from '../translate-document-contract.ts';
import {
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_TRANSLATE_MODELS,
  RUN_WIDE_SEATS,
} from './run-config.ts';

//region Provider-aware judge seats
// WHICH JUDGES SIT, DECIDED FROM WHO WOULD SERVE THEM. The owner's decision of
// 2026-09-03 ("seat per provider reach"): a judge seat is skipped when the
// router would send that model to Hyper, and seated when Synthetic serves it.
//
// THE CASE. `hf:Qwen/Qwen3.8-27B` served by Hyper reasons past the 60 s round
// window in every judge role: cut in 30 of 34 translate-lane and 21 of 24
// consolidation-slate select rounds on XIEPT2 with Hyper the only provider, and
// in 14 of 19, 11 of 19, 15 of 19 panel and 17 of 19 lane-contest rounds on
// Carena0442 (1,648 of 1,938 calls on Hyper). Served by Synthetic (Toka_ls,
// 2026-09-02) it answered 25 of 28 select rounds. The seat is lost to one
// provider's serving speed, not to the model, so dropping it outright (the
// 2026-09-03 morning's `4ad08d5dc`) threw away a judge Synthetic serves well.
//
// READ ONCE PER ENTRY, off Synthetic's own meter, because the router's choice
// is per call: it sends to Synthetic until the model's per-model concurrency is
// taken, then overflows to Hyper, and to Hyper alone once Synthetic is dry.
// The seat cannot follow every call; it follows the state that decides most
// of them. With Synthetic wet a burst still overflows some of this seat's
// calls to Hyper, and those may be cut; with Synthetic dry every call would
// go to Hyper, and the seat is not asked.
//
// AN UNREADABLE METER SEATS THE FULL BENCH. A quota read that fails is not
// evidence of dryness; the router will still route each call by what it
// learns at the wire, and a seat asked in vain costs one cut, while a seat
// withheld on a guess costs a voice.

/**
 * Judges that Hyper serves too slowly for the round window: seated only while
 * Synthetic is wet.
 */
export const HYPER_SLOW_JUDGES: ReadonlySet<RosterModelId> = new Set<RosterModelId>(['hf:Qwen/Qwen3.8-27B',],);

/**
 * Every judge bench one entry runs with, derived from one reading.
 *
 * @example
 * ```ts
 * const seats: JudgeSeats = judgeSeatsFor({ syntheticDry: true, },);
 * ```
 */
export type JudgeSeats = {
  /**
   * Whether Synthetic was dry when the seats were derived.
   */
  readonly syntheticDry: boolean;

  /**
   * Critics, adjudication panel and both lanes' select judges.
   */
  readonly wideSeats: readonly RosterModelId[];

  /**
   * Lane contest, consolidation slate judges and consolidation gate.
   */
  readonly lateJudges: readonly RosterModelId[];

  /**
   * Repair lane roles with the wide seats applied.
   */
  readonly repairModels: RepairModels;

  /**
   * Translate lane roles with the wide seats applied.
   */
  readonly translateModels: TranslateModels;
};

/**
 * Derives the benches for one reading of Synthetic's meter.
 *
 * @param syntheticDry - whether Synthetic has nothing buyable, so every call
 * of every seat would go to Hyper
 *
 * @returns Benches, the Hyper-slow judges withheld when Synthetic is dry
 *
 * @example
 * ```ts
 * const seats = judgeSeatsFor({ syntheticDry: false, },);
 * ```
 */
export function judgeSeatsFor(
  { syntheticDry, }: { readonly syntheticDry: boolean; },
): JudgeSeats {
  /**
   * Keeps a seat unless Synthetic is dry and Hyper serves it too slowly.
   *
   * @param modelId - seat under question
   *
   * @returns Whether the seat is asked this entry
   */
  function seated(modelId: RosterModelId,): boolean {
    return (!syntheticDry) || (!HYPER_SLOW_JUDGES.has(modelId,));
  }
  /**
   * Wide bench for this reading.
   */
  const wideSeats = RUN_WIDE_SEATS.filter(seated,);
  /**
   * Late bench for this reading.
   */
  const lateJudges = RUN_LATE_JUDGES.filter(seated,);
  return {
    syntheticDry,
    wideSeats,
    lateJudges,
    repairModels: {
      ...RUN_MODELS,
      criticModelIds: wideSeats,
      panelModelIds: wideSeats,
      judgeModelIds: wideSeats,
    },
    translateModels: {
      ...RUN_TRANSLATE_MODELS,
      judgeModelIds: wideSeats,
    },
  };
}

/**
 * Reads Synthetic's meter once and derives the benches for one entry.
 *
 * @param client - routed client whose quota surface is Synthetic's meter
 *
 * @param signal - entry abort
 *
 * @param l - entry logger, which records the reading and the bench
 *
 * @returns Benches for this entry
 *
 * @example
 * ```ts
 * const seats = await readJudgeSeats({ client, signal, l, },);
 * ```
 */
export async function readJudgeSeats(
  {
    client,
    signal,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): Promise<JudgeSeats> {
  /**
   * Whether Synthetic is dry, or wet when the meter could not be read.
   */
  const syntheticDry = await (async function readDryness(): Promise<boolean> {
    try {
      /**
       * Synthetic's meter as it stands.
       */
      const quota = await client.quotas({ signal, },);
      return syntheticIsDry({ quota, },);
    } catch (error) {
      l.warn(`judge seats: Synthetic's meter could not be read (${String(error,)}); seating the full bench`,);
      return false;
    }
  })();
  /**
   * Benches for this reading.
   */
  const seats = judgeSeatsFor({ syntheticDry, },);
  /**
   * Wide seats this entry asks.
   */
  const wide = seats.wideSeats
    .length;
  /**
   * Late judges this entry asks.
   */
  const late = seats.lateJudges
    .length;
  l.info(
    `JUDGE SEATS synthetic=${syntheticDry ? 'dry' : 'wet'} wide=${String(wide,)} late=${String(late,)} `
      + `hyper-slow seated=${syntheticDry ? 'no' : 'yes'}`,
  );
  return seats;
}

//endregion Provider-aware judge seats
