/**
 * Advisor model selection helper.
 *
 * @module
 */

import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { selectDefaultModel, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { resolveAdvisorRequestedModel, } from './advisor-requested-model.ts';
import {
  assertAdvisorModelOutputCapacity,
  requireAdvisorScopeWithOutputCapacity,
} from './output-eligibility.ts';
import type {
  AdvisorConfig,
  AdvisorModelSelection,
  EffectiveModelScope,
} from './types.ts';

//region Types

/**
 * Current primary model identity used to keep Advisor independent by default.
 */
export type CurrentMainModelIdentity = Pick<AdvisorModelSelection['selected']['model'], 'provider' | 'id'>;

//endregion Types

//region Public API

/**
 * Select explicit model or default highest expected-cost non-current model.
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
 * @param currentMainModel - active primary model to avoid for default selection when possible
 *
 * @returns selected Advisor model
 *
 *
 * @example
 * ```typescript
 * selectAdvisorModel({ scope, config, estimatedInputTokens, modelRegistry, currentMainModel });
 * ```
 */
export function selectAdvisorModel(
  {
    scope,
    requestedSlug,
    config,
    estimatedInputTokens,
    modelRegistry,
    currentMainModel,
  }: ForeignBorrowed<Readonly<{
    scope: ReadonlyDeep<EffectiveModelScope>;
    requestedSlug?: string;
    config: AdvisorConfig;
    estimatedInputTokens: number;
    modelRegistry: ModelRegistry;
    currentMainModel?: CurrentMainModelIdentity;
  }>>,
): AdvisorModelSelection {
  if ((requestedSlug !== undefined) && (requestedSlug.trim()
    !== '')) {
    /**
     * Explicit model resolved against authenticated scope before output eligibility validation.
     */
    const selection = resolveAdvisorRequestedModel({
      scope,
      requestedSlug,
      modelRegistry,
    },);
    assertAdvisorModelOutputCapacity({
      selection,
      maxAdvisorOutputTokens: config.maxAdvisorOutputTokens,
    },);
    return selection;
  }

  /**
   * Scoped models whose endpoints advertise configured output capacity.
   */
  const eligibleScope = requireAdvisorScopeWithOutputCapacity({
    scope,
    maxAdvisorOutputTokens: config.maxAdvisorOutputTokens,
  },);
  /**
   * Default-selection scope with current main model removed when alternatives exist.
   */
  const defaultScope = scopeAvoidingCurrentMainModel({
    scope: eligibleScope,
    ...(currentMainModel
      === undefined ? {} : { currentMainModel, }),
  },);
  /**
   * Default model selection for empty params.
   */
  const defaultSelection = selectDefaultModel({
    scope: defaultScope,
    estimatedInputTokens,
    maxOutputTokens: config.maxAdvisorOutputTokens,
  },);
  return {
    selected: defaultSelection.selected,
    defaultSelection,
  };
}

/**
 * Return scope entries excluding current main model when at least one alternative remains.
 *
 * @param scope - effective scoped model set
 *
 * @param currentMainModel - active primary model to avoid for default Advisor selection
 *
 * @returns original scope or same metadata with current main model omitted
 *
 * @example
 * ```typescript
 * scopeAvoidingCurrentMainModel({ scope, currentMainModel });
 * ```
 */
export function scopeAvoidingCurrentMainModel(
  {
    scope,
    currentMainModel,
  }: ReadonlyDeep<{
    readonly scope: EffectiveModelScope;
    readonly currentMainModel?: CurrentMainModelIdentity;
  }>,
): EffectiveModelScope {
  if (currentMainModel === undefined)
    return scope;

  /**
   * Canonical slug for active primary model.
   */
  const currentMainModelSlug = `${currentMainModel.provider}/${currentMainModel.id}`;
  /**
   * Scoped entries that differ from active primary model.
   */
  const alternativeEntries: EffectiveModelScope['entries'][number][] = [];
  for (const entry of scope.entries) {
    if (entry.canonicalSlug
      !== currentMainModelSlug)
      alternativeEntries[alternativeEntries.length] = entry;
  }

  /**
   * Count of non-current default candidates.
   */
  const alternativeEntryCount = alternativeEntries.length;
  /**
   * Whether no non-current default candidate exists.
   */
  const noAlternativeEntries = alternativeEntryCount === 0;
  /**
   * Original scoped entries before default-candidate filtering.
   */
  const { entries: scopedEntries, } = scope;
  /**
   * Count of original scoped entries.
   */
  const scopedEntryCount = scopedEntries.length;
  /**
   * Whether active primary model was absent from scope.
   */
  const currentMainModelAbsentFromScope = alternativeEntryCount === scopedEntryCount;
  if (noAlternativeEntries || currentMainModelAbsentFromScope)
    return scope;

  return {
    ...scope,
    entries: alternativeEntries,
  };
}

//endregion Public API
