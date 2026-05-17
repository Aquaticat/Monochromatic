/**
 * Advisor tool registration and execution.
 *
 * @module
 */

import type {
  ModelRegistry,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  buildAdvisorSystemPrompt,
  completeAdvisor,
  extractAdvisorText,
} from './advisor-client.ts';
import { ADVISOR_TOOL_NAME, } from './constants.ts';
import {
  buildAdvisorContext,
  maxContextCharsForAdvisorModel,
} from './context.ts';
import { selectDefaultModelFromContextEstimates, } from './model-cost.ts';
import { resolveRequestedModel, } from './model-slug.ts';
import {
  renderAdvisorCall,
  renderAdvisorResult,
} from './rendering.ts';
import { resolveEffectiveScope, } from './scope-resolver.ts';
import {
  AdvisorToolParametersSchema,
  prepareAdvisorArguments,
} from './tool-params.ts';
import type {
  AdvisorConfig,
  AdvisorContext,
  AdvisorModelSelection,
  AdvisorRunOptions,
  AdvisorRunResult,
  AdvisorToolDefinition,
  AdvisorToolResult,
  EffectiveModelScope,
  ScopedAdvisorModel,
} from './types.ts';

//region Public API

/** Options for creating the registered Advisor tool. */
export type CreateAdvisorToolOptions = {
  /** Return current runtime config. */
  getConfig: () => AdvisorConfig;
  /** Return current session enablement. */
  getSessionEnabled: () => boolean;
};

/**
 * Create the Advisor tool definition.
 *
 * @param toolOptions - runtime state accessors
 *
 * @returns pi tool definition
 *
 * @example
 * ```typescript
 * pi.registerTool(createAdvisorTool({ getConfig, getSessionEnabled }));
 * ```
 */
export function createAdvisorTool(
  toolOptions: CreateAdvisorToolOptions,
): AdvisorToolDefinition<typeof AdvisorToolParametersSchema> {
  return {
    name: ADVISOR_TOOL_NAME,
    label: 'Advisor',
    description:
      'Consult an independent advisor model using the current conversation context. Empty params select the highest expected-cost model inside the current scoped model set. The optional model must be a scoped model slug.',
    promptSnippet:
      'Consult an independent advisor model. Use advisor({}) for default scoped model, or advisor({ "model": "provider/model" }) for a specific scoped model.',
    promptGuidelines: [
      'Advisor receives the conversation context automatically and returns review feedback as a tool result.',
      'Call advisor when a secondary review can catch flawed assumptions, missing verification, risky changes, or overlooked files.',
      'Do not request models outside the scoped model set; out-of-scope slugs fail and list allowed slugs.',
    ],
    parameters: AdvisorToolParametersSchema,
    executionMode: 'sequential',
    prepareArguments: prepareAdvisorArguments,
    execute: async function executeAdvisorTool(
      toolCallId,
      params,
      signal,
      _onUpdate,
      ctx,
    ): Promise<AdvisorToolResult> {
      if (!toolOptions.getSessionEnabled()) {
        throw new Error(
          'advisor: disabled for this session. Run /advisor on to re-enable.',
        );
      }

      /** Runtime config snapshot for this call. */
      const config = toolOptions.getConfig();
      /** Advisor run result. */
      const result = await runAdvisor({
        ctx,
        config,
        ...(params.model === undefined ? {} : { requestedSlug: params.model, }),
        toolCallId,
        ...(signal === undefined ? {} : { signal, }),
      },);

      if (result.details.stopReason === 'aborted')
        throw new Error('advisor: advisor call was aborted',);

      return {
        content: [{
          type: 'text',
          text: result.text,
        },],
        details: result.details,
      };
    },
    renderCall: function renderCall(
      args,
      theme,
      _context,
    ) {
      return renderAdvisorCall({
        args,
        theme,
      },);
    },
    renderResult: function renderResult(
      result,
      renderOptions,
      theme,
      _context,
    ) {
      return renderAdvisorResult({
        result,
        expanded: renderOptions.expanded,
        theme,
      },);
    },
  };
}

/**
 * Execute an Advisor review for tool or command mode.
 *
 * @param options - runtime call options
 *
 * @returns advisor text and details
 *
 * @example
 * ```typescript
 * const result = await runAdvisor({ ctx, config });
 * ```
 */
