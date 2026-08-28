import { homedir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import spawn from 'nano-spawn';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  CORPUS_COMMIT_SHA,
  type CorpusPin,
} from '../corpus-source.ts';
import type { RepairModels, } from '../repair-contract.ts';
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
import { createProviderBudgets, } from '../provider-budget.ts';
import { createRoutingClient, } from '../provider-router.ts';
import {
  RUN_SEATS,
  seatTallyClient,
} from '../seat-tally.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
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
 * NINE MODELS NOW. `qwen3.8-max` was culled on 2026-08-28 at owner's
 * instruction because its metered cost was disproportionate and exceptionally
 * expensive. Remaining seats retain full weight.
 */
export const RUN_ROSTER: readonly RosterModelId[] = ROSTER_MODEL_IDS;


/**
 * Role roster for a corpus run: all NINE critique and adjudicate, THREE edit
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
 * the roster is ten across two providers since 2026-08-24, the three editors
 * and three refiners were chosen by the 40-round calibration of that day, and
 * the checkers are the three the width measurement settled.
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
 * been ten since 2026-08-24, when Charm Hyper's five seats joined.
 * `gatherStageVoices` computes the stage quorum as
 * `voices >= ceil(modelIds.length / 2)`, so seven models need 4 voices, six
 * need 3, and ten need 5.
 *
 * The ISSUE-acceptance gate does move, and the user accepted the move rather
 * than it happening unnoticed: `DEFAULT_ADJUDICATION_CONFIG.minBallotWeight` is
 * the absolute value 3, so the share of the panel that must cast a non-abstain
 * ballot before any decision rises from 3-of-7 (43 percent) to 3-of-6 (50).
 * User decision, 2026-08-05: "50% is okay here."
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
 * The naturalness lane runs on the same three models that edit, Kimi-K3 among
 * them. Nothing forbids a refiner also editing: a judge's ballot for its own
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
  criticModelIds: RUN_ROSTER,
  panelModelIds: RUN_ROSTER,
  // MEASURED, and no longer provisional. The calibration this seat waited for
  // ran on 2026-08-24: 40 rounds in which all ten roster models wrote a
  // candidate for the same slices and every other model judged them, giving
  // 2492 disinterested ballots against a pooled null of 13.48 percent.
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
  // THIS SEAT NOW CROSSES PROVIDERS, which no writer seat did before. Charm
  // Hyper serves `gemma-4-26b-a4b-it` and Synthetic serves the other two, so a
  // Synthetic outage leaves the stage a writer instead of emptying it. That it
  // reads no images costs nothing here: pictures are read in their own stage
  // over a catalog-derived roster, and `document-lanes.ts` records that no
  // repair-lane stage ever asks what one says.
  //
  // THE INSTRUMENT SITS ONE STEP FROM THIS SEAT, and saying so is the same
  // discipline that keeps this table away from the checker seats.
  // `producer-calibrate.ts` drives `runTranslateStage`, so what it measures is a
  // model writing a slice from the SOURCE while other models vote on the result.
  // An editor writes a slice and is judged the same way, but from the archive
  // text and a set of critic claims. That is far nearer than checking, which is
  // not writing at all, and it is the nearest instrument that exists; the seat
  // it replaced rested on no measurement whatsoever. An editor-role calibration
  // would settle it outright and has not been built.
  editorModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:Qwen/Qwen3.8-27B',
    'gemma-4-26b-a4b-it',
  ],
  judgeModelIds: RUN_ROSTER,
  // Same three as the editors, seated on the same 40-round measurement, and
  // one step from that instrument for the same reason the editors are.
  refinerModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:Qwen/Qwen3.8-27B',
    'gemma-4-26b-a4b-it',
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
  // those a writer answered something no checker of these three said, so the
  // extra ballots carried real information. The arithmetic is what absorbs it:
  // a checker judging text it helped write counts half, so three writers bring
  // 1.5 against 3.0 and cannot overturn a unanimous three. They could only
  // reach a split three, which happened on 4 rounds, and on none of those did
  // all three writers dissent together.
  //
  // NO LONGER DISJOINT, and that is the owner's decision of 2026-08-24: enable
  // the discount and let every model do both. `#187` found the checker-side
  // discount unreachable in production for exactly the reason the old note
  // here gave, so the arithmetic above was code nothing could run.
  //
  // WHAT MAKES THAT SAFE is measured rather than assumed, and it is the
  // paragraph above: a checker judging text it helped write counts half, so
  // three writers bring 1.5 against 3.0 and cannot overturn a unanimous three.
  // The overlap is one model, not three, so the standing arithmetic bounds it
  // with room to spare.
  checkerSelfCertificationPermitted: true,
  checkerModelIds: [
    'hf:Qwen/Qwen3.8-27B',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
    'hf:openai/gpt-oss-120b',
  ],
};

/**
 * Roster the translate lane runs under during a corpus pass.
 *
 * BOTH ROLES TAKE THE WHOLE ROSTER, which is a narrower claim than it looks.
 * The translate lane has two stages and no third: every model writes a
 * candidate, then every model ranks the slate. There is no editor stage to keep
 * a producer out of and no checker stage certifying its own work, so the
 * exclusions {@link RUN_MODELS} spends most of its rationale on have nothing to
 * exclude here.
 *
 * Self-certification is HANDLED RATHER THAN FORBIDDEN: a judge ranking a slate
 * that holds its own translation counts half for that candidate alone, exactly
 * as the repair lane's selection round does. Whether that weighting is the right
 * one is `#91`, and it is the same open question for both lanes rather than a
 * new one this constant introduces.
 *
 * The width is also what was MEASURED. The judge-fidelity probe and the window
 * trial both seat all six in both roles, so a corpus pass run under a narrower
 * roster would be reporting on a lane neither measurement covers.
 *
 * @example
 * ```ts
 * const lanes = await runDocumentLanes({ translateModels: RUN_TRANSLATE_MODELS, ... },);
 * ```
 */
