/**
 * Advisor model selection paired with model-budgeted serialized context.
 *
 * @module
 */

import type {
  ModelRegistry,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import {
  buildAdvisorContext,
  maxContextCharsForAdvisorModel,
} from './context.ts';
import { resolveRequestedModel, } from '@monochromatic-dev/pi-shared-model-selection/core';
import { selectDefaultModelFromContextEstimates, } from '@monochromatic-dev/pi-shared-model-selection/cost';
import type {
  AdvisorConfig,
  AdvisorContext,
  AdvisorModelSelection,
  EffectiveModelScope,
  ScopedAdvisorModel,
} from './types.ts';

//region Types

/** Selected model paired with serialized context built for that model. */
export type AdvisorSelectionContext = {
  /** Advisor model selection. */
  readonly selection: AdvisorModelSelection;
  /** Serialized context using selected model budget. */
  readonly advisorContext: AdvisorContext;
};

/** Options for selecting model and model-budgeted context together. */
export type SelectAdvisorRunContextOptions = {
  /** Session branch entries from pi. */
  readonly branch: readonly SessionEntry[];
  /** Runtime Advisor configuration. */
  readonly config: AdvisorConfig;
  /** Advisor model system prompt. */
  readonly advisorSystemPrompt: string;
  /** Effective scoped model set. */
  readonly scope: EffectiveModelScope;
  /** Global model registry for explicit slug validation. */
  readonly modelRegistry: ReadonlyDeep<ModelRegistry>;
  /** Optional user-requested model slug. */
  readonly requestedSlug?: string;
  /** Current Advisor tool call id to omit. */
  readonly toolCallId?: string;
};

/** Options for building context for one scoped Advisor model. */
type BuildContextForScopedModelOptions = {
  /** Session branch entries from pi. */
  readonly branch: readonly SessionEntry[];
  /** Runtime Advisor configuration. */
  readonly config: AdvisorConfig;
  /** Advisor model system prompt. */
  readonly advisorSystemPrompt: string;
  /** Scoped Advisor model. */
  readonly scopedModel: ScopedAdvisorModel;
  /** Current Advisor tool call id to omit. */
  readonly toolCallId?: string;
};

/** Context candidate for a scoped Advisor model. */
type AdvisorContextCandidate = {
  /** Scoped Advisor model. */
  readonly scopedModel: ScopedAdvisorModel;
  /** Serialized context using scoped model budget. */
  readonly advisorContext: AdvisorContext;
};

//endregion Types

//region Public API

/**
 * Select Advisor model and build context with that model's context budget.
 *
 * @param options - branch, config, scope, and model-selection inputs
 *
 * @returns selected model and serialized context
 *
 * @example
 * ```typescript
 * const selectionContext = selectAdvisorRunContext({ branch, config, advisorSystemPrompt, scope, modelRegistry });
 * ```
 */
export function selectAdvisorRunContext(
  options: SelectAdvisorRunContextOptions,
): AdvisorSelectionContext {
  if (options.requestedSlug
    !== undefined) {
    /** Explicit Advisor model selection. */
    const selection = resolveRequestedModel({
      scope: options.scope,
      requestedSlug: options.requestedSlug,
      modelRegistry: options.modelRegistry,
      errorPrefix: 'advisor',
    },);
    return {
      selection,
      advisorContext: buildContextForScopedModel({
        branch: options.branch,
        config: options.config,
        advisorSystemPrompt: options.advisorSystemPrompt,
        scopedModel: selection.selected,
        ...(options.toolCallId
          === undefined ? {} : { toolCallId: options.toolCallId, }),
      },),
    };
  }

  /** Context candidates using each scoped model's effective context budget. */
  const candidates = options
    .scope
    .entries
    .map(function mapScopedModel(scopedModel,) {
    return {
      scopedModel,
      advisorContext: buildContextForScopedModel({
        branch: options.branch,
        config: options.config,
        advisorSystemPrompt: options.advisorSystemPrompt,
        scopedModel,
        ...(options.toolCallId
          === undefined ? {} : { toolCallId: options.toolCallId, }),
      },),
    } satisfies AdvisorContextCandidate;
  },);
  /** Input token estimates keyed by canonical scoped model slug. */
  const estimatedInputTokensBySlug = new Map(
    candidates.map(function mapCandidate(candidate,) {
      return [
        candidate.scopedModel
          .canonicalSlug,
        candidate.advisorContext
          .estimatedInputTokens,
      ] as const;
    },),
  );
  /** Default Advisor model selection using each candidate's own estimate. */
  const defaultSelection = selectDefaultModelFromContextEstimates({
    scope: options.scope,
    estimatedInputTokensBySlug,
    maxOutputTokens: options.config
      .maxAdvisorOutputTokens,
  },);
  /** Context candidate matching selected default model. */
  const selectedCandidate = candidates.find(function matchesSelection(candidate,) {
    return candidate.scopedModel
      .canonicalSlug
      === defaultSelection
      .selected
      .canonicalSlug;
  },);
  if (selectedCandidate === undefined) {
    throw new Error(
      `advisor: selected model ${defaultSelection.selected
        .canonicalSlug} context disappeared`,
    );
  }
  return {
    selection: {
      selected: defaultSelection.selected,
      defaultSelection,
    },
    advisorContext: selectedCandidate.advisorContext,
  };
}

//endregion Public API

//region Internal helpers

/**
 * Build serialized Advisor context for one scoped model.
 *
 * @param options - branch, config, prompt, scoped model, and current tool call
 *
 * @returns serialized context truncated for scoped model
 */
function buildContextForScopedModel(
  options: BuildContextForScopedModelOptions,
): AdvisorContext {
  /** Effective serialized-context character budget for selected model. */
  const maxContextChars = maxContextCharsForAdvisorModel({
    config: options.config,
    model: options.scopedModel
      .model,
    advisorSystemPrompt: options.advisorSystemPrompt,
  },);
  return buildAdvisorContext({
    branch: options.branch,
    config: options.config,
    advisorSystemPrompt: options.advisorSystemPrompt,
    maxContextChars,
    ...(options.toolCallId
      === undefined ? {} : { toolCallId: options.toolCallId, }),
  },);
}

//endregion Internal helpers
