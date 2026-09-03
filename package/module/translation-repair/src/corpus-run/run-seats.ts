import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  type NO_PROVIDER,
  providerServing,
} from '../budget-routing.ts';
import type { BudgetView, } from '../provider-budget.ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  providerRecord,
} from '../provider-name.ts';
import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  type RepairModels,
} from '../repair-contract.ts';
import { reachOf, } from '../roster-reach.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { TranslateModels, } from '../translate-document-contract.ts';
import type { RunClient, } from './run-client-contract.ts';
import {
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_TRANSLATE_MODELS,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
} from './run-config.ts';

//region Provider-aware judge seats
// WHICH JUDGES SIT, DECIDED FROM WHO WOULD SERVE THEM. The owner's decision of
// 2026-09-03 ("seat per provider reach"): a seat is withheld while the
// provider that would take its calls is one that serves it too slowly for the
// round window, or one the owner declined to pay that model's rate on, and
// seated otherwise.
//
// THE FIRST CASE. `hf:Qwen/Qwen3.8-27B` served by Hyper reasons past the 60 s
// round window in every judge role: cut in 30 of 34 translate-lane and 21 of
// 24 consolidation-slate select rounds on XIEPT2 with Hyper the only provider,
// and in 14 of 19, 11 of 19, 15 of 19 panel and 17 of 19 lane-contest rounds
// on Carena0442 (1,648 of 1,938 calls on Hyper). Served by Synthetic (Toka_ls,
// 2026-09-02) it answered 25 of 28 select rounds. The seat is lost to one
// provider's serving speed, not to the model, so dropping it outright (the
// 2026-09-03 morning's `4ad08d5dc`) threw away a judge Synthetic serves well.
//
// THE SECOND CASE. `hf:moonshotai/Kimi-K3` on OpenRouter costs 3 and 15 USD
// per million tokens, 52 to 61 percent of an entry's all-OpenRouter cost, and
// the owner decided on 2026-09-03 to withhold it wherever only OpenRouter
// would buy it (`doc/decision/translation-repair-openrouter-fallback.md`).
// That reaches its checker seat too, and a checker roster of two is below the
// hard floor `assertCheckerQuorumReachable` holds, so a disinterested
// substitute takes the seat on those phases.
//
// WHERE A MODEL WOULD BE SERVED is the router's own answer: the first provider
// in `PROVIDER_ORDER` that serves the model and reads wet, holds folded in
// (`providerServing`). The seat cannot follow every call, since a burst can
// overflow some of a wet Synthetic's calls to Hyper; it follows the state that
// decides most of them.
//
// READ AT EACH PHASE BOUNDARY (lanes, lane contest, consolidation), because a
// provider can run dry inside an entry: XIEPT2 read wet at 08:16, Synthetic
// ran dry at 08:19, and a once-per-entry reading left the Hyper-slow seat
// asked for three and a half hours, abandoned in 102 judge calls.
//
// AN UNREADABLE VIEW SEATS THE FULL BENCH. A budget read that fails is not
// evidence of dryness; the router will still route each call by what it
// learns at the wire, and a seat asked in vain costs one cut, while a seat
// withheld on a guess costs a voice.

/**
 * Judges that Hyper serves too slowly for the round window in every judge
 * role: withheld while Hyper is the provider that would serve them.
 */
export const HYPER_SLOW_JUDGES: ReadonlySet<RosterModelId> = new Set<RosterModelId>(['hf:Qwen/Qwen3.8-27B',],);

/**
 * Judges that Hyper serves too slowly in the SELECT role alone (both lanes'
 * slate select and the consolidation slate), and fast enough everywhere else:
 * withheld from the select seats while Hyper would serve them, kept as
 * critics, panel, contest judges and gate.
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
 * Models withheld from every seat while OpenRouter is the provider that would
 * serve them, by the owner's decision of 2026-09-03 on cost.
 */
export const OPENROUTER_WITHHELD: ReadonlySet<RosterModelId> = new Set<RosterModelId>([
  'hf:moonshotai/Kimi-K3',
],);

/**
 * Checker seated in place of a withheld one, so the roster keeps its floor.
 *
 * `gemma-4-26b-a4b-it`, chosen because it holds no editor or refiner seat
 * (a checker judging text it helped write counts half), answered 40 of 40
 * writer rounds with zero cuts and threw 5 of 289 asks on the stub-fix XIEPT2
 * run, and sat above the pooled null as a writer where
 * `deepseek-v4-flash-0731`, the other disinterested candidate, sat below it in
 * both writing measurements. PROVISIONAL: no checker-side measurement exists
 * for any model, and the owner may veto it.
 */
export const OPENROUTER_CHECKER_SUBSTITUTE: RosterModelId = 'gemma-4-26b-a4b-it';

