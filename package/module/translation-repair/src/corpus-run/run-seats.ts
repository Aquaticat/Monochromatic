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
// READ AT EACH PHASE BOUNDARY (lanes, lane contest, consolidation), off
// Synthetic's own meter, because the router's choice is per call: it sends to
// Synthetic until the model's per-model concurrency is taken, then overflows
// to Hyper, and to Hyper alone once Synthetic is dry. The seat cannot follow
// every call; it follows the state that decides most of them. With Synthetic
// wet a burst could overflow some of this seat's calls to Hyper, and those may
// be cut; with Synthetic dry every call would go to Hyper, and the seat is not
// asked.
//
// NOT ONCE PER ENTRY, which is what this read until 2026-09-03: XIEPT2 read
// wet at 08:16, Synthetic ran dry at 08:19, and the seat sat on Hyper for the
// remaining three and a half hours, abandoned in 102 judge calls with 75
// rounds waiting the full 60 s grace; consolidation took 134 minutes for 28
// slices. A reading before each phase withdraws the seat from the first phase
// that starts dry.
//
// AN UNREADABLE METER SEATS THE FULL BENCH. A quota read that fails is not
// evidence of dryness; the router will still route each call by what it
// learns at the wire, and a seat asked in vain costs one cut, while a seat
// withheld on a guess costs a voice.

/**
 * Judges that Hyper serves too slowly for the round window in every judge
 * role: seated only while Synthetic is wet.
 */
export const HYPER_SLOW_JUDGES: ReadonlySet<RosterModelId> = new Set<RosterModelId>(['hf:Qwen/Qwen3.8-27B',],);

/**
 * Judges that Hyper serves too slowly in the SELECT role alone (both lanes'
 * slate select and the consolidation slate), and fast enough everywhere else:
 * withheld from the select seats while Synthetic is dry, kept as critics,
 * panel, contest judges and gate.
 *
 * THE CASE IS `hf:moonshotai/Kimi-K3`, 2026-09-03: cut in 0 of 69 select
 * rounds when Synthetic served it (Toka_ls, 2026-09-02) and in 43 of 83 and 38
 * of 101 when Hyper mostly or wholly did (XIEPT2 rerun5, 55 of its 61 cut
 * streams Hyper-served, and the postscript run), against 0 and 1 of 28
 * lane-contest rounds, 0 of 9 critic, 0 to 1 of 5 panel and 0 of 14 gate
 * rounds. Its cut streams ran 71 s on average, its answers 14 s: the slate
 * prompt is where its reasoning runs long. Same evidence bar as the owner's
 * authorisation to drop a model from a role.
 */
export const HYPER_SLOW_SELECT_JUDGES: ReadonlySet<RosterModelId> = new Set<RosterModelId>([
  'hf:moonshotai/Kimi-K3',
],);

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
   * Critics and adjudication panel.
   */
  readonly wideSeats: readonly RosterModelId[];

  /**
   * Both lanes' slate select judges: the wide seats less the select-slow
   * judges while Synthetic is dry.
   */
  readonly selectJudges: readonly RosterModelId[];

  /**
   * Lane contest and consolidation gate.
   */
  readonly lateJudges: readonly RosterModelId[];

  /**
   * Consolidation slate judges: the late judges less the select-slow judges
   * while Synthetic is dry.
   */
  readonly slateJudges: readonly RosterModelId[];

  /**
   * Repair lane roles with the wide and select seats applied.
   */
  readonly repairModels: RepairModels;

  /**
   * Translate lane roles with the select seats applied.
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
   * @returns Whether the seat is asked this phase
   */
  function seated(modelId: RosterModelId,): boolean {
    return (!syntheticDry) || (!HYPER_SLOW_JUDGES.has(modelId,));
  }
  /**
   * Keeps a select seat unless Synthetic is dry and Hyper serves its slate
   * answers too slowly.
   *
   * @param modelId - select seat under question
   *
   * @returns Whether the seat judges slates this phase
   */
  function seatedForSelect(modelId: RosterModelId,): boolean {
    return (!syntheticDry) || (!HYPER_SLOW_SELECT_JUDGES.has(modelId,));
  }
  /**
   * Wide bench for this reading.
   */
  const wideSeats = RUN_WIDE_SEATS.filter(seated,);
  /**
   * Both lanes' select judges for this reading.
   */
  const selectJudges = wideSeats.filter(seatedForSelect,);
  /**
   * Late bench for this reading.
   */
  const lateJudges = RUN_LATE_JUDGES.filter(seated,);
  /**
   * Consolidation slate judges for this reading.
   */
  const slateJudges = lateJudges.filter(seatedForSelect,);
  return {
    syntheticDry,
    wideSeats,
    selectJudges,
    lateJudges,
    slateJudges,
    repairModels: {
      ...RUN_MODELS,
      criticModelIds: wideSeats,
      panelModelIds: wideSeats,
      judgeModelIds: selectJudges,
    },
    translateModels: {
      ...RUN_TRANSLATE_MODELS,
      judgeModelIds: selectJudges,
    },
  };
}

/**
 * Phase of one entry a bench is read for, named in the log line so a run's
 * log says which reading seated whom.
 *
 * @example
 * ```ts
 * const phase: JudgeSeatPhase = 'lane contest';
 * ```
 */
export type JudgeSeatPhase = 'lanes' | 'lane contest' | 'consolidation';

/**
 * Reads Synthetic's meter and derives the benches for one phase of one entry.
 *
 * @param client - routed client whose quota surface is Synthetic's meter
 *
 * @param phase - phase about to start, which the reading seats
 *
 * @param signal - entry abort
 *
 * @param l - entry logger, which records the reading and the bench
 *
 * @returns Benches for this phase
 *
 * @example
 * ```ts
 * const seats = await readJudgeSeats({ client, phase: 'lanes', signal, l, },);
 * ```
 */
export async function readJudgeSeats(
  {
    client,
    phase,
    signal,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly phase: JudgeSeatPhase;
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
   * Wide seats this phase asks.
   */
  const wide = seats.wideSeats
    .length;
  /**
   * Select judges this phase asks.
   */
  const select = seats.selectJudges
    .length;
  /**
   * Late judges this phase asks.
   */
  const late = seats.lateJudges
    .length;
  /**
   * Consolidation slate judges this phase asks.
   */
  const slate = seats.slateJudges
    .length;
  l.info(
    `JUDGE SEATS phase=${phase} synthetic=${syntheticDry ? 'dry' : 'wet'} wide=${String(wide,)} `
      + `select=${String(select,)} late=${String(late,)} slate=${String(slate,)} `
      + `hyper-slow seated=${syntheticDry ? 'no' : 'yes'}`,
  );
  return seats;
}

//endregion Provider-aware judge seats
