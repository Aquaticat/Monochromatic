/**
 * Advisor model selection helper.
 *
 * @module
 */

import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import { selectDefaultModel, } from './model-cost.ts';
import { resolveRequestedModel, } from './model-slug.ts';
import type {
  AdvisorConfig,
  AdvisorModelSelection,
  EffectiveModelScope,
} from './types.ts';

//region Public API

/**
 * Select explicit model or default highest expected-cost model.
 *
 * @param scope - effective scoped model set
 *
 * @param requestedSlug - optional requested model slug
 *
 * @param config - runtime Advisor config
 *
 * @param estimatedInputTokens - estimated Advisor input tokens
 *
 * @param modelRegistry - pi model registry
 *
 * @returns selected Advisor model
 *
 * @example
 * ```typescript
 * selectAdvisorModel({ scope, config, estimatedInputTokens, modelRegistry });
 * ```
 */
export function selectAdvisorModel(
  {
    scope,
    requestedSlug,
    config,
    estimatedInputTokens,
    modelRegistry,
  }: {
    scope: EffectiveModelScope;
    requestedSlug?: string;
    config: AdvisorConfig;
    estimatedInputTokens: number;
    modelRegistry: ModelRegistry;
  },
): AdvisorModelSelection {
  if ((requestedSlug !== undefined) && (requestedSlug.trim() !== '')) {
    return resolveRequestedModel({
      scope,
      requestedSlug,
      modelRegistry,
    },);
  }

  /** Default model selection for empty params. */
  const defaultSelection = selectDefaultModel({
    scope,
    estimatedInputTokens,
    maxAdvisorOutputTokens: config.maxAdvisorOutputTokens,
  },);
  return {
    selected: defaultSelection.selected,
    defaultSelection,
  };
}

//endregion Public API
