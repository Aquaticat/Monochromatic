import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import { buildCriticMessages, } from './critic-prompt.ts';
import {
  CRITIC_RESPONSE_FORMAT,
  isCriticReportWire,
  resolveCriticIssue,
} from './critic-wire.ts';
import type { IssueClaim, } from './issue-model.ts';
import { parseDocument, } from './parse-document.ts';
import {
  computeScorecard,
  type BenchmarkScorecard,
  type CriticAttemptRecord,
} from './scorecard.ts';
import {
  applySeededErrors,
  seedHitByRegion,
  type SeededErrorApplication,
  type SeededErrorSpec,
} from './seeded-error.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Critic benchmark
// Milestone-one exit harness: plant seeds into real translations, fan the seeded
// pair out to every critic model, grade findings mechanically, and aggregate the
// scorecard whose ensemble recall is the go/no-go number. HTTP failures are
// attempt data; abort errors propagate so user steering always wins.

/**
 * Logger root for the benchmark shell.
 */
const l = tagged({ tag: 'translation-repair-benchmark', },);

/**
 * Default per-call deadline.
 * Provider inference speed varies wildly per model and calls can hang
 * midway, so every call carries its own deadline;
 * a stuck model forfeits one attempt instead of stalling the whole run.
 */
const DEFAULT_PER_CALL_TIMEOUT_MS = 600_000;

/**
 * One corpus entry prepared for benchmarking.
 *
 * @example
 * ```ts
 * const entry: BenchmarkEntry = {
 *   entryId: 'whiskers',
 *   sourceText: zh,
 *   targetText: en,
 *   seeds: deriveOmissionSeeds({ text: enBody, maxSeeds: 2, },),
 * };
 * ```
 */
export type BenchmarkEntry = {
  /**
   * Corpus entry id, e.g. the `people/<id>` directory name.
   */
  readonly entryId: string;

  /**
   * Original document, front matter included.
   */
  readonly sourceText: string;

  /**
   * Clean translation; seeds are planted into it here.
   */
  readonly targetText: string;

  /**
   * Errors to plant, in application order.
   */
  readonly seeds: readonly SeededErrorSpec[];
};

/**
 * Whole benchmark result: raw graded attempts plus the aggregate scorecard.
 *
 * @example
 * ```ts
 * const { attempts, scorecard, } = await runCriticBenchmark({ client, entries, modelIds, signal, },);
 * ```
 */
export type CriticBenchmarkResult = {
  /**
   * Every graded attempt, model-major then entry order.
   */
  readonly attempts: readonly CriticAttemptRecord[];

  /**
   * Aggregate scorecard over the attempts.
   */
  readonly scorecard: BenchmarkScorecard;
};

/**
 * Grades resolved claims against planted regions.
 *
 * @param claims - validated claims from one attempt
 *
 * @param applications - planted regions in seeded-text coordinates
 *
 * @returns Ids of seeds hit by any claim's target-side span
 *
 * @example
 * ```ts
 * const hits = gradeHits({ claims, applications, },);
 * ```
 */
function gradeHits(
  {
    claims,
    applications,
  }: {
    readonly claims: readonly IssueClaim[];
    readonly applications: readonly SeededErrorApplication[];
  },
): readonly string[] {
  return applications
    .filter(function hitByAnyClaim(application,) {
      return claims.some(function claimHits(claim,) {
        return claim
          .spans
          .some(function spanHits(span,) {
            if (span.side !== 'target')
              return false;
            return seedHitByRegion({
              spanStart: span.startOffset,
              spanEnd: span.endOffset,
              application,
            },);
          },);
      },);
    },)
    .map(function toId(application,) {
      return application
        .spec
        .id;
    },);
}

/**
 * Runs the critic benchmark: every model reviews every seeded entry.
 * Models run in parallel per entry (the client serializes per model);
 * entries run sequentially so quota pressure stays observable.
 *
 * @param client - injected model client; tests pass recorded transports
 *
 * @param entries - prepared entries with seeds
 *
 * @param modelIds - critic models under evaluation
 *
 * @param signal - abort signal honored by every exchange
 *
 * @param perCallTimeoutMs - deadline joined onto every single call;
 * expiry forfeits that attempt as data while caller aborts still propagate
 *
 * @returns Graded attempts plus the aggregate scorecard
 *
 * @throws {@link import('./seeded-error.ts').SeedApplicationError} when a seed spec is misconfigured
 *
 * @example
 * ```ts
 * const result = await runCriticBenchmark({ client, entries, modelIds, signal, },);
 * console.log(result.scorecard.ensembleRecall,);
 * ```
 */
