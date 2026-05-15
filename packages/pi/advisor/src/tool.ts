/**
 * Advisor tool registration and execution.
 *
 * @module
 */

import {
  completeAdvisor,
  extractAdvisorText,
  buildAdvisorSystemPrompt,
} from './advisor-client.ts';
import { ADVISOR_TOOL_NAME, } from './constants.ts';
import { selectAdvisorModel, } from './advisor-selection.ts';
import { buildAdvisorContext, } from './context.ts';
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
  AdvisorRunOptions,
  AdvisorRunResult,
  AdvisorToolDefinition,
  AdvisorToolResult,
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
      if (!toolOptions.getSessionEnabled())
        throw new Error('advisor: disabled for this session. Run /advisor on to re-enable.',);

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
  /** Serialized conversation context. */
  const advisorContext = buildAdvisorContext({
    branch: options.ctx.sessionManager.getBranch(),
    config: options.config,
    advisorSystemPrompt,
    ...(options.toolCallId === undefined ? {} : { toolCallId: options.toolCallId, }),
  },);
  /** Selected Advisor model. */
  const selection = selectAdvisorModel({
    scope,
    ...(options.requestedSlug === undefined ? {} : { requestedSlug: options.requestedSlug, }),
    config: options.config,
    estimatedInputTokens: advisorContext.estimatedInputTokens,
    modelRegistry: options.ctx.modelRegistry,
  },);

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
      ...(selection.requestedSlug === undefined ? {} : { requestedSlug: selection.requestedSlug, }),
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
