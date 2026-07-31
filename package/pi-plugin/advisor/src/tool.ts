/**
 * Advisor tool registration and execution.
 *
 * @module
 */

import type {
  AgentToolResult,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  buildAdvisorSystemPrompt,
  completeAdvisor,
  extractAdvisorText,
} from './advisor-client.ts';
import { ADVISOR_TOOL_NAME, } from './constants.ts';
import {
  renderAdvisorCall,
  renderAdvisorResult,
} from './rendering.ts';
import { resolveEffectiveScope, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import { selectAdvisorRunContext, } from './tool-context-selection.ts';
import {
  AdvisorToolParametersSchema,
  prepareAdvisorArguments,
} from './tool-params.ts';
import type {
  AdvisorConfig,
  AdvisorDetails,
  AdvisorRunOptions,
  AdvisorRunResult,
  AdvisorToolDefinition,
  AdvisorToolResult,
} from './types.ts';

//region Public API

/**
 * Options for creating the registered Advisor tool.
 */
export type CreateAdvisorToolOptions = {
  /**
   * Return current runtime config.
   */
  readonly getConfig: () => AdvisorConfig;
  /**
   * Return current session enablement.
   */
  readonly getSessionEnabled: () => boolean;
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
      'Consult an independent advisor model using the current conversation context. Empty params select the highest expected-cost scoped model other than the current main model when possible. Optional model selects a scoped model, and optional question asks Advisor to answer a focused review question.',
    promptSnippet:
      'Consult an independent advisor model. Use advisor({}) for default non-current scoped model, advisor({ "question": "..." }) for a focused question, or advisor({ "model": "provider/model", "question": "..." }) for both.',
    promptGuidelines: [
      'Advisor receives the conversation context automatically and returns review feedback as a tool result.',
      'Call advisor when a secondary review can catch flawed assumptions, missing verification, risky changes, or overlooked files.',
      'Use advisor({ "question": "..." }) when Advisor should answer a focused uncertainty from the main model instead of only giving general review feedback.',
      'Do not request models outside the scoped model set; out-of-scope slugs fail and list allowed slugs.',
    ],
    parameters: AdvisorToolParametersSchema,
    executionMode: 'sequential',
    prepareArguments: prepareAdvisorArguments,
    /**
     * Run Advisor tool against active Pi host context.
     *
     * @mutates signal - provider cancellation composition can retain supplied host signal
     *
     * @mutates ctx - scope and auth resolution can invoke Pi host capabilities
     */
    execute: async function executeAdvisorTool(
      toolCallId: string,
      params: {
        readonly model?: string;
        readonly question?: string;
      },
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- pi ToolDefinition.execute dictates positional `signal: AbortSignal | undefined` before required `onUpdate`/`ctx`, so optionality cannot move to a trailing `?:`.
      signal: ForeignHostCapability<AbortSignal> | undefined,
      _onUpdate: unknown,
      ctx: ForeignHostCapability<ExtensionContext>,
    ): Promise<AdvisorToolResult> {
      if (!toolOptions.getSessionEnabled()) {
        throw new Error(
          'advisor: disabled for this session. Run /advisor on to re-enable.',
        );
      }

      /**
       * Primitive Advisor inputs copied from host-owned tool parameters.
       */
      const {
        model: requestedSlug,
        question,
      } = params;
      /**
       * Runtime config snapshot for this call.
       */
      const config = toolOptions.getConfig();
      /**
       * Advisor run result.
       */
      const result = await runAdvisor({
        ctx,
        config,
        ...(requestedSlug
          === undefined ? {} : { requestedSlug, }),
        ...(question
          === undefined ? {} : { question, }),
        toolCallId,
        ...(signal === undefined ? {} : { signal, }),
      },);

      if (result.details
        .stopReason
        === 'aborted')
        throw new Error('advisor: advisor call was aborted',);

      return {
        content: [{
          type: 'text',
          text: result.text,
        },],
        details: result.details,
      };
    },
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- ToolDefinition.renderCall expects positional args; require-destructured-params forbids extracting this to a module-level declaration.
    renderCall: function renderCall(
      args: {
        readonly model?: string;
        readonly question?: string;
      },
      theme: ForeignBorrowed<Theme>,
      _context: unknown,
    ) {
      return renderAdvisorCall({
        args,
        theme,
      },);
    },
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- ToolDefinition.renderResult expects positional args; require-destructured-params forbids extracting this to a module-level declaration.
    renderResult: function renderResult(
      result: ReadonlyDeep<AgentToolResult<AdvisorDetails>>,
      renderOptions: ReadonlyDeep<ToolRenderResultOptions>,
      theme: ForeignBorrowed<Theme>,
      _context: unknown,
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
 * @mutates options - `resolveEffectiveScope` can invoke context scope callbacks and `completeAdvisor` can run command-backed auth through `ctx.modelRegistry.getApiKeyAndHeaders`
 *
 * @example
 * ```typescript
 * const result = await runAdvisor({ ctx, config });
 * ```
 */
export async function runAdvisor(
  options: AdvisorRunOptions,
): Promise<AdvisorRunResult> {
  /**
   * Start time for duration metadata.
   */
  const startedAt = Date.now();
  /**
   * Pi extension context for this Advisor run.
   */
  const { ctx, } = options;
  /**
   * Effective scoped model set.
   */
  const scope = await resolveEffectiveScope({
    ctx,
    errorPrefix: 'advisor',
  },);
  if (scope.entries
    .length
    === 0) {
    throw new Error(
      'advisor: no scoped models with configured auth. Check --models, enabledModels, /scoped-models, or provider login.',
    );
  }

  /**
   * Advisor model system prompt.
   */
  const advisorSystemPrompt = buildAdvisorSystemPrompt(options.config,);
  /**
   * Current primary model to avoid for default Advisor selection when possible.
   */
  const { model: currentMainModel, } = ctx;
  /**
   * Selected Advisor model and model-budgeted serialized context.
   */
  const selectionContext = selectAdvisorRunContext({
    branch: ctx
      .sessionManager
      .getBranch(),
    config: options.config,
    advisorSystemPrompt,
    scope,
    modelRegistry: ctx
      .modelRegistry,
    ...(currentMainModel
      === undefined
      ? {}
      : { currentMainModel, }),
    ...(options.requestedSlug
      === undefined
      ? {}
      : { requestedSlug: options.requestedSlug, }),
    ...(options.question
      === undefined
      ? {}
      : { question: options.question, }),
    ...(options.toolCallId
      === undefined ? {} : { toolCallId: options.toolCallId, }),
  },);
  /**
   * Selected Advisor model and serialized conversation context.
   */
  const {
    selection,
    advisorContext,
  } = selectionContext;

  /**
   * Provider response from selected secondary model.
   */
  const response = await completeAdvisor({
    ctx,
    model: selection.selected
      .model,
    config: options.config,
    advisorContext,
    ...(options.question
      === undefined ? {} : { question: options.question, }),
    ...(options.signal
      === undefined ? {} : { signal: options.signal, }),
  },);
  /**
   * Extracted advisor text.
   */
  const text = extractAdvisorText(response,)
    || '(advisor returned no text)';

  return {
    text,
    details: {
      ...(selection.requestedSlug
        === undefined
        ? {}
        : { requestedSlug: selection.requestedSlug, }),
      selectedSlug: selection.selected
        .canonicalSlug,
      provider: selection
        .selected
        .model
        .provider,
      scopeSource: scope.source,
      scopedSlugs: scope.entries
        .map(function mapEntry(
          entry: ReadonlyDeep<(typeof scope.entries)[number]>,
        ) {
        return entry.canonicalSlug;
      },),
      ...(selection.defaultSelection
        ?.reason
        === undefined
        ? {}
        : { defaultSelectionReason: selection.defaultSelection
          .reason, }),
      durationMs: Date.now()
        - startedAt,
      contextBudgetChars: advisorContext.maxContextChars,
      contextChars: advisorContext.finalChars,
      estimatedInputTokens: advisorContext.estimatedInputTokens,
      truncated: advisorContext.truncated,
      stopReason: response.stopReason,
      usage: response.usage,
      ...(selection.defaultSelection
        ?.ranking
        === undefined
        ? {}
        : { costRanking: selection.defaultSelection
          .ranking, }),
    },
  };
}

//endregion Public API
