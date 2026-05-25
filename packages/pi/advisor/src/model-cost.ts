/**
 * Cost ranking for Advisor default model selection.
 *
 * @module
 */

import { estimateTokens, } from '@earendil-works/pi-coding-agent';
import type {
  DefaultModelSelection,
  EffectiveModelScope,
  ModelCostScore,
  ScopedAdvisorModel,
} from './types.ts';

//region Public API

/** Options for estimating Advisor request input tokens. */
export type EstimateAdvisorTokensOptions = {
  /** Advisor model system prompt. */
  readonly systemPrompt: string;
  /** Serialized conversation context. */
  readonly contextText: string;
};

/** Options for default model selection. */
export type SelectDefaultModelOptions = {
  /** Effective scoped model set. */
  readonly scope: EffectiveModelScope;
  /** Estimated input tokens for this Advisor request. */
  readonly estimatedInputTokens: number;
  /** Maximum output tokens requested from Advisor. */
  readonly maxAdvisorOutputTokens: number;
};

/** Read-only lookup interface for slug→tokens mapping. */
type ReadonlySlugTokensMap = {
  /** Look up the estimated input-token count for a canonical model slug. */
  readonly get: (slug: string) => number | undefined;
};

/** Options for default model selection with per-model context estimates. */
export type SelectDefaultModelFromContextEstimatesOptions = {
  /** Effective scoped model set. */
  readonly scope: EffectiveModelScope;
  /** Estimated input tokens keyed by canonical scoped model slug. */
  readonly estimatedInputTokensBySlug: ReadonlySlugTokensMap;
  /** Maximum output tokens requested from Advisor. */
  readonly maxAdvisorOutputTokens: number;
};

/**
 * Estimate Advisor request input tokens using pi's message token estimator.
 *
 * @param options - system prompt and serialized conversation
 *
 * @returns estimated token count
 *
 * @example
 * ```typescript
 * estimateAdvisorInputTokens({ systemPrompt, contextText });
 * ```
 */
export function estimateAdvisorInputTokens(
  options: EstimateAdvisorTokensOptions,
): number {
  /** Synthetic user message matching the secondary Advisor request shape. */
  const message: Parameters<typeof estimateTokens>[0] = {
    role: 'user',
    content: `${options.systemPrompt}\n\n${options.contextText}`,
    timestamp: 0,
  };
  return estimateTokens(message,);
}

/**
 * Select the most expensive scoped model by expected Advisor call cost.
 *
 * @param options - scope and request-size inputs
 *
 * @returns selected model and sorted cost ranking
 *
 * @throws when scope is empty
 *
 * @example
 * ```typescript
 * selectDefaultModel({ scope, estimatedInputTokens: 1000, maxAdvisorOutputTokens: 4096 });
 * ```
 */
export function selectDefaultModel(
  options: SelectDefaultModelOptions,
): DefaultModelSelection {
  /** Shared token estimate applied to every scoped model. */
  const estimatedInputTokensBySlug = new Map(
    options
      .scope
      .entries
      .map(function mapEntry(entry,) {
      return [
        entry.canonicalSlug,
        options.estimatedInputTokens,
      ] as const;
    },),
  );
  return selectDefaultModelFromContextEstimates({
    scope: options.scope,
    estimatedInputTokensBySlug,
    maxAdvisorOutputTokens: options.maxAdvisorOutputTokens,
  },);
}

/**
 * Select most expensive scoped model using each candidate's context estimate.
 *
 * @param options - scope and per-candidate request-size inputs
 *
 * @returns selected model and sorted cost ranking
 *
 * @throws when scope is empty or a candidate has no estimate
 *
 * @example
 * ```typescript
 * selectDefaultModelFromContextEstimates({ scope, estimatedInputTokensBySlug, maxAdvisorOutputTokens });
 * ```
 */
