import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import spawn from 'nano-spawn';

import type {
  ModelCaller,
  SyntheticClient,
} from '../chat-contract.ts';
import {
  CORPUS_COMMIT_SHA,
  type CorpusPin,
} from '../corpus-source.ts';
import {
  type CorpusPinSetting,
  readCorpusPinSetting,
} from './corpus-pin-override.ts';
import {
  assertCheckerIndependence,
  assertCheckerQuorumReachable,
  type RepairModels,
} from '../repair-contract.ts';
import type { TranslateModels, } from '../translate-document-contract.ts';
import {
  STREAM_FIRST_BYTE_MS,
  STREAM_IDLE_MS,
} from '../stream-idle-guard.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import {
  readsImages,
  ROSTER_MODEL_IDS,
} from '../roster-reach.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';
import type { ModelTransport, } from '../synthetic-transport.ts';
import { createHyperClient, } from '../hyper-client.ts';
import { hyperRequestsPerHour, } from '../request-pace.ts';
import { createProviderBudgets, } from '../provider-budget.ts';
import { promptPayloadStore, } from '../prompt-payload-store.ts';
import { promptUniqueClient, } from '../prompt-uniqueness-client.ts';
import {
  createRoutingClient,
  NoProviderForModelError,
} from '../provider-router.ts';
import {
  RUN_SEATS,
  seatTallyClient,
} from '../seat-tally.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import type { QuotaSnapshot, } from '../synthetic-quota.ts';
import { resolveGit, } from './git-command.ts';

//region Corpus-run configuration
// Shared roster, budgets, corpus pin, and location resolvers for the corpus-run
// entrypoints (`corpus-pass.ts`, `sentinel-probe.ts`). These are operational
// runners, not library API: they invoke the fully tested pipeline over the real
// UNLICENSED corpus and write corpus-derived artifacts, so their output goes to
// the gitignored durable dir `node_modules/.monochromatic/translation-repair-runs/`
// (AGENTS.md TMP/NMD), never into git.

/**
 * Raised when a setting a run depends on is absent from its environment.
 *
 * @example
 * ```ts
 * throw new RunConfigError({ variable: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY', },);
 * ```
 */
export class RunConfigError extends StatedRefusalError {
  /**
   * Declared here as well as inherited, so the source scan that keeps the
   * marked-class inventory sees it: the message names a variable and a fix.
   */
  override readonly messageNamesOnly: true = true;

  /**
   * Builds refusal naming the variable that could not be read.
   *
   * @param variable - environment variable name a run cannot start without
   *
   * @example
   * ```ts
   * throw new RunConfigError({ variable: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY', },);
   * ```
   */
  public constructor({ variable, }: { readonly variable: string; },) {
    super({ says: `${variable} is not set; run under mise so sops injects it`, },);
    this.name = 'RunConfigError';
  }
}

/**
 * Directory of this source file, for locating the worktree via git.
 */
const HERE = import.meta.dirname;

/**
 * Every model this run may seat, across both providers.
 * Critics and the adjudication panel both use the whole roster so coverage
 * overlaps across models rather than partitioning the work.
 *
 * DERIVED RATHER THAN LISTED since 2026-08-24, when the roster stopped being
 * one provider's model list. A hand-written copy of a two-catalog union goes
 * stale the first time either catalog moves, and it goes stale silently: a
 * missing model is a seat nobody notices is empty.
 *
 * NINE MODELS NOW. `qwen3.8-max` was culled on 2026-08-28 for disproportionate
 * metered cost, then Nemotron left every stage on 2026-08-29 after contradictory
 * adjacent required-correction reviews, leaving eight. The owner's blocklist
 * decision of 2026-09-01 (`doc/decision/translation-repair-roster-blocklist.md`)
 * refreshed the catalog under it: `glm-5.3` was admitted on the forced-tool
 * probe, GLM-5.3-Flash gained a second route, and two Qwen3.8 routes were
 * culled as automatic-only. Remaining seats retain full weight.
 */
export const RUN_ROSTER: readonly RosterModelId[] = ROSTER_MODEL_IDS;

/**
 * Writers the 40-round producer calibration of 2026-09-01 measured out of the
 * translator seat, dropped on the owner's authorization of the same day
 * ("drop any model from any role, as long as you have evidence").
 *
 * BOTH SAT UNDER THE POOLED NULL WITH FULL AVAILABILITY: `gpt-oss-120b` took
 * 5 of 207 disinterested ballots (z -4.53 against a 13.02 percent null) and
 * `deepseek-v4-flash-0731` 5 of 208 (z -4.55), each having written 40 of 40
 * candidates, so the finding is about the writing rather than about rounds
 * missed. Both keep every other seat: nothing here measures judging,
 * critique or checking. Record and method:
 * `doc/planning/translation-repair-roster-calibration-2026-09-01.md`.
 */
const TRANSLATOR_DROPPED: ReadonlySet<RosterModelId> = new Set<RosterModelId>([
  'hf:openai/gpt-oss-120b',
  'deepseek-v4-flash-0731',
],);