export async function runAdvisor(
  options: AdvisorRunOptions,
): Promise<AdvisorRunResult> {
  /** Start time for duration metadata. */
  const startedAt = Date.now();
  /** Effective scoped model set. */
  const scope = resolveEffectiveScope({ ctx: options.ctx, },);
  if (scope.entries.length === 0) {
    throw new Error(
      'advisor: no scoped models with configured auth. Check --models, enabledModels, /scoped-models, or provider login.',
    );
  }

  /** Advisor model system prompt. */
  const advisorSystemPrompt = buildAdvisorSystemPrompt(options.config,);
  /** Selected Advisor model and model-budgeted serialized context. */
  const selectionContext = selectAdvisorRunContext({
    branch: options.ctx.sessionManager.getBranch(),
    config: options.config,
    advisorSystemPrompt,
    scope,
    modelRegistry: options.ctx.modelRegistry,
    ...(options.requestedSlug === undefined
      ? {}
      : { requestedSlug: options.requestedSlug, }),
    ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId, }),
  },);
  /** Selected Advisor model and serialized conversation context. */
  const {
    selection,
    advisorContext,
  } = selectionContext;

  /** Provider response from selected secondary model. */
  const response = await completeAdvisor({
    ctx: options.ctx,
    model: selection.selected.model,
    config: options.config,
    advisorContext,
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
  },);
  /** Extracted advisor text. */
  const text = extractAdvisorText(response,) || '(advisor returned no text)';

  return {
    text,
    details: {
      ...(selection.requestedSlug === undefined
        ? {}
        : { requestedSlug: selection.requestedSlug, }),
      selectedSlug: selection.selected.canonicalSlug,
      provider: selection.selected.model.provider,
      scopeSource: scope.source,
      scopedSlugs: scope.entries.map(function mapEntry(entry,) {
        return entry.canonicalSlug;
      },),
      ...(selection.defaultSelection?.reason === undefined
        ? {}
        : { defaultSelectionReason: selection.defaultSelection.reason, }),
      durationMs: Date.now() - startedAt,
      contextBudgetChars: advisorContext.maxContextChars,
      contextChars: advisorContext.finalChars,
      estimatedInputTokens: advisorContext.estimatedInputTokens,
      truncated: advisorContext.truncated,
      stopReason: response.stopReason,
      usage: response.usage,
      ...(selection.defaultSelection?.ranking === undefined
        ? {}
        : { costRanking: selection.defaultSelection.ranking, }),
    },
  };
}

//endregion Public API

//region Context selection

/** Selected model paired with serialized context built for that model. */
type AdvisorSelectionContext = {
  /** Advisor model selection. */
  selection: AdvisorModelSelection;
  /** Serialized context using selected model budget. */
  advisorContext: AdvisorContext;
};

/** Options for selecting model and model-budgeted context together. */
type SelectAdvisorRunContextOptions = {
  /** Session branch entries from pi. */
  branch: readonly SessionEntry[];
  /** Runtime Advisor configuration. */
  config: AdvisorConfig;
  /** Advisor model system prompt. */
  advisorSystemPrompt: string;
  /** Effective scoped model set. */
  scope: EffectiveModelScope;
  /** Global model registry for explicit slug validation. */
  modelRegistry: ModelRegistry;
  /** Optional user-requested model slug. */
  requestedSlug?: string;
  /** Current Advisor tool call id to omit. */
  toolCallId?: string;
};

/** Options for building context for one scoped Advisor model. */
type BuildContextForScopedModelOptions = {
  /** Session branch entries from pi. */
  branch: readonly SessionEntry[];
  /** Runtime Advisor configuration. */
  config: AdvisorConfig;
  /** Advisor model system prompt. */
  advisorSystemPrompt: string;
  /** Scoped Advisor model. */
  scopedModel: ScopedAdvisorModel;
  /** Current Advisor tool call id to omit. */
  toolCallId?: string;
};

/** Context candidate for a scoped Advisor model. */
type AdvisorContextCandidate = {
  /** Scoped Advisor model. */
  scopedModel: ScopedAdvisorModel;
  /** Serialized context using scoped model budget. */
  advisorContext: AdvisorContext;
};

/**
 * Select Advisor model and build context with that model's context budget.
 *
 * @param options - branch, config, scope, and model-selection inputs
 *
 * @returns selected model and serialized context
 */
function selectAdvisorRunContext(
  options: SelectAdvisorRunContextOptions,
): AdvisorSelectionContext {
  if (options.requestedSlug !== undefined) {
    /** Explicit Advisor model selection. */
    const selection = resolveRequestedModel({
      scope: options.scope,
      requestedSlug: options.requestedSlug,
      modelRegistry: options.modelRegistry,
    },);
    return {
      selection,
      advisorContext: buildContextForScopedModel({
        branch: options.branch,
        config: options.config,
        advisorSystemPrompt: options.advisorSystemPrompt,
        scopedModel: selection.selected,
        ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId, }),
      },),
    };
  }

  /** Context candidates using each scoped model's effective context budget. */
  const candidates = options.scope.entries.map(function mapScopedModel(scopedModel,) {
    return {
      scopedModel,
      advisorContext: buildContextForScopedModel({
        branch: options.branch,
        config: options.config,
        advisorSystemPrompt: options.advisorSystemPrompt,
        scopedModel,
        ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId, }),
      },),
    } satisfies AdvisorContextCandidate;
  },);
  /** Input token estimates keyed by canonical scoped model slug. */
  const estimatedInputTokensBySlug = new Map(
    candidates.map(function mapCandidate(candidate,) {
      return [
        candidate.scopedModel.canonicalSlug,
        candidate.advisorContext.estimatedInputTokens,
      ] as const;
    },),
  );
  /** Default Advisor model selection using each candidate's own estimate. */
  const defaultSelection = selectDefaultModelFromContextEstimates({
    scope: options.scope,
    estimatedInputTokensBySlug,
    maxAdvisorOutputTokens: options.config.maxAdvisorOutputTokens,
  },);
  /** Context candidate matching selected default model. */
  const selectedCandidate = candidates.find(function matchesSelection(candidate,) {
    return candidate.scopedModel.canonicalSlug
      === defaultSelection.selected.canonicalSlug;
  },);
  if (selectedCandidate === undefined) {
    throw new Error(
      `advisor: selected model ${defaultSelection.selected.canonicalSlug} context disappeared`,
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
    model: options.scopedModel.model,
    advisorSystemPrompt: options.advisorSystemPrompt,
  },);
  return buildAdvisorContext({
    branch: options.branch,
    config: options.config,
    advisorSystemPrompt: options.advisorSystemPrompt,
    maxContextChars,
    ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId, }),
  },);
}

//endregion Context selection
