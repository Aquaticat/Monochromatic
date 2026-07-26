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
  'hf:moonshotai/Kimi-K2.7-Code',
  'hf:MiniMaxAI/MiniMax-M3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Role roster for a corpus run: all seven critique and adjudicate, GLM-5.2
 * edits, the strongest three check the shipped repair.
 */
export const RUN_MODELS: RepairModels = {
  criticModelIds: RUN_ROSTER,
  panelModelIds: RUN_ROSTER,
  editorModelId: 'hf:zai-org/GLM-5.2',
  checkerModelIds: [
    'hf:zai-org/GLM-5.2',
    'hf:Qwen/Qwen3.6-27B',
    'hf:moonshotai/Kimi-K2.7-Code',
  ],
};

/**
 * Deadline granted to one model exchange during a corpus run.
 */
export const RUN_PER_CALL_TIMEOUT_MS = 240_000;

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
 * The pool it labels is deliberately MIXED: the user chose to keep the ten
 * entries settled before the stream idle guard landed rather than discard that
 * compute, accepting that panel completeness changed underneath the pool. The
 * stamp is what keeps that choice analyzable instead of merely accepted:
 * precision can be split by cohort at analysis time, so the confound becomes a
 * number rather than an unknown. Artifacts written before this field existed
 * carry no `callConfig` at all, and that ABSENCE identifies the pre-guard
 * cohort exactly.
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