/**
 * Models measured out of every nine-wide seat (critic, panel, judge) on the
 * same authorization, for wall clock rather than for quality.
 *
 * `glm-5.3` IS THE SLOWEST VOICE ON THE ROSTER in every role measured: its
 * completed streams run p50 61 to 66 s and p90 166 to 172 s against p90s under
 * 110 s for everyone but GLM-5.3-Flash. It lost 11 of 38 select asks to the
 * 180000 ms production window in the producer calibration, one panel stream
 * to the 360000 ms per-call deadline after 3.4 M raw characters and another
 * to the 300000 ms calibration window, and each loss holds the round for the
 * whole window after quorum at the roster's highest output rate. Across both
 * calibration logs 75 to 83 percent of round time is that wait, and the wide
 * seats are where a ninth voice adds least: the stage reached quorum without
 * it every time. It keeps the translator seat and any editor seat the editor
 * standing gives it, where its text is what is being measured.
 *
 * `hf:zai-org/GLM-5.3-Flash` LEFT EVERY JUDGE SEAT ON 2026-09-02 by the owner's
 * decision ("Unseat GLM-5.3-Flash as a judge, keep it as editor"). Its
 * reasoning streams run to a million raw characters, and under the 60 s round
 * window of the Toka_ls relaunch it was cut in 12 of 13 panel rounds, 12 of 21
 * translate-select rounds, 11 of 29 repair-select rounds, 11 of 15 critic
 * rounds and 5 of 15 contest rounds: 51 of the run's 78 cuts. No round lost its
 * decision without it and two needed a challenge round, so the seat cost a
 * window's wait far more often than it cast a ballot. It keeps the first editor
 * seat (top three in every one of 4000 resamples), its refiner seat and its
 * translator seat, where its text is what is being measured. Record:
 * `doc/planning/translation-repair-roster-calibration-2026-09-01.md`, "The
 * Toka_ls relaunch was killed at 77 minutes, in consolidation".
 */
const WIDE_SEAT_DROPPED: ReadonlySet<RosterModelId> = new Set<RosterModelId>([
  'glm-5.3',
  'hf:zai-org/GLM-5.3-Flash',
],);

/**
 * Models unseated from the roster-wide judge rounds that run after the lanes:
 * the lane contest, the consolidation slate's judges and the consolidation
 * gate. Those rounds seat the whole roster, `glm-5.3` included, since they were
 * built after the wide-seat drop; only the owner's 2026-09-02 decision on
 * GLM-5.3-Flash reaches them, for the reason on {@link WIDE_SEAT_DROPPED}.
 * Pairing and insertion-admission rounds are not judgments of text and lost no
 * voice to the window (27 of 27 and 9 of 9 heard), so they keep the roster.
 */
const LATE_JUDGE_DROPPED: ReadonlySet<RosterModelId> = new Set<RosterModelId>(['hf:zai-org/GLM-5.3-Flash',],);

/**
 * Translators for the translate lane: the roster less
 * {@link TRANSLATOR_DROPPED}. Seven since 2026-09-01, so the stage quorum is
 * 4 and every slate keeps at least two disinterested judges under
 * `assertJudgeableProducerRoster`.
 */
export const RUN_TRANSLATORS: readonly RosterModelId[] = RUN_ROSTER
  .filter(function stillWrites(modelId,): boolean {
    return !TRANSLATOR_DROPPED.has(modelId,);
  },);

/**
 * Critics, adjudication panel and judges for both lanes: the roster less
 * {@link WIDE_SEAT_DROPPED}. Seven since 2026-09-02 (eight from 2026-09-01),
 * so each of those stages reaches quorum at 4 voices and `minBallotWeight` 3
 * is 3 of 7.
 */
export const RUN_WIDE_SEATS: readonly RosterModelId[] = RUN_ROSTER
  .filter(function stillSeated(modelId,): boolean {
    return !WIDE_SEAT_DROPPED.has(modelId,);
  },);

/**
 * Judges for the lane contest, the consolidation slate and the consolidation
 * gate: the roster less {@link LATE_JUDGE_DROPPED}. Eight since 2026-09-02.
 */
export const RUN_LATE_JUDGES: readonly RosterModelId[] = RUN_ROSTER
  .filter(function stillJudges(modelId,): boolean {
    return !LATE_JUDGE_DROPPED.has(modelId,);
  },);

