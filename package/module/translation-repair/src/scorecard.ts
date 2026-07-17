import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Scorecard
// Pure aggregation over benchmark attempts. Seeded recall is the primary number
// (ground truth is planted, so misses are real); precision cannot be graded against
// seeded truth alone because the MT-seeded corpus already contains genuine errors,
// so non-seed claims are counted, not condemned. The ensemble recall ceiling is the
// milestone go/no-go number.

/**
 * How one critic attempt ended.
 *
 * @example
 * ```ts
 * const kind: CriticAttemptOutcomeKind = 'ok';
 * ```
 */
export type CriticAttemptOutcomeKind =
  | 'ok'
  | 'refusal-shaped'
  | 'schema-mismatch'
  | 'http-error';

/**
 * One critic call graded against the seeds planted for its entry.
 *
 * @example
 * ```ts
 * const record: CriticAttemptRecord = {
 *   modelId: 'hf:zai-org/GLM-5.2',
 *   entryId: 'whiskers',
 *   outcomeKind: 'ok',
 *   detail: '',
 *   resolvedClaimCount: 3,
 *   unresolvedReasons: ['ambiguous-quote (target)',],
 *   seededHitIds: ['seed/omission-0',],
 *   plantedSeedIds: ['seed/omission-0', 'seed/omission-1',],
 * };
 * ```
 */
export type CriticAttemptRecord = {
  /**
   * Model that made the attempt.
   */
  readonly modelId: SyntheticModelId;

  /**
   * Corpus entry the attempt reviewed.
   */
  readonly entryId: string;

  /**
   * How the exchange ended.
   */
  readonly outcomeKind: CriticAttemptOutcomeKind;

  /**
   * Marker, mismatch detail, or HTTP failure text; empty on clean ok.
   */
  readonly detail: string;

  /**
   * Claims that survived quote resolution and span validation.
   */
  readonly resolvedClaimCount: number;

  /**
   * Resolution failure reasons in wire order; feeds prompt iteration.
   */
  readonly unresolvedReasons: readonly string[];

  /**
   * Seed ids this attempt detected.
   */
  readonly seededHitIds: readonly string[];

  /**
   * Seed ids planted for this entry.
   */
  readonly plantedSeedIds: readonly string[];

  /**
   * Completion tokens when reported; thinking-inflated on these models.
   */
  readonly completionTokens?: number;

  /**
   * Failure detail of the discarded first attempt when this record came
   * out of the single transient retry (truncation, HTTP failure, dropped
   * transport, or forfeited deadline); absent when the first attempt
   * stood on its own.
   */
  readonly retriedFirstAttemptDetail?: string;
};

/**
 * Aggregated quality of one model across attempts.
 *
 * @example
 * ```ts
 * const row: ModelScorecardRow = {
 *   modelId: 'hf:zai-org/GLM-5.2',
 *   attempts: 4,
 *   schemaOkRate: 0.75,
 *   refusalRate: 0.25,
 *   seededRecall: 0.5,
 *   resolvedClaimsPerAttempt: 2.5,
 *   unresolvedPerAttempt: 0.5,
 * };
 * ```
 */
export type ModelScorecardRow = {
  /**
   * Model graded by this row.
   */
  readonly modelId: SyntheticModelId;

  /**
   * Attempt count behind the rates.
   */
  readonly attempts: number;

  /**
   * Fraction of attempts ending `ok`.
   */
  readonly schemaOkRate: number;

  /**
   * Fraction of attempts ending refusal-shaped.
   */
  readonly refusalRate: number;

  /**
   * Seeds detected over seeds planted, refusals and failures counted
   * against the denominator: effective recall.
   */
  readonly seededRecall: number;

  /**
   * Mean validated claims per attempt.
   */
  readonly resolvedClaimsPerAttempt: number;

  /**
   * Mean resolution failures per attempt; high values mean sloppy quoting.
   */
  readonly unresolvedPerAttempt: number;
};

/**
 * Whole benchmark scorecard.
 *
 * @example
 * ```ts
 * const scorecard = computeScorecard({ attempts, },);
 * console.log(scorecard.ensembleRecall,);
 * ```
 */
export type BenchmarkScorecard = {
  /**
   * Per-model rows in first-attempt order.
   */
  readonly rows: readonly ModelScorecardRow[];

  /**
   * Distinct planted seeds across entries.
   */
  readonly seedUniverse: number;

  /**
   * Seeds any model detected over the seed universe:
   * the recall ceiling of the whole ensemble, the milestone go/no-go number.
   */
  readonly ensembleRecall: number;
};

/**
 * Counts bucket attempts ending in one outcome kind.
 *
 * @param bucket - one model's attempts
 *
 * @param kind - outcome under count
 *
 * @returns Matching attempt count
 *
 * @example
 * ```ts
 * countOutcomeKind({ bucket, kind: 'refusal-shaped', },);
 * ```
 */
function countOutcomeKind(
  {
    bucket,
    kind,
  }: {
    readonly bucket: readonly CriticAttemptRecord[];
    readonly kind: CriticAttemptOutcomeKind;
  },
): number {
  return bucket
    .filter(function matches(record,) {
      return record.outcomeKind === kind;
    },)
    .length;
}