export async function runCriticBenchmark(
  {
    client,
    entries,
    modelIds,
    signal,
    perCallTimeoutMs = DEFAULT_PER_CALL_TIMEOUT_MS,
  }: {
    readonly client: SyntheticClient;
    readonly entries: readonly BenchmarkEntry[];
    readonly modelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
  },
): Promise<CriticBenchmarkResult> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: runCriticBenchmark.name,
    l,
  },);

  /**
   * Graded attempts accumulated entry by entry.
   */
  const attempts: CriticAttemptRecord[] = [];

  for (const entry of entries) {
    /**
     * Seeded translation and its planted regions.
     */
    const {
      seededText,
      applications,
    } = applySeededErrors({
      text: entry.targetText,
      specs: entry.seeds,
    },);

    /**
     * Parsed pair every claim of this entry anchors against.
     */
    const documents = {
      source: parseDocument({ text: entry.sourceText, },),
      target: parseDocument({ text: seededText, },),
    } as const;

    /**
     * Prompt shared by every model for this entry.
     */
    const messages = buildCriticMessages({
      sourceText: entry.sourceText,
      targetText: seededText,
    },);

    /**
     * Planted ids repeated on every record of this entry.
     */
    const plantedSeedIds = applications.map(function toId(application,) {
      return application
        .spec
        .id;
    },);

    rl.debug(
      `${entry.entryId}: ${String(plantedSeedIds.length,)} seeds, ${
        String(modelIds.length,)
      } models`,
    );

    /**
     * One graded record per model, resolved in parallel.
     */
    // oxlint-disable-next-line no-await-in-loop -- entries run sequentially by design so quota pressure stays observable
    const entryRecords = await Promise.all(
      modelIds.map(async function attemptOne(modelId,): Promise<CriticAttemptRecord> {
        /**
         * Per-call deadline joined with the caller's signal;
         * expiry aborts only this attempt.
         */
        const callSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(perCallTimeoutMs,),
        ],);

        try {
          /**
           * Outcome of this model's review.
           */
          const outcome = await client.chatJson({
            modelId,
            messages,
            signal: callSignal,
            temperature: 0,
            responseFormat: CRITIC_RESPONSE_FORMAT,
            validate: isCriticReportWire,
          },);

          /**
           * Usage block pulled out for the token spread.
           */
          const { usage, } = outcome;

          /**
           * Completion tokens carried onto the record when reported.
           */
          const tokenSpread = usage === undefined
            ? {}
            : { completionTokens: usage.completion_tokens, };

          if (outcome.kind === 'refusal-shaped') {
            return {
              modelId,
              entryId: entry.entryId,
              outcomeKind: 'refusal-shaped',
              detail: outcome.marker,
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds,
              ...tokenSpread,
            };
          }
          if (outcome.kind === 'schema-mismatch') {
            return {
              modelId,
              entryId: entry.entryId,
              outcomeKind: 'schema-mismatch',
              detail: outcome.detail,
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds,
              ...tokenSpread,
            };
          }

          /**
           * Resolutions of every wire issue in report order.
           */
          const resolutions = outcome
            .value
            .issues
            .map(function resolveOne(wire,) {
              return resolveCriticIssue({
                wire,
                documents,
              },);
            },);

          /**
           * Claims that survived resolution and validation.
           */
          const claims = resolutions.flatMap(function toClaim(resolution,) {
            return resolution.resolved
              ? [resolution.claim,]
              : [];
          },);

          return {
            modelId,
            entryId: entry.entryId,
            outcomeKind: 'ok',
            detail: '',
            resolvedClaimCount: claims.length,
            unresolvedReasons: resolutions.flatMap(function toReason(resolution,) {
              return resolution.resolved
                ? []
                : [resolution.reason,];
            },),
            seededHitIds: gradeHits({
              claims,
              applications,
            },),
            plantedSeedIds,
            ...tokenSpread,
          };
        }
        catch (error) {
          if (error instanceof SyntheticHttpError) {
            return {
              modelId,
              entryId: entry.entryId,
              outcomeKind: 'http-error',
              detail: `HTTP ${String(error.status,)}`,
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds,
            };
          }
          // Aborts must always win so user steering can stop a fan-out;
          // any other transport failure is attempt data for the scorecard.
          if (signal.aborted)
            throw error;
          return {
            modelId,
            entryId: entry.entryId,
            outcomeKind: 'http-error',
            detail: `transport: ${String(error,)}`,
            resolvedClaimCount: 0,
            unresolvedReasons: [],
            seededHitIds: [],
            plantedSeedIds,
          };
        }
      },),
    );
    attempts.push(...entryRecords,);
  }

  return {
    attempts,
    scorecard: computeScorecard({ attempts, },),
  };
}

//endregion Critic benchmark