/**
 * Role roster for a corpus run: SEVEN of the nine critique and adjudicate, THREE edit
 * against each other, THREE refine the result for naturalness, and three check
 * the shipped repair.
 *
 * THREE refiners rather than the two first proposed, because two does not
 * achieve what widening was for. The quorum is `ceil(rosterSize / 2)`, which is
 * 1 on a roster of two, so a two-refiner lane could still ship on one voice and
 * the single-model failure this change exists to prevent would survive it. At
 * three the quorum is 2 and a lone survivor cannot carry the stage. The same
 * arithmetic is why editors are three and not two.
 *
 * Editors went from two to three and refiners from one to three on 2026-08-12,
 * on the user's rule that the system must not have single-model failures.
 * The reason is structural rather than a reaction to one incident:
 * `gatherStageVoices` computes its quorum as `ceil(rosterSize / 2)`, which on a
 * roster of two is satisfied by ONE voice and on a roster of one cannot fail at
 * all. So the two-editor pair could ship a repair written by a single model
 * while reporting a met quorum, and the single refiner could vanish entirely
 * with nothing to report.
 *
 * Both stages retried to `full-roster` from 2026-08-12 until the user removed
 * that target outright on 2026-08-14: waiting for every voice let one model
 * degraded for a day spend four deadlines per gather on a voice that was not
 * coming. Quorum on a roster of three is two, so the ensemble property survives
 * the removal.
 *
 * WHAT FOLLOWS IS THE HISTORY OF THESE SEATS, kept because each rule below was
 * argued from it. The seats themselves are the measured ones in the constant:
 * the roster spans two providers since 2026-08-24 (ten then, nine now), the three editors
 * and three refiners were chosen by the 40-round writer calibration of that day
 * and reseated by the 40-slice editor calibration of 2026-09-01, and the
 * checkers are the three the width measurement settled.
 *
 * GLM-4.7-Flash took the third editor seat on 2026-08-12 because it was the
 * only model not already checking or editing, and the constraints left no
 * other choice at the time: checkers had to exclude every editor and refiner,
 * judges needed two disinterested seats, and the other three models held the
 * checker roster. It left the roster on 2026-08-24.
 *
 * ONE OF THOSE CONSTRAINTS IS GONE. Producers judge as of 2026-08-14, with a
 * ballot for their own work counted at half weight, so seating another producer
 * no longer starves selection: the discount applies to a judge's ballot for its
 * OWN candidate only, and every producer votes on every other candidate at full
 * weight.
 *
 * What still bounds a producing roster is not that arithmetic. It is checker
 * disjointness, which is the binding one: checkers exclude every editor and
 * refiner, so a fourth editor would leave two checkers at a quorum of one, the
 * exact single-voice failure the 2026-08-12 roster change closed. Next to it
 * sit `assertJudgeableProducerRoster`'s two-disinterested-judge floor, now a
 * policy rather than an arithmetic necessity, and judge quality, which `#84`
 * has not measured. Widening was question 1 of the handover's next steps and
 * was answered by the calibration recorded at `editorModelIds`. GLM-4.7-Flash
 * was also the model that most often lost its voice, which argued FOR seating
 * it as a third editor rather than against: a third editor that sometimes
 * drops still leaves two, whereas the same model in the checker set would have
 * cost proof.
 *
 * The panel was six rather than seven from 2026-08-05, when the provider
 * withdrew two models and only one replacement (Kimi-K3) appeared, and has
 * been ten since 2026-08-24, when Charm Hyper's five seats joined, eight after
 * the removals of 2026-08-28 and 2026-08-29, and nine since the 2026-09-01
 * catalog refresh. `gatherStageVoices` computes the stage quorum as
 * `voices >= ceil(modelIds.length / 2)`, so seven models need 4 voices, six
 * need 3, ten need 5, eight need 4, and nine need 5.
 *
 * The ISSUE-acceptance gate does move, and the user accepted the move rather
 * than it happening unnoticed: `DEFAULT_ADJUDICATION_CONFIG.minBallotWeight` is
 * the absolute value 3, so the share of the panel that must cast a non-abstain
 * ballot before any decision rises from 3-of-7 (43 percent) to 3-of-6 (50).
 * User decision, 2026-08-05: "50% is okay here." At nine the same absolute 3
 * is 3-of-9 (33 percent), inside the range already lived at ten (30 percent)
 * and at eight (37.5 percent).
 *
 * MORE THAN ONE editor, on the user's rule that no single model should control
 * any part of the pipeline. Kimi-K3 is one of them because the user reports it
 * as much stronger than anything else currently offered, and the editor is
 * where model strength converts most directly into repair quality. The
 * round-two grading supports spending strength there specifically: four of the
 * 37 true positives carried notes saying detection was right but the proposed
 * repair was poor ("is there a better way?"), which is an editor complaint, not
 * a critic one. GLM-5.2 was the second editor, having held the role alone
 * before, and GLM-4.7-Flash was the third until 2026-08-24, when the measured
 * seats replaced both.
 *
 * The count was TWO until 2026-08-12, and the paragraph that follows is kept as
 * the reasoning for that earlier choice rather than as current policy. Every
 * editor was barred from judging its own chunk, so each added editor cost a
 * judge as well as its own calls: at two editors four judges remained, at three
 * only three, and a plurality got harder to reach exactly as the candidate set
 * got wider. Producers judge now, so that arithmetic no longer holds.
 *
 * That cost was accepted on the quorum argument this block opens with: a stage
 * of two is satisfied by a single voice, so a two-editor pair could ship a
 * repair written by one model while reporting a met quorum. Losing a judge is
 * the smaller harm.
 *
 * Judges are the WHOLE roster, and since 2026-08-14 selection seats all of it
 * rather than removing producers per round. An editor judging a set holding its
 * own text is allowed and counts half for that candidate alone; every other
 * ballot it casts carries full weight.
 *
 * Checkers EXCLUDED every editor until 2026-08-24, so nothing checked its own
 * work. That dropped GLM-5.2 from the checker set it held while it was also
 * editing, and gpt-oss-120b took the seat. GLM-4.7-Flash stayed out: it was
 * the model that most often lost its voice to schema mismatch, and the checker
 * stage is where a lost voice costs proof rather than coverage. Since
 * 2026-08-24 one model both edits and checks, bounded by the half-weight
 * discount described at `checkerModelIds`.
 *
 * The naturalness lane shares two of its three seats with the editors since
 * 2026-09-01 (GLM-5.3-Flash and deepseek-v4-pro-0813), with minimax-m3 as its
 * third. Nothing forbids a refiner also editing: a judge's ballot for its own
 * candidate has counted half since 2026-08-14 and a checker's verdict on text
 * it helped write has counted half since 2026-08-24, so neither stage is
 * decided by the model whose text it is. The tradeoff is real and is accepted
 * rather than hidden: a model that just wrote a paragraph is a poor judge of
 * whether that paragraph reads awkwardly.
 *
 * This paragraph read "ONE refiner runs the naturalness lane" until 2026-08-13,
 * left stale by `eb21ffa6b`, which took the lane from one refiner to three. The
 * staleness mattered rather than being cosmetic: a one-model lane loses the
 * whole stage to a single lost voice, and 34 such losses across 7 entries were
 * measured on the corpus run that ended 2026-08-11, every one recorded as
 * `refiner 0/1`. On a roster of three the same failure no longer empties the
 * stage, because quorum is two. Recorded in
 * `doc/planning/naturalness-lane-reach.md`.
 *
 * Attribution cost, accepted by the user ("Bundle all the improvements that
 * could be made, in"): round three changes the roster, the editor, the checker
 * set, and adds a naturalness pass at once, so a precision delta cannot be
 * attributed to any single change. Record this in the round-three verdict
 * rather than rediscovering it during analysis.
 */