/**
 * The view when the budgets could not be read: nothing is dry.
 *
 * @returns Wet
 *
 * @example
 * ```ts
 * const dry = providerRecord({ of: wetWhenUnread, },);
 * ```
 */
function wetWhenUnread(): boolean {
  return false;
}

/**
 * Every bench one entry runs with, derived from one reading.
 *
 * @example
 * ```ts
 * const seats: JudgeSeats = judgeSeatsFor({ dry, },);
 * ```
 */
export type JudgeSeats = {
  /**
   * Which providers were dry when the seats were derived.
   */
  readonly dry: BudgetView;

  /**
   * Models withheld from at least one seat by this reading, for the log line.
   */
  readonly withheld: readonly RosterModelId[];

  /**
   * Critics and adjudication panel.
   */
  readonly wideSeats: readonly RosterModelId[];

  /**
   * Both lanes' slate select judges: the wide seats less the select-slow
   * judges Hyper would serve.
   */
  readonly selectJudges: readonly RosterModelId[];

  /**
   * Lane contest and consolidation gate.
   */
  readonly lateJudges: readonly RosterModelId[];

  /**
   * Consolidation slate judges: the late judges less the select-slow judges
   * Hyper would serve.
   */
  readonly slateJudges: readonly RosterModelId[];

  /**
   * Checkers, the static roster with any withheld seat substituted.
   */
  readonly checkers: readonly RosterModelId[];

  /**
   * Translate lane writers: the static translators less any model withheld
   * on the provider that would serve it. A WITHHELD MODEL WRITES NOTHING
   * EITHER: the owner's withholding is on what a call costs, whatever the
   * role, and the first OpenRouter-only pass (keyword233, 2026-09-03 18:15
   * UTC) bought six translations from the withheld model, a quarter of that
   * pass's bill, while every judge bench had it out.
   */
  readonly translators: readonly RosterModelId[];

  /**
   * Picture readers: the catalog-derived readers less any withheld model,
   * for the same reason as the translators, with an image the dearest call
   * of all.
   */
  readonly readers: readonly RosterModelId[];

  /**
   * The whole roster less any withheld model, for every stage that asks the
   * roster rather than a named bench: block pairing and archive review in
   * preparation, insertion admission, and the consolidation writers. The
   * second OpenRouter-only pass (2026-09-03 19:33 UTC) bought the withheld
   * model's first call from the pairing round, six seconds before any bench
   * was read.
   */
  readonly roster: readonly RosterModelId[];

  /**
   * Repair lane roles with the wide, select and checker seats applied.
   */
  readonly repairModels: RepairModels;

  /**
   * Translate lane roles with the translator and select seats applied.
   */
  readonly translateModels: TranslateModels;
};

/**
 * Derives the benches for one reading of every provider's meter.
 *
 * @param dry - which providers have nothing buyable, holds folded in
 *
 * @returns Benches, with each withholding applied where its provider would
 * serve the seat, and the checker floor kept
 *
 * @example
 * ```ts
 * const seats = judgeSeatsFor({ dry: { synthetic: true, hyper: true, openrouter: false, }, },);
 * ```
 */