export function selectDefaultModelFromContextEstimates(
  options: SelectDefaultModelFromContextEstimatesOptions,
): DefaultModelSelection {
  if (options
    .scope
    .entries
    .length
    === 0)
    throw new Error('advisor: no scoped models with configured auth',);

  /** Sorted scores, highest expected cost first. */
  const ranking = options
    .scope
    .entries
    .map(function scoreEntry(entry,) {
      /** Input-token estimate for this scoped model's effective context budget. */
      const estimatedInputTokens = options.estimatedInputTokensBySlug
        .get(
        entry.canonicalSlug,
      );
      if (estimatedInputTokens === undefined) {
        throw new Error(
          `advisor: missing input-token estimate for ${entry.canonicalSlug}`,
        );
      }
      return scoreModel({
        entry,
        estimatedInputTokens,
        maxAdvisorOutputTokens: options.maxAdvisorOutputTokens,
      },);
    },)
    .toSorted(function compareScoreCallback(
      left: ModelCostScore,
      right: ModelCostScore,
    ) {
      return compareScores({
        left,
        right,
      },);
    },);

  /** Top-ranked score. */
  const [topScore,] = ranking;
  if (topScore === undefined)
    throw new Error('advisor: default selection failed for empty ranking',);

  /** Matching scoped entry for the top score. */
  const selected = options
    .scope
    .entries
    .find(function matchesTopScore(entry,) {
    return entry.canonicalSlug
      === topScore
      .slug;
  },);
  if (selected === undefined)
    throw new Error(`advisor: selected model ${topScore.slug} disappeared from scope`,);

  return {
    selected,
    ranking,
    reason: buildSelectionReason({ score: topScore, },),
  };
}

//endregion Public API

//region Internal helpers

/**
 * Score a single scoped model for expected request cost.
 *
 * @param entry - scoped Advisor model
 *
 * @param estimatedInputTokens - estimated request input tokens
 *
 * @param maxAdvisorOutputTokens - requested output token budget
 *
 * @returns cost score for ranking
 */
function scoreModel(
  {
    entry,
    estimatedInputTokens,
    maxAdvisorOutputTokens,
  }: {
    readonly entry: ScopedAdvisorModel;
    readonly estimatedInputTokens: number;
    readonly maxAdvisorOutputTokens: number;
  },
): ModelCostScore {
  /** Input-token price from model metadata. */
  const inputCost = entry
    .model
    .cost
    .input;
  /** Output-token price from model metadata. */
  const outputCost = entry
    .model
    .cost
    .output;
  /** Expected request cost ignoring cache pricing. */
  const expectedCost = (estimatedInputTokens * inputCost)
    + (maxAdvisorOutputTokens * outputCost);

  return {
    slug: entry.canonicalSlug,
    inputTokens: estimatedInputTokens,
    maxOutputTokens: maxAdvisorOutputTokens,
    expectedCost,
    inputCost,
    outputCost,
    contextWindow: entry.model
      .contextWindow,
  };
}

/**
 * Compare scores using Advisor's deterministic tie-break order.
 *
 * @param left - first score
 *
 * @param right - second score
 *
 * @returns negative when left ranks before right
 */
function compareScores(
  {
    left,
    right,
  }: {
    readonly left: ModelCostScore;
    readonly right: ModelCostScore;
  },
): number {
  if (right.expectedCost
    !== left
    .expectedCost)
    return right.expectedCost
      - left
      .expectedCost;
  if (right.outputCost
    !== left
    .outputCost)
    return right.outputCost
      - left
      .outputCost;
  if (right.inputCost
    !== left
    .inputCost)
    return right.inputCost
      - left
      .inputCost;
  if (right.contextWindow
    !== left
    .contextWindow)
    return right.contextWindow
      - left
      .contextWindow;
  return left.slug
    .localeCompare(right.slug,);
}

/**
 * Build a concise human-readable default selection reason.
 *
 * @param score - winning cost score
 *
 * @returns human-readable selection reason
 */
function buildSelectionReason(
  {
    score,
  }: {
    readonly score: ModelCostScore;
  },
): string {
  return [
    `highest expected cost: ${score.slug} =`,
    `${score.inputTokens} input tokens * ${score.inputCost} +`,
    `${score.maxOutputTokens} output tokens * ${score.outputCost}`,
  ]
    .join(' ',);
}

//endregion Internal helpers