export const RUN_MODELS: RepairModels = {
  // THE ROSTER LESS ITS SLOWEST VOICE since 2026-09-01 in every nine-wide
  // seat; the reason sits on `WIDE_SEAT_DROPPED`.
  criticModelIds: RUN_WIDE_SEATS,
  panelModelIds: RUN_WIDE_SEATS,
  // MEASURED ON THE EDITOR'S OWN JOB since 2026-09-01. `editor-calibrate`
  // over 40 bench slices at build `48799e6d1` drove the whole repair lane
  // with every roster model editing and judging: 111 judged editor rounds
  // from the 30 slices that carried an accepted issue, 6131 disinterested
  // ballots against a pooled null of 15.8 percent. Availability-adjusted
  // share (raw share times candidates over the fullest model's 126):
  // GLM-5.3-Flash 32.2 percent (221 of 669, z +12.25), `glm-5.3` 21.4 (143
  // of 657, z +4.21), `deepseek-v4-pro-0813` 18.8 (130 of 657, z +2.82),
  // then Qwen3.8-27B 17.3 (121 of 688, z +1.31), Kimi-K3 14.2, gpt-oss-120b
  // 12.6, minimax-m3 8.4, gemma-4-26b-a4b-it 7.0 (56 of 767, z -6.44),
  // deepseek-v4-flash-0731 5.6. The two incumbents it unseats sat fourth and
  // eighth; gemma, second-best WRITER in the producer calibration of the same
  // day, wrote the worst edits, which is the divergence the editor instrument
  // exists to catch. Record, method and the slice-clustered reading:
  // `doc/decision/translation-repair-roster-seating-2026-09-01.md`.
  //
  // THE SEAT BEFORE THAT was the writer calibration of 2026-08-24, kept here
  // because its reading of availability still governs how a standing is read:
  // 40 rounds in which all ten roster models wrote a candidate for the same
  // slices and every other model judged them, giving 2492 disinterested
  // ballots against a pooled null of 13.48 percent.
  //
  // AVAILABILITY IS PART OF THE SCORE, and reading it that way is what moved
  // the ranking. A model absent from a round produced nothing to be judged, so
  // its headline rate is computed over the rounds it survived and flatters a
  // model that skipped the hard ones. Charging every model zero for the rounds
  // it missed, `hf:Qwen/Qwen3.8-27B` leads at 22.3 percent (z 4.27, clearing
  // the Bonferroni threshold of 2.81 for ten comparisons),
  // `gemma-4-26b-a4b-it` takes 18.3 percent having answered 40 rounds of 40
  // with no cut, and `hf:zai-org/GLM-5.2` sits at 8.2 percent, below the null
  // in this pass and in the 12-round pass before it. GLM-5.2 loses the seat.
  //
  // `qwen3.8-max` IS EXCLUDED DESPITE THE BEST HEADLINE, 27.0 percent. It
  // answered 28 rounds of 40, and the 12 it missed were the LARGER slices:
  // among the models that did answer, median answer length was 588 characters
  // in the rounds it missed against 366 in the rounds it made, a ratio of 1.61,
  // Mann-Whitney z +3.51, p 0.0004. Its headline is survivorship on the easy
  // half of the corpus, and it took 29 cuts, more than any other model. It
  // remained in wide roles at this calibration point, then was culled from
  // whole roster on 2026-08-28 because metered cost was disproportionate and
  // exceptionally expensive.
  //
  // THE SEAT STILL CROSSES PROVIDERS: Charm Hyper serves `glm-5.3` and
  // `deepseek-v4-pro-0813`, Synthetic serves GLM-5.3-Flash (Hyper carries it
  // too), so an outage on either side leaves the stage a writer instead of
  // emptying it. TWO OF THE THREE ARE ONE MODEL FAMILY, which the provider
  // argument alone would hide: a GLM blind spot is now shared by two seats,
  // and the third seat is the only one outside it. That is accepted on the
  // measurement rather than designed around, and it is the reason the
  // standing is re-read rather than the seat assumed. Neither reads images,
  // which costs nothing here: pictures are read in their own stage over a
  // catalog-derived roster, and `document-lanes.ts` records that no
  // repair-lane stage ever asks what one says.
  //
  // WALL CLOCK IS THE PRICE OF THIS SEAT. The two GLM models are the roster's
  // slowest voices (completed streams p50 52 to 66 s, p90 153 to 199 s), so
  // an editor round now waits on them where it once waited on nobody; the
  // corpus pass bounds that with its straggler window rather than by seating
  // a faster, worse editor.
  editorModelIds: [
    'hf:zai-org/GLM-5.3-Flash',
    'glm-5.3',
    'deepseek-v4-pro-0813',
  ],
  // An editor still judges a slate holding its own text at half weight for
  // that candidate alone.
  judgeModelIds: RUN_WIDE_SEATS,
  // MEASURED ON THE REFINER'S OWN JOB, NOT TRANSFERRED FROM THE EDITORS.
  // `editor-calibrate` runs the naturalness lane after the accuracy lane and
  // reports the refiner standing off the same spend: 25 judged refiner rounds
  // from the 25 of 40 slices that carried a paragraph over the eligibility
  // floor, pooled with the 4 rounds of the 6-slice replicate run the same
  // day, 1393 disinterested ballots against a pooled null of 14.0 percent.
  // Availability-adjusted: GLM-5.3-Flash 32.5 percent (66 of 172, z +9.21),
  // `deepseek-v4-pro-0813` 17.1 (35 of 205), `glm-5.3` 12.1 (25 of 190),
  // `minimax-m3` 9.7 (20 of 103, having proposed a rewrite in 13 of 26
  // opportunities), then Kimi-K3 7.8, Qwen3.8-27B 7.7, gpt-oss-120b 4.3,
  // gemma 3.4, deepseek-v4-flash-0731 0.5.
  //
  // THE THIRD SEAT WENT ON RELIABILITY, by the rule written before the
  // numbers arrived. Bootstrapping whole slices (26 winner-bearing rounds,
  // 4000 resamples) puts GLM-5.3-Flash in the top three 99.9 percent of the
  // time and deepseek-v4-pro-0813 97.5, but leaves `glm-5.3` (24.3) and
  // `minimax-m3` (42.8) unseparated; where the third and fourth seats are
  // not separated, the seat goes to the model that lost fewer voices under
  // the production window, and minimax-m3 lost none (p90 48 s) where
  // `glm-5.3` is the roster's slowest voice and lost 15 of 78 asks.
  refinerModelIds: [
    'hf:zai-org/GLM-5.3-Flash',
    'deepseek-v4-pro-0813',
    'minimax-m3',
  ],
  // THREE, MEASURED RATHER THAN PREFERRED, and the wide arm is gone. The
  // owner ruled on 2026-08-23 that checker width is settled by measurement:
  // the same entries run once with these three and once with all six,
  // per-issue resolution compared, winner shipped and loser deleted. Four wide
  // runs answered it on 2026-08-24 with 231 rounds and 1360 ballots, and NOT
  // ONE verdict moved.
  //
  // THE NULL IS ABOUT WIDTH RATHER THAN ABOUT SILENCE, which is the only way a
  // null settles anything here. The six disagreed on 14 rounds, and on 10 of
  // those a writer answered something no checker of the narrow three said, so
  // the extra ballots carried real information. The arithmetic absorbed it:
  // a checker judging text it helped write counted half, so three writers
  // brought 1.5 against 3.0 and could not overturn a unanimous three. They
  // could only reach a split three, which happened on 4 rounds, and on none of
  // those did all three writers dissent together.
  //
  // NEMOTRON LEFT EVERY ROLE on 2026-08-29 at the owner's instruction after it
  // contradicted its own adjacent required-correction guidance. Kimi-K3 takes
  // that checker seat rather than shrinking below the hard floor of three. It
  // was already one of the added checker voices in all 231 measured wide-arm
  // rounds, where added voices changed no resolution verdict. That evidence is
  // about ensemble effect rather than individual checker ranking; a fresh
  // checker-seat calibration remains required before calling the new narrow
  // roster independently optimal.
  //
  // DISJOINT AGAIN SINCE 2026-09-01, BY MEASUREMENT RATHER THAN BY RULE: the
  // editor calibration seated no checker as editor or refiner. Overlap stays
  // PERMITTED, the owner's decision of 2026-08-24 (enable the discount and let
  // every model do both; `#187` found the checker-side discount unreachable in
  // production for exactly the reason the old note here gave), so a future
  // seating that overlaps needs no rule change.
  //
  // WHAT MAKES OVERLAP SAFE is measured rather than assumed, and it is the
  // paragraph above: a checker judging text it helped write counts half, so
  // three writers bring 1.5 against 3.0 and cannot overturn a unanimous three.
  // Between 2026-08-24 and 2026-09-01 two checker ids were also producer ids,
  // and only actual authorship of text under review received half weight: had
  // both helped write one refined result, their combined weight would have
  // been 1.0, equal to disinterested GPT-OSS alone, unable to resolve an issue
  // against that independent vote.
  checkerSelfCertificationPermitted: true,
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:moonshotai/Kimi-K3',
    'hf:openai/gpt-oss-120b',
  ],
};

