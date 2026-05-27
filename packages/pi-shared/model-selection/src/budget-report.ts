/**
 * Budget-model candidate reporting and failure error type.
 *
 * @module
 */

import type {
  BudgetModelCandidate,
  ModelIdentity,
  ModelPricing,
} from './types.ts';

//region Error class

/**
 * Error thrown when no suitable budget model can be found.
 *
 * Includes the best candidates from the active provider and across all
 * providers for custom fallback logic.
 *
 * @example
 * ```typescript
 * throw new NoBudgetModelError('no active model set');
 * ```
 */
export class NoBudgetModelError extends Error {
  /** Why no budget model was found. */
  readonly reason: string;
  /** Best candidate from same provider, when one was found. */
  readonly sameProvider?: BudgetModelCandidate;
  /** Cheapest candidate across all providers, when one was found. */
  readonly cheapestOverall?: BudgetModelCandidate;

  /**
   * Construct a NoBudgetModelError.
   *
   * @param reason - why no budget model was found
   *
   * @param candidates - optional context about candidates found
   */
  constructor(
    reason: string,
    candidates: {
      readonly sameProvider?: BudgetModelCandidate;
      readonly cheapestOverall?: BudgetModelCandidate;
    } = {},
  ) {
    /** Per-line accumulator for multi-line error message. */
    const lines = [
      "Tried to auto-detect a budget model for a background task, but couldn't find one.",
      `Reason: ${reason}`,
    ];
    if (candidates.sameProvider
      !== undefined) {
      /** Local alias so template strings stay readable. */
      const candidate = candidates.sameProvider;
      lines.push(
        `Best same-provider option: ${candidate.provider}/${candidate.modelId} ($${candidate.costInput}/$${candidate.costOutput} per M tokens)`,
      );
    }
    /** Cheapest-overall candidate, surfaced only when present with an API key. */
    const cheapest = candidates.cheapestOverall;
    if (cheapest?.hasApiKey
      === true) {
      lines.push(
        `Cheapest with API key: ${cheapest.provider}/${cheapest.modelId} ($${cheapest.costInput}/$${cheapest.costOutput} per M tokens)`,
      );
    }
    lines.push(
      'To fix: configure a model explicitly in the extension settings, or switch to a provider with cheaper models.',
    );

    super(lines.join('\n',),);
    this.name = 'NoBudgetModelError';
    this.reason = reason;
    if (candidates.sameProvider
      !== undefined)
      this.sameProvider = candidates.sameProvider;
    if (candidates.cheapestOverall
      !== undefined)
      this.cheapestOverall = candidates.cheapestOverall;
  }
}

//endregion Error class

//region Candidate helpers

/**
 * Build budget-model candidate metadata from a model.
 *
 * @param model - model to report
 *
 * @param hasConfiguredAuth - whether host registry reports usable auth
 *
 * @returns model candidate metadata
 *
 * @example
 * ```typescript
 * toBudgetModelCandidate({ model, hasConfiguredAuth: true });
 * ```
 */
export function toBudgetModelCandidate(
  {
    model,
    hasConfiguredAuth,
  }: {
    readonly model: ModelPricing;
    readonly hasConfiguredAuth: boolean;
  },
): BudgetModelCandidate {
  return {
    provider: model.provider,
    modelId: model.id,
    costInput: model.cost
      .input,
    costOutput: model.cost
      .output,
    hasApiKey: hasConfiguredAuth,
  };
}

/**
 * Return canonical provider/model slug for a model identity.
 *
 * @param model - model identity
 *
 * @returns provider/model slug
 *
 * @example
 * ```typescript
 * budgetModelSlug(model);
 * ```
 */
export function budgetModelSlug(
  model: ModelIdentity,
): string {
  return `${model.provider}/${model.id}`;
}

//endregion Candidate helpers