export function judgeSeatsFor(
  { dry, }: { readonly dry: BudgetView; },
): JudgeSeats {
  /**
   * Provider the router would send one model's calls to, or none.
   *
   * @param modelId - seat under question
   *
   * @returns First provider in order that serves it and reads wet
   */
  function servedBy(modelId: RosterModelId,): ProviderName | typeof NO_PROVIDER {
    return providerServing({
      reach: reachOf({ modelId, },),
      dry,
    },);
  }
  /**
   * Keeps a seat unless the provider that would serve it is one the seat is
   * withheld on.
   *
   * @param modelId - seat under question
   *
   * @returns Whether the seat is asked this phase
   */
  function seated(modelId: RosterModelId,): boolean {
    /**
     * Where this model's calls would go.
     */
    const provider = servedBy(modelId,);
    if ((provider === 'hyper') && HYPER_SLOW_JUDGES.has(modelId,))
      return false;
    return !((provider === 'openrouter') && OPENROUTER_WITHHELD.has(modelId,));
  }
  /**
   * Keeps a select seat unless Hyper would serve it and serves its slate
   * answers too slowly, on top of {@link seated}.
   *
   * @param modelId - select seat under question
   *
   * @returns Whether the seat judges slates this phase
   */
  function seatedForSelect(modelId: RosterModelId,): boolean {
    return (servedBy(modelId,) !== 'hyper') || (!HYPER_SLOW_SELECT_JUDGES.has(modelId,));
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
  /**
   * The static checker roster, whose size is the floor to keep.
   */
  const staticCheckers = RUN_MODELS.checkerModelIds;
  /**
   * Static checkers still seated by this reading.
   */
  const keptCheckers = staticCheckers.filter(seated,);
  /**
   * Whether a checker seat was withheld and the substitute can take it.
   */
  const substituteSits = (keptCheckers.length < staticCheckers.length)
    && (!keptCheckers.includes(OPENROUTER_CHECKER_SUBSTITUTE,))
    && seated(OPENROUTER_CHECKER_SUBSTITUTE,);
  /**
   * Checkers with the substitute seated where one was withheld, unless the
   * substitute already sits or is itself withheld.
   */
  const checkers = substituteSits
    ? [
      ...keptCheckers,
      OPENROUTER_CHECKER_SUBSTITUTE,
    ]
    : keptCheckers;
  // THE DERIVED ROSTER MUST PASS WHAT THE STATIC ONE PASSES AT LOAD, or a
  // phase would start with a checker stage the contract refuses.
  assertCheckerIndependence({
    editorModelIds: RUN_MODELS.editorModelIds,
    refinerModelIds: RUN_MODELS.refinerModelIds ?? [],
    checkerModelIds: checkers,
    selfCertificationPermitted: RUN_MODELS.checkerSelfCertificationPermitted ?? false,
  },);
  assertCheckerQuorumReachable({ checkerModelIds: checkers, },);
  /**
   * Translate lane writers for this reading.
   */
  const translators = RUN_TRANSLATORS.filter(seated,);
  /**
   * Picture readers for this reading.
   */
  const readers = RUN_READER_MODELS.filter(seated,);
  /**
   * The roster for this reading.
   */
  const roster = RUN_ROSTER.filter(seated,);
  /**
   * Every static seat holder, repeated where a model holds several seats.
   */
  const seatHolders = [
    ...RUN_WIDE_SEATS,
    ...RUN_LATE_JUDGES,
    ...staticCheckers,
    ...RUN_TRANSLATORS,
    ...RUN_READER_MODELS,
    ...RUN_ROSTER,
  ];
  /**
   * Every model some bench lost to this reading, named once.
   */
  const withheld = seatHolders.filter(function lostASeat(
    modelId: RosterModelId,
    index: number,
    all: readonly RosterModelId[],
  ): boolean {
    /**
     * Whether this is the first mention of the model.
     */
    const first = all.indexOf(modelId,) === index;
    /**
     * Whether the model keeps every seat it holds.
     */
    const keepsAll = seated(modelId,) && seatedForSelect(modelId,);
    return first && (!keepsAll);
  },);
  return {
    dry,
    withheld,
    wideSeats,
    selectJudges,
    lateJudges,
    slateJudges,
    checkers,
    translators,
    readers,
    roster,
    repairModels: {
      ...RUN_MODELS,
      criticModelIds: wideSeats,
      panelModelIds: wideSeats,
      judgeModelIds: selectJudges,
      checkerModelIds: checkers,
    },
    translateModels: {
      ...RUN_TRANSLATE_MODELS,
      translatorModelIds: translators,
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
export type JudgeSeatPhase = 'preparation' | 'pictures' | 'lanes' | 'lane contest' | 'consolidation';

/**
 * Reads every provider's dryness and derives the benches for one phase of
 * one entry.
 *
 * @param client - run client whose dryness view is the router's own
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
    readonly client: Pick<RunClient, 'providerDryness'>;
    readonly phase: JudgeSeatPhase;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): Promise<JudgeSeats> {
  /**
   * Which providers are dry, or none when the view could not be read.
   */
  const dry = await (async function readDryness(): Promise<BudgetView> {
    try {
      return await client.providerDryness({ signal, },);
    } catch (error) {
      l.warn(`judge seats: the budget view could not be read (${String(error,)}); seating the full bench`,);
      return providerRecord({ of: wetWhenUnread, },);
    }
  })();
  /**
   * Benches for this reading.
   */
  const seats = judgeSeatsFor({ dry, },);
  /**
   * Each bench, named once for the line.
   */
  const {
    wideSeats,
    selectJudges,
    lateJudges,
    slateJudges,
    checkers,
    translators,
    readers,
    roster,
    withheld,
  } = seats;
  /**
   * Each provider's state, for the line.
   */
  const states = PROVIDER_ORDER.map(function stateOf(provider,): string {
    return `${provider}=${dry[provider] ? 'dry' : 'wet'}`;
  },);
  l.info(
    `JUDGE SEATS phase=${phase} ${states.join(' ',)} wide=${String(wideSeats.length,)} `
      + `select=${String(selectJudges.length,)} late=${String(lateJudges.length,)} `
      + `slate=${String(slateJudges.length,)} checkers=${String(checkers.length,)} `
      + `translators=${String(translators.length,)} readers=${String(readers.length,)} `
      + `roster=${String(roster.length,)} `
      + `withheld=${(withheld.length === 0) ? 'none' : withheld.join(',',)}`,
  );
  return seats;
}

//endregion Provider-aware judge seats