// Refuse invalid production role composition at configuration load rather than
// after a live corpus pass has already paid for critics, panels, and editors.
assertCheckerIndependence({
  editorModelIds: RUN_MODELS.editorModelIds,
  refinerModelIds: RUN_MODELS.refinerModelIds ?? [],
  checkerModelIds: RUN_MODELS.checkerModelIds,
  selfCertificationPermitted: RUN_MODELS.checkerSelfCertificationPermitted ?? false,
},);
assertCheckerQuorumReachable({
  checkerModelIds: RUN_MODELS.checkerModelIds,
},);

/**
 * Roster the translate lane runs under during a corpus pass.
 *
 * BOTH ROLES TOOK THE WHOLE ROSTER until 2026-09-01, which was a narrower
 * claim than it looked. The translate lane has two stages and no third: models
 * write a candidate, then models rank the slate. There is no editor stage to
 * keep a producer out of and no checker stage certifying its own work, so the
 * exclusions {@link RUN_MODELS} spends most of its rationale on have nothing to
 * exclude here. What narrows the seats now is measurement rather than role
 * structure: {@link RUN_TRANSLATORS} drops the two writers the 40-round
 * producer calibration placed under its pooled null, and {@link RUN_WIDE_SEATS}
 * drops the judge that lost a third of its select asks to the production
 * window, both on the owner's authorization of that day.
 *
 * Self-certification is HANDLED RATHER THAN FORBIDDEN: a judge ranking a slate
 * that holds its own translation counts half for that candidate alone, exactly
 * as the repair lane's selection round does. Whether that weighting is the right
 * one is `#91`, and it is the same open question for both lanes rather than a
 * new one this constant introduces.
 *
 * The width the judge-fidelity probe and the window trial MEASURED was the
 * whole roster of their day, six models in both roles. A pass under seven
 * translators and eight judges reports on a lane neither measurement covers
 * exactly, as every roster change since has, which is one reason the pass's
 * own output is read before any readiness claim.
 *
 * @example
 * ```ts
 * const lanes = await runDocumentLanes({ translateModels: RUN_TRANSLATE_MODELS, ... },);
 * ```
 */
