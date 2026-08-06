import { homedir, } from 'node:os';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  CORPUS_COMMIT_SHA,
  type CorpusPin,
} from '../corpus-source.ts';
import type { RepairModels, } from '../repair-contract.ts';
import {
  STREAM_FIRST_BYTE_MS,
  STREAM_IDLE_MS,
} from '../stream-idle-guard.ts';
import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';

//region Corpus-run configuration
// Shared roster, budgets, corpus pin, and location resolvers for the corpus-run
// entrypoints (`corpus-pass.ts`, `sentinel-probe.ts`). These are operational
// runners, not library API: they invoke the fully tested pipeline over the real
// UNLICENSED corpus and write corpus-derived artifacts, so their output goes to
// the gitignored durable dir `node_modules/.monochromatic/translation-repair-runs/`
// (AGENTS.md TMP/NMD), never into git.

/**
 * Directory of this source file, for locating the worktree via git.
 */
const HERE = import.meta.dirname;

/**
 * Real git binary; the repo PATH shim's staging guards are irrelevant to
 * read-only calls.
 */
const GIT_BINARY = '/usr/bin/git';

/**
 * Every model on the flat-rate Synthetic plan.
 * Critics and the adjudication panel both use the whole roster so coverage
 * overlaps across models rather than partitioning the work.
 */
export const RUN_ROSTER: readonly SyntheticModelId[] = [
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Role roster for a corpus run: all SIX critique and adjudicate, two edit
 * against each other, one refines the result for naturalness, and three check
 * the shipped repair.
 *
 * The panel is six rather than seven because the provider withdrew two models
 * and only one replacement (Kimi-K3) appeared. `gatherStageVoices` computes
 * the stage quorum as `voices >= ceil(modelIds.length / 2)`, so seven models
 * need 4 voices and six need 3.
 *
 * The ISSUE-acceptance gate does move, and the user accepted the move rather
 * than it happening unnoticed: `DEFAULT_ADJUDICATION_CONFIG.minBallotWeight` is
 * the absolute value 3, so the share of the panel that must cast a non-abstain
 * ballot before any decision rises from 3-of-7 (43 percent) to 3-of-6 (50).
 * User decision, 2026-08-05: "50% is okay here."
 *
 * TWO editors, not one, on the user's rule that no single model should control
 * any part of the pipeline. Kimi-K3 is one of them because the user reports it
 * as much stronger than anything else currently offered, and the editor is
 * where model strength converts most directly into repair quality. The
 * round-two grading supports spending strength there specifically: four of the
 * 37 true positives carried notes saying detection was right but the proposed
 * repair was poor ("is there a better way?"), which is an editor complaint, not
 * a critic one. GLM-5.2 is the second editor, having held the role alone
 * before.
 *
 * Two rather than three deliberately. Every editor is barred from judging its
 * own chunk, so each added editor costs a judge as well as its own calls: at
 * two editors four judges remain, at three only three, and a plurality gets
 * harder to reach exactly as the candidate set gets wider. Raise it only after
 * the `editor-chunk-select` findings show how often judging converges.
 *
 * Judges are the WHOLE roster. Selection removes producers per round, so
 * passing the whole roster lets an editor judge the envelopes it did not
 * propose for, while never judging its own text.
 *
 * Checkers deliberately EXCLUDE every editor, so nothing checks its own work.
 * That drops GLM-5.2 from the checker set it held while it was also editing,
 * and gpt-oss-120b takes the seat. GLM-4.7-Flash stays out: it is the model
 * that most often loses its voice to schema mismatch, and the checker stage is
 * where a lost voice costs proof rather than coverage.
 *
 * ONE refiner runs the naturalness lane, and it is Kimi-K3, which also edits.
 * Nothing forbids that: judges exclude producers per selection round, so the
 * refinement is still chosen by models with no stake in it, and the checker
 * roster excludes every editor and every refiner, so nothing certifies its own
 * text. The tradeoff is real and is accepted rather than hidden: a model that
 * just wrote a paragraph is a poor judge of whether that paragraph reads
 * awkwardly. The alternative was GLM-4.7-Flash, the only strong-enough model
 * that neither edits nor checks, and it is also the model that most often
 * loses its voice to schema mismatch. Naturalness is a writing task, so
 * strength won. Revisit if the `refine-` findings show the lane changing
 * little.
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
  editorModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:zai-org/GLM-5.2',
  ],
  judgeModelIds: RUN_ROSTER,
  refinerModelIds: ['hf:moonshotai/Kimi-K3',],
  checkerModelIds: [
    'hf:Qwen/Qwen3.6-27B',
    'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
    'hf:openai/gpt-oss-120b',
  ],
};

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
    GIT_BINARY,
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
    GIT_BINARY,
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
 * Builds the Synthetic client from the mise-injected API key, read by name and
 * never printed. Per-model concurrency defaults to one.
 *
 * @returns Ready client
 *
 * @throws {@link Error} when the key env var is unset
 *
 * @example
 * ```ts
 * const client = createRunClient();
 * ```
 */
export function createRunClient(): SyntheticClient {
  /**
   * Synthetic API key, resolved by name from the mise-injected env.
   */
  const apiKey = process.env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';
  if (apiKey === '')
    throw new Error(
      'TRANSLATION_REPAIR_SYNTHETIC_API_KEY is not set; run under mise so sops injects it',
    );
  return createSyntheticClient({ apiKey, },);
}

//endregion Corpus-run configuration
