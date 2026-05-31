/**
 * Advisor model selection helper.
 *
 * @module
 */

import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import {
  resolveRequestedModel,
  selectDefaultModel,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
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
    readonly scope: EffectiveModelScope;
    readonly requestedSlug?: string;
    readonly config: AdvisorConfig;
    readonly estimatedInputTokens: number;
    readonly modelRegistry: ReadonlyDeep<ModelRegistry>;
  },
): AdvisorModelSelection {
  if ((requestedSlug !== undefined) && (requestedSlug.trim()
    !== '')) {
    return resolveRequestedModel({
      scope,
      requestedSlug,
      modelRegistry,
      errorPrefix: 'advisor',
    },);
  }

  /**
   * Default model selection for empty params.
   */
  const defaultSelection = selectDefaultModel({
    scope,
    estimatedInputTokens,
    maxOutputTokens: config.maxAdvisorOutputTokens,
  },);
  return {
    selected: defaultSelection.selected,
    defaultSelection,
  };
}

//endregion Public API