export const RUN_TRANSLATE_MODELS: TranslateModels = {
  translatorModelIds: RUN_TRANSLATORS,
  judgeModelIds: RUN_WIDE_SEATS,
};

/**
 * Models that read this run's pictures.
 *
 * DERIVED FROM THE CATALOG rather than listed by hand, so the roster is
 * whatever the provider's own `input_modalities` says can be sent an image. A
 * hand-written list would go stale the day a model gains or loses the
 * capability, and it would go stale silently: a text-only model sent a picture
 * answers about nothing, and the call is spent either way.
 *
 * READING IS ITS OWN STAGE, and the roster's narrowness when the stage was
 * built is why. Exactly two models read images while the roster was one
 * provider's six; selection needs a minimum weight of two, and a producer's
 * ballot for its own work counts half, so if those two also translated then no
 * disinterested judge would remain on any slice carrying a picture. Asking them
 * only to READ turns the picture into text, and the whole roster translates
 * and judges from that text with its weights untouched. Four of the nine read
 * images since the 2026-09-01 catalog refresh (`glm-5.3` reads none); the stage
 * stays separate because the reasoning in this note is about weights, not about
 * how many readers there happen to be.
 *
 * @example
 * ```ts
 * const readings = await readDocumentPictures({ readerModelIds: RUN_READER_MODELS, ... },);
 * ```
 */
export const RUN_READER_MODELS: readonly RosterModelId[] = ROSTER_MODEL_IDS
  .filter(function reads(modelId,): boolean {
    return readsImages({ modelId, },);
  },);

/**
 * Deadline granted to one model exchange during a corpus run.
 *
 * Was 240_000, which measurably clipped real work. Run 013 sampled every call
 * unfiltered: 748 succeeded and 35 were cut at the deadline, a 4.5 percent
 * censoring rate, while the surviving time-to-first-byte distribution ran p50
 * 45_837 ms, p90 163_296 ms, p99 218_976 ms, and max 235_151 ms. Fifteen calls
 * landed in the last 25 seconds before the cut, so the distribution had real
 * density right up to the boundary with NO cliff ahead of it. That is the
 * signature of clipping, not of connections hanging: a call completing at
 * 245_000 ms would be unremarkable beside the ones observed at 235_151 ms.
 *
 * Timeouts still arrive in correlated batches, about five per retry round,
 * which once looked like evidence of hangs. It reconciles if the provider slows
 * every concurrent call together under load, so a batch crosses the deadline
 * together. That explains the correlation without hangs, and it means the added
 * waiting falls during congested periods specifically.
 *
 * 360_000 is chosen against the measurement rather than as a round multiple: it
 * clears the observed p99 by 64 percent and the observed maximum by 53 percent,
 * while keeping a worst-case stage bounded. `STAGE_RETRY_ROUNDS` allows four
 * deadlines in one stage, so this caps a pathological stage near 24 minutes
 * against the 90 minute per-entry ceiling, where 480_000 would put it past 32.
 * Raising it should also REDUCE retry rounds by losing fewer voices, so the
 * worst case gets rarer as well as no worse.
 *
 * Sampling stays unfiltered, so the next run reports how much tail still gets
 * clipped at 360_000 and this can be tuned on evidence again.
 */
export const RUN_PER_CALL_TIMEOUT_MS = 360_000;

/**
 * Call-timing knobs an artifact was produced under, so a pool spanning more
 * than one configuration can still be analyzed per cohort.
 *
 * @example
 * ```ts
 * const config: RunCallConfig = {
 *   perCallTimeoutMs: 240_000,
 *   streamFirstByteMs: 150_000,
 *   streamIdleMs: 60_000,
 * };
 * ```
 */
export type RunCallConfig = {
  /**
   * Total-duration deadline one model exchange was granted.
   */
  readonly perCallTimeoutMs: number;

  /**
   * Silence allowed before a stream's first byte.
   */
  readonly streamFirstByteMs: number;

  /**
   * Silence allowed between a stream's bytes once flowing.
   */
  readonly streamIdleMs: number;
};