/**
 * Sums one numeric aspect over a bucket.
 *
 * @param bucket - one model's attempts
 *
 * @param pick - aspect read from each record
 *
 * @returns Sum over the bucket
 *
 * @example
 * ```ts
 * sumOver({ bucket, pick: plantedCountOf, },);
 * ```
 */
function sumOver(
  {
    bucket,
    pick,
  }: {
    readonly bucket: readonly CriticAttemptRecord[];
    readonly pick: (record: CriticAttemptRecord,) => number;
  },
): number {
  return bucket.reduce(
    function add(
      sum,
      record,
    ) {
      return sum + pick(record,);
    },
    0,
  );
}

/**
 * Reads planted seed count off one record.
 *
 * @param record - graded attempt
 *
 * @returns Planted seed count
 *
 * @example
 * ```ts
 * plantedCountOf(record,);
 * ```
 */
function plantedCountOf(record: CriticAttemptRecord,): number {
  return record
    .plantedSeedIds
    .length;
}

/**
 * Reads detected seed count off one record.
 *
 * @param record - graded attempt
 *
 * @returns Detected seed count
 *
 * @example
 * ```ts
 * hitCountOf(record,);
 * ```
 */
function hitCountOf(record: CriticAttemptRecord,): number {
  return record
    .seededHitIds
    .length;
}

/**
 * Reads validated claim count off one record.
 *
 * @param record - graded attempt
 *
 * @returns Validated claim count
 *
 * @example
 * ```ts
 * claimCountOf(record,);
 * ```
 */
function claimCountOf(record: CriticAttemptRecord,): number {
  return record.resolvedClaimCount;
}

/**
 * Reads resolution failure count off one record.
 *
 * @param record - graded attempt
 *
 * @returns Resolution failure count
 *
 * @example
 * ```ts
 * unresolvedCountOf(record,);
 * ```
 */
function unresolvedCountOf(record: CriticAttemptRecord,): number {
  return record
    .unresolvedReasons
    .length;
}

/**
 * Aggregates attempts into the scorecard.
 *
 * @param attempts - graded critic attempts across models and entries
 *
 * @returns Per-model rows plus the ensemble recall ceiling
 *
 * @example
 * ```ts
 * const scorecard = computeScorecard({ attempts, },);
 * ```
 */
export function computeScorecard(
  { attempts, }: { readonly attempts: readonly CriticAttemptRecord[]; },
): BenchmarkScorecard {
  /**
   * Attempts grouped by model in first-attempt order.
   */
  const byModel = new Map<SyntheticModelId, CriticAttemptRecord[]>();
  for (const attempt of attempts) {
    /**
     * Bucket for this attempt's model, created on first sight.
     */
    const bucket = byModel.get(attempt.modelId,) ?? [];
    bucket.push(attempt,);
    byModel.set(
      attempt.modelId,
      bucket,
    );
  }

  /**
   * Per-model rows computed from each bucket.
   */
  const rows = [...byModel.entries(),].map(function toRow([modelId, bucket,],) {
    /**
     * Attempt count backing every rate in this row.
     */
    const attemptCount = bucket.length;

    /**
     * Seeds planted across this model's attempts.
     */
    const seededTotal = sumOver({
      bucket,
      pick: plantedCountOf,
    },);

    /**
     * Seeds this model detected.
     */
    const seededHits = sumOver({
      bucket,
      pick: hitCountOf,
    },);

    return {
      modelId,
      attempts: attemptCount,
      schemaOkRate: countOutcomeKind({
        bucket,
        kind: 'ok',
      },) / attemptCount,
      refusalRate: countOutcomeKind({
        bucket,
        kind: 'refusal-shaped',
      },) / attemptCount,
      seededRecall: seededTotal === 0
        ? 0
        : seededHits / seededTotal,
      resolvedClaimsPerAttempt: sumOver({
        bucket,
        pick: claimCountOf,
      },) / attemptCount,
      unresolvedPerAttempt: sumOver({
        bucket,
        pick: unresolvedCountOf,
      },) / attemptCount,
    };
  },);

  /**
   * Distinct planted seeds keyed by entry and seed id.
   */
  const seedUniverse = new Set(attempts.flatMap(function seedKeys(attempt,) {
    return attempt
      .plantedSeedIds
      .map(function toKey(seedId,) {
        return `${attempt.entryId}#${seedId}`;
      },);
  },),);

  /**
   * Seeds any model detected, keyed by entry and seed id.
   */
  const ensembleHits = new Set(attempts.flatMap(function hitKeys(attempt,) {
    return attempt
      .seededHitIds
      .map(function toKey(seedId,) {
        return `${attempt.entryId}#${seedId}`;
      },);
  },),);

  return {
    rows,
    seedUniverse: seedUniverse.size,
    ensembleRecall: seedUniverse.size === 0
      ? 0
      : ensembleHits.size / seedUniverse.size,
  };
}

//endregion Scorecard
