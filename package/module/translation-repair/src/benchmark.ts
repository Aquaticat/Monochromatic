import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { isRetryableAttempt, } from './attempt-retry.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import {
  CRITIC_RESPONSE_FORMAT,
  isCriticReportWire,
  resolveCriticIssue,
} from './critic-wire.ts';
import type { IssueClaim, } from './issue-model.ts';
import {
  prepareBenchmarkEntry,
  type BenchmarkEntry,
  type PreparedEntry,
} from './prepare-entry.ts';
import {
  computeScorecard,
  type BenchmarkScorecard,
  type CriticAttemptRecord,
} from './scorecard.ts';
import {
  seedHitByRegion,
  type SeededErrorApplication,
} from './seeded-error.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

export type { BenchmarkEntry, } from './prepare-entry.ts';

//region Critic benchmark
// Milestone-one exit harness: plant seeds into real translations, fan the seeded
// pair out to every critic model, grade findings mechanically, and aggregate the
// scorecard whose ensemble recall is the go/no-go number. HTTP failures are
// attempt data; abort errors propagate so user steering always wins. A
// transient-shaped attempt (token-ceiling truncation, exhausted HTTP
// retries, dropped transport, forfeited deadline) earns exactly one fresh
// second attempt because the serving stack flips between completion and
// failure on identical input. Models run in parallel but each model works
// its entry queue sequentially (the dispatch bench proved one stream per
// model is fastest on this plan), and an optional run budget stops
// dispatching when time runs out so wall time stays bounded; what the
// budget cuts is recorded as skipped, never silently dropped.

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
 * Budget floor under which no new exchange dispatches:
 * a sliver of remaining budget cannot fit a useful critic call,
 * so the attempt records as skipped instead of burning quota on a
 * guaranteed forfeit.
 */