/**
 * Call-timing configuration stamped into every artifact this pass writes.
 *
 * The pool it labels is deliberately MIXED, by a decision the user made twice:
 * keep already-settled entries rather than discard the compute.
 *
 * An earlier version of this note promised more than the stamp can deliver: it
 * said precision could be split by cohort at analysis time, turning the
 * confound into a number. RETRACTED, because the arithmetic does not support
 * it. The graded sample is 50 items and the pool at the coverage bar is about
 * 30 entries split near evenly between cohorts, so a per-cohort precision
 * estimate rests on roughly 25 graded items and carries a standard error near
 * 8 points. A difference small enough to matter cannot resolve at that width,
 * and the binding constraint is human grading effort, not compute, so widening
 * the sample to the several hundred per cohort that would resolve it is not
 * available. Claiming the number anyway would repeat the exact error retracted
 * from the panel-coverage analysis: pooling across a noisy dimension and
 * reading the result as signal.
 *
 * What the stamp is still for: identifying which cohort any artifact came from,
 * so the mixed pool is disclosed QUALITATIVELY with the verdict rather than
 * left unstated, and so a later analysis over a larger graded set is possible
 * if one is ever funded.
 *
 * Three cohorts exist in the round-two pool, and the first two are equivalent
 * for call timing even though they look different:
 *
 * -   Ten entries with NO `callConfig` field at all, settled before the field
 *     existed. Their absence identifies them exactly.
 * -   Five entries stamped `perCallTimeoutMs: 240_000`, from run 013. The
 *     stream idle guard existed during this run but fired ZERO times, so these
 *     five ran under the same effective timing as the ten above. Treat the
 *     fifteen as ONE cohort.
 * -   Entries stamped `perCallTimeoutMs: 360_000` and later, which are the
 *     first to run without the deadline clipping roughly 4.5 percent of calls.
 *
 * Deliberately not surfaced on the grading sheet: a grader who could see which
 * cohort an issue came from would be a worse instrument than one who could not.
 */
export const RUN_CALL_CONFIG: RunCallConfig = {
  perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
  streamFirstByteMs: STREAM_FIRST_BYTE_MS,
  streamIdleMs: STREAM_IDLE_MS,
};

/**
 * Corpus read location and commit with any environment override applied,
 * beside where each half came from, for launch logs.
 */
export const RUN_CORPUS_PIN_SETTING: CorpusPinSetting = readCorpusPinSetting({
  fallback: {
    cloneDir: join(
      homedir(),
      'one-among-us',
      'data',
    ),
    commitSha: CORPUS_COMMIT_SHA,
  },
},);

/**
 * Pinned corpus read location: the user's local clone at the benchmark commit
 * unless the environment overrides either half
 * (`TRANSLATION_REPAIR_CORPUS_CLONE_DIR`, `TRANSLATION_REPAIR_CORPUS_COMMIT`),
 * which fixture runs against an unmerged corpus pull request need.
 * Content is read at runtime and never committed here (the clone is UNLICENSED).
 */
export const RUN_CORPUS_PIN: CorpusPin = RUN_CORPUS_PIN_SETTING.pin;

/**
 * Worktree root of this checkout, resolved through git from this file's dir.
 *
 * @returns Absolute path to the worktree top level
 *
 * @example
 * ```ts
 * const root = await resolveWorktreeRoot();
 * ```
 */
async function resolveWorktreeRoot(): Promise<string> {
  /**
   * Captured git stdout: the worktree top-level path.
   */
  const { stdout, } = await spawn(
    await resolveGit(),
    [
      '-C',
      HERE,
      'rev-parse',
      '--show-toplevel',
    ],
  );
  return stdout;
}

/**
 * Current HEAD commit of this worktree, recorded into run artifacts so every
 * result names the pipeline tip that produced it.
 *
 * @returns Full HEAD sha
 *
 * @example
 * ```ts
 * const tip = await readHeadSha();
 * ```
 */
export async function readHeadSha(): Promise<string> {
  /**
   * Captured git stdout: the HEAD sha.
   */
  const { stdout, } = await spawn(
    await resolveGit(),
    [
      '-C',
      HERE,
      'rev-parse',
      'HEAD',
    ],
  );
  return stdout;
}

/**
 * Durable, gitignored directory that holds run artifacts, logs, and the
 * attempts map. Honors `TRANSLATION_REPAIR_RUNS_DIR`, else defaults under the
 * worktree's `node_modules/.monochromatic/`.
 *
 * @returns Absolute runs directory path
 *
 * @example
 * ```ts
 * const runsDir = await resolveRunsDir();
 * ```
 */
export async function resolveRunsDir(): Promise<string> {
  /**
   * Explicit runs-dir override from the environment, when set.
   */
  const override = process.env
    .TRANSLATION_REPAIR_RUNS_DIR;
  if ((override !== undefined) && (override !== ''))
    return override;
  return join(
    await resolveWorktreeRoot(),
    'node_modules',
    '.monochromatic',
    'translation-repair-runs',
  );
}

/**
 * Logger root for the corpus-run wiring layer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Builds caller that should remain unreachable while unconfigured provider is dry.
 *
 * @param provider - absent provider named in invariant diagnostic
 *
 * @returns Text caller refusing accidental dispatch
 *
 * @example
 * ```ts
 * const caller = unconfiguredProviderCaller({ provider: 'hyper', });
 * ```
 */