export const RUN_TRANSLATE_MODELS: TranslateModels = {
  translatorModelIds: RUN_ROSTER,
  judgeModelIds: RUN_ROSTER,
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
 * images after the 2026-08-28 roster cull; the stage
 * stays separate because the reasoning above is about weights, not about how
 * many readers there happen to be.
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
 * Pinned corpus read location: the user's local clone at the benchmark commit.
 * Content is read at runtime and never committed here (the clone is UNLICENSED).
 */
export const RUN_CORPUS_PIN: CorpusPin = {
  cloneDir: join(
    homedir(),
    'one-among-us',
    'data',
  ),
  commitSha: CORPUS_COMMIT_SHA,
};

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
 * Builds the client every run calls, over both providers, counting every call.
 *
 * ONE FACTORY, so wiring the second provider here reaches every corpus-run
 * entrypoint at once rather than each one growing its own routing.
 *
 * IT STILL ANSWERS `quotas`, which is the first provider's meter and nothing
 * else. The routing client does not offer one, because the two providers meter
 * differently and there is no single reading; this wiring layer is where the
 * knowledge that `quotas` means the Synthetic meter belongs, and keeping the
 * method here leaves every existing caller and the bench recorder untouched.
 *
 * BOTH KEYS ARE REQUIRED, AND A MISSING SECOND ONE IS A REFUSAL. This used to
 * warn and hand back the first provider's client alone, on the reasoning that
 * refusing would stop a run the first provider could serve by itself. It
 * cannot safely preserve configured run: four of the nine roster seats are
 * Charm Hyper endpoint labels that Synthetic does not host, so one-provider
 * client would offer them to a provider that answers 400 to every call. An
 * earlier four-slice calibration settled with half its roster dark (`#235`).
 * Current nine-seat quorum could still settle on five Synthetic voices, which
 * makes early refusal more important: degraded run would look complete. The
 * time to refuse is before first call, not after last.
 *
 * EVERY CALL IS COUNTED on `RUN_SEATS`, the process-wide tally the refusal
 * boundary prints when the command ends, so a seat that produced nothing
 * usable is named in the closing lines of every command rather than only in
 * the calibration's coverage sentence.
 *
 * @param transport - HTTP seam handed to both providers' clients; tests inject
 * one to watch where a call goes, production leaves it absent for fetch
 *
 * @returns Ready client, routed across both providers and counted per seat
 *
 * @throws {@link RunConfigError} when either provider's key env var is unset
 * or empty; it is a stated refusal, so a CLI repeats the variable name and
 * exits 6 without frames
 *
 * @example
 * ```ts
 * const client = createRunClient();
 * ```
 */
export function createRunClient(
  { transport, }: { readonly transport?: ModelTransport; } = {},
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
  if (apiKey === '')
    throw new RunConfigError({ variable: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY', },);

  /**
   * Second provider's key, which half the roster cannot be reached without.
   */
  const hyperKey = process.env
    .TRANSLATION_REPAIR_CHARM_HYPER_API_KEY
    ?? '';
  if (hyperKey === '')
    // No one-provider run to fall back to: half the roster is served only by
    // Charm Hyper (`#235`). The refusal names the variable and the fix.
    throw new RunConfigError({ variable: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY', },);

  /**
   * Transport handed to both clients, absent when production's fetch is meant.
   */
  const seam = (transport === undefined)
    ? {}
    : { transport, };

  /**
   * First provider's client.
   */
  const synthetic = createSyntheticClient({
    apiKey,
    ...seam,
  },);

  /**
   * Second provider's client.
   */
  const hyper = createHyperClient({
    apiKey: hyperKey,
    ...seam,
  },);

  /**
   * Shared budget view both providers are routed by.
   */
  const budgets = createProviderBudgets({
    synthetic,
    hyper,
  },);

  /**
   * Routed client with the first provider's meter as its `quotas`.
   */
  const routed: SyntheticClient = {
    ...createRoutingClient({
      synthetic,
      hyper,
      budgets,
    },),
    quotas: synthetic.quotas,
  };

  rl.debug('both provider keys present; routing across both and counting every seat',);

  return seatTallyClient({
    inner: routed,
    tally: RUN_SEATS,
  },);
}

//endregion Corpus-run configuration