export const MIN_DISPATCH_BUDGET_MS = 30_000;

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
 * Models run in parallel;
 * each model works its entry queue sequentially,
 * because the dispatch bench proved one stream per model is the fastest
 * dispatch on this plan,
 * so wall time approaches the slowest model's whole queue.
 * A transient-shaped failure (truncation or HTTP-failure record) earns one
 * retry with a fresh deadline;
 * the final record keeps the discarded first detail in
 * `retriedFirstAttemptDetail`.
 * With a run budget,
 * attempts the budget cannot fit are recorded as skipped and never
 * dispatched,
 * bounding wall time at roughly the budget plus one call deadline.
 *
 * @param client - injected model client; tests pass recorded transports
 *
 * @param entries - prepared entries with seeds
 *
 * @param modelIds - critic models under evaluation
 *
 * @param signal - abort signal honored by every exchange
 *
 * @param perCallTimeoutMs - deadline the client arms per exchange inside
 * its per-model slot, so local queue wait never counts against it;
 * expiry forfeits that attempt as data while caller aborts still propagate
 *
 * @param runBudgetMs - wall budget for the whole run;
 * once it cannot fit another call, remaining attempts record as skipped,
 * and the scorecard reports the resulting coverage
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
    runBudgetMs,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly entries: readonly BenchmarkEntry[];
    readonly modelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly runBudgetMs?: number;
  }>,
): Promise<CriticBenchmarkResult> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: runCriticBenchmark.name,
    l,
  },);

  /**
   * Clock start the run budget counts from.
   */
  const runStartedAt = Date.now();

  /**
   * Reads the run budget still available; unbounded without a budget.
   *
   * @returns Milliseconds left before the run must stop dispatching
   *
   * @example
   * ```ts
   * const remaining = remainingBudgetMs();
   * ```
   */
  function remainingBudgetMs(): number {
    return runBudgetMs === undefined
      ? Number.POSITIVE_INFINITY
      : runBudgetMs - (Date.now() - runStartedAt);
  }

  /**
   * Entries prepared once, shared by every model's queue.
   */
  const prepared = entries.map(function prepareOne(entry,) {
    return prepareBenchmarkEntry({ entry, },);
  },);

  rl.debug(
    `${String(prepared.length,)} entries, ${String(modelIds.length,)} models`,
  );

  /**
   * Runs one model against one prepared entry:
   * a budget-gated attempt plus at most one budget-gated retry.
   *
   * @param modelId - model under attempt
   *
   * @param entry - prepared entry under review
   *
   * @returns Graded record of the surviving attempt
   *
   * @example
   * ```ts
   * const record = await attemptModelEntry({ modelId, entry, },);
   * ```
   */
  async function attemptModelEntry(
    {
      modelId,
      entry,
    }: {
      readonly modelId: SyntheticModelId;
      readonly entry: PreparedEntry;
    },
  ): Promise<CriticAttemptRecord> {
    /**
     * Entry facets shared by both attempts.
     */
    const {
      documents,
      messages,
      applications,
      plantedSeedIds,
    } = entry;
          /**
           * Runs one deadline-guarded exchange and grades it;
           * declared first so the transient retry below reads top-down.
           * The client arms the deadline inside the per-model slot,
           * so queue wait never counts and a retry gets the full budget.
           * Skips without dispatching when the run budget cannot fit
           * another call.
           *
           * @returns Graded record of one exchange
           *
           * @example
           * ```ts
           * const first = await attemptOnce();
           * ```
           */
          async function attemptOnce(): Promise<CriticAttemptRecord> {
          /**
           * Run budget left at dispatch time.
           */
          const remaining = remainingBudgetMs();
          if (remaining < MIN_DISPATCH_BUDGET_MS) {
            rl.warn(
              `${modelId} on ${entry.entryId}: run budget exhausted, skipping`,
            );
            return {
              modelId,
              entryId: entry.entryId,
              outcomeKind: 'skipped',
              detail: 'run-budget-exhausted',
              resolvedClaimCount: 0,
              unresolvedReasons: [],
              seededHitIds: [],
              plantedSeedIds,
            };
          }

          try {
          /**
           * Outcome of this model's review.
           */
          const outcome = await client.chatJson({
            modelId,
            messages,
            signal,
            // A budget smaller than the deadline caps the exchange too:
            // the run must not outlive its budget by a whole deadline.
            exchangeTimeoutMs: Math.min(
              perCallTimeoutMs,
              remaining,
            ),
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
        }

          /**
           * First graded attempt.
           */
          const first = await attemptOnce();
          if (!isRetryableAttempt({ record: first, },))
            return first;

          // Truncation and HTTP failure are serving-stack weather: identical
          // input flips between completion and ceiling blowout per pass, and
          // bursts shed 5xx past the client's own transport retries. One
          // fresh attempt recovers most of them; strictly one, since a
          // second failure means this pair defeats this model today.
          rl.warn(
            `${modelId} on ${entry.entryId}: ${first.outcomeKind} (${first.detail}), retrying once`,
          );

          /**
           * Second and final attempt; its outcome stands either way.
           */
          const second = await attemptOnce();
          // The budget died between the attempts: the dispatched first
          // failure stands; a skipped marker would erase real attempt data.
          if (second.outcomeKind === 'skipped')
            return first;
          return {
            ...second,
            retriedFirstAttemptDetail: first.detail,
          };
  }

  /**
   * Graded attempt groups, one per model, resolved in parallel;
   * each model's queue runs sequentially in entry order,
   * so the run budget cuts the same tail entries for every model.
   */
  const modelGroups = await Promise.all(modelIds.map(
    async function attemptModelQueue(modelId,): Promise<readonly CriticAttemptRecord[]> {
      /**
       * Records of this model's queue in entry order.
       */
      const records: CriticAttemptRecord[] = [];
      for (const entry of prepared) {
        // oxlint-disable-next-line no-await-in-loop -- sequential by design: the dispatch bench proved one stream per model is the fastest dispatch on this plan
        records.push(await attemptModelEntry({
          modelId,
          entry,
        },),);
      }
      return records;
    },
  ),);

  /**
   * Every graded attempt in model-major then entry order.
   */
  const attempts = modelGroups.flat();

  return {
    attempts,
    scorecard: computeScorecard({ attempts, },),
  };
}

//endregion Critic benchmark