function unconfiguredProviderCaller(
  { provider, }: { readonly provider: 'synthetic' | 'hyper'; },
): Pick<ModelCaller, 'chatText'> {
  return {
    // oxlint-disable-next-line require-await, typescript/require-await -- caller contract is asynchronous; refusal must occur without provider call
    chatText: async function refuseUnconfigured(request,) {
      throw new NoProviderForModelError({
        modelId: request.modelId,
        reason: `${provider} provider is not configured`,
      },);
    },
  };
}

/**
 * Synthetic quota shape used only when Hyper is sole configured provider.
 *
 * Router receives absent Synthetic as dry directly;
 * this compatibility method keeps client surface stable for observational callers.
 *
 * @returns Explicitly exhausted synthetic quota
 *
 * @example
 * ```ts
 * const quota = await unconfiguredSyntheticQuota();
 * ```
 */
// oxlint-disable-next-line require-await, typescript/require-await -- compatibility meter contract is asynchronous
async function unconfiguredSyntheticQuota(): Promise<QuotaSnapshot> {
  return {
    fiveHour: {
      remaining: 0,
      max: 0,
      limited: true,
      nextTickAt: '',
    },
    weekly: {
      percentRemaining: 0,
      nextRegenAt: '',
    },
  };
}

/**
 * Builds client every run calls from every configured provider,
 * counting every call.
 *
 * ONE FACTORY, so provider routing reaches every corpus-run entrypoint at once
 * rather than each one growing its own configuration.
 *
 * IT STILL ANSWERS `quotas`, which is the first provider's meter and nothing
 * else. The routing client does not offer one, because the two providers meter
 * differently and there is no single reading; this wiring layer is where the
 * knowledge that `quotas` means the Synthetic meter belongs, and keeping the
 * method here leaves every existing caller and the bench recorder untouched.
 *
 * ONE KEY IS ENOUGH.
 * Missing provider is marked dry before routing,
 * so its seats become unavailable without unauthorized calls.
 * Exact-half participation lets other provider operate normally;
 * no provider family or cross-provider response is mandatory.
 * Both missing remains launch refusal because no call can run.
 *
 * EVERY CALL IS COUNTED on `RUN_SEATS`, the process-wide tally the refusal
 * boundary prints when the command ends, so a seat that produced nothing
 * usable is named in the closing lines of every command rather than only in
 * the calibration's coverage sentence.
 *
 * @param transport - HTTP seam handed to both providers' clients; tests inject
 * one to watch where a call goes, production leaves it absent for fetch
 *
 * @param promptPayloadDir - optional durable payload checkpoint beneath run root
 *
 * @returns Ready client, routed across configured providers and counted per seat
 *
 * @throws {@link RunConfigError} when both provider key variables are unset or empty
 *
 * @example
 * ```ts
 * const client = createRunClient();
 * ```
 */
export function createRunClient(
  {
    transport,
    promptPayloadDir,
  }: {
    readonly transport?: ModelTransport;
    readonly promptPayloadDir?: string;
  } = {},
): SyntheticClient {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: createRunClient.name,
    l,
  },);

  /**
   * Synthetic API key, resolved by name from the mise-injected env.
   */
  const apiKey = process.env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';
  /**
   * Second provider key,
   * independently optional because either provider may run alone.
   */
  const hyperKey = process.env
    .TRANSLATION_REPAIR_CHARM_HYPER_API_KEY
    ?? '';
  if ((apiKey === '') && (hyperKey === '')) {
    throw new RunConfigError({
      variable: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY or TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
    },);
  }

  /**
   * Transport handed to configured clients,
   * absent when production's fetch is meant.
   */
  const seam = (transport === undefined)
    ? {}
    : { transport, };

  /**
   * First provider client when configured.
   */
  const synthetic = (apiKey === '')
    ? undefined
    : createSyntheticClient({
      apiKey,
      ...seam,
    },);

  /**
   * Second provider client when configured.
   */
  const hyper = (hyperKey === '')
    ? undefined
    : createHyperClient({
      apiKey: hyperKey,
      requestsPerHour: hyperRequestsPerHour({ env: process.env, },),
      ...seam,
    },);

  /**
   * Shared budget view both providers are routed by.
   */
  const budgets = createProviderBudgets({
    ...((synthetic === undefined) ? {} : { synthetic, }),
    ...((hyper === undefined) ? {} : { hyper, }),
  },);

  /**
   * Routed client with stable compatibility quota surface.
   */
  const routed: SyntheticClient = {
    ...createRoutingClient({
      synthetic: synthetic ?? unconfiguredProviderCaller({ provider: 'synthetic', },),
      hyper: hyper ?? unconfiguredProviderCaller({ provider: 'hyper', },),
      budgets,
    },),
    quotas: synthetic?.quotas ?? unconfiguredSyntheticQuota,
  };

  rl.debug(
    `provider configuration synthetic=${String(synthetic !== undefined,)} hyper=${String(hyper !== undefined,)}`,
  );

  return promptUniqueClient({
    inner: seatTallyClient({
      inner: routed,
      tally: RUN_SEATS,
    },),
    ...((promptPayloadDir === undefined)
      ? {}
      : { store: promptPayloadStore({ dir: promptPayloadDir, },), }),
  },);
}

//endregion Corpus-run configuration
