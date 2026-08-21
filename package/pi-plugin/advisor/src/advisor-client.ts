/**
 * Secondary model call client for Advisor.
 *
 * @module
 */

import {
  getSupportedThinkingLevels,
  type Api,
  type AssistantMessage,
  type Context,
  type Message,
  type Model,
  type ModelThinkingLevel,
  type SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { completeAdvisorAttempts, } from './advisor-completion.ts';
import { ADVISOR_SYSTEM_PROMPT, } from './constants.ts';
import { buildAdvisorUserMessageText, } from './advisor-request.ts';
import { assertAdvisorEndpointOutputCapacity, } from './output-eligibility.ts';
import type {
  AdvisorConfig,
  AdvisorContext,
  AdvisorReadonlyModel,
} from './types.ts';

//region Constants

/**
 * Reasoning levels Advisor may request, all strictly lower than `max`.
 *
 * @example
 * ```typescript
 * ADVISOR_REASONING_LEVELS_BELOW_MAX.has('xhigh'); // true
 * ```
 */
const ADVISOR_REASONING_LEVELS_BELOW_MAX: ReadonlySet<ModelThinkingLevel> = new Set([
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
],);

//endregion Constants

//region Types

/**
 * Options handed to Advisor model completion seams.
 */
type CompleteAdvisorModelOptions = {
  /**
   * Pi extension context that owns provider registrations.
   */
  readonly ctx: ForeignHostCapability<ExtensionContext>;
  /**
   * Selected Advisor model.
   */
  readonly model: ForeignHostCapability<Model<Api>>;
  /**
   * Provider context consumed by provider runtime.
   */
  readonly context: ForeignHostCapability<Context>;
  /**
   * Provider stream options consumed by provider runtime.
   */
  readonly providerOptions?: ForeignHostCapability<SimpleStreamOptions>;
};

/**
 * Complete through selected model provider's registered simple-stream implementation.
 *
 * @param ctx - pi extension context that owns provider registrations
 *
 * @param model - selected Advisor model
 *
 * @param context - provider context
 *
 * @param providerOptions - provider stream options with resolved auth
 *
 * @returns final assistant message from registered provider implementation
 *
 * @mutates ctx - provider lookup can inspect model-registry host state
 *
 * @mutates model - provider stream implementations can inspect or retain selected model data
 *
 * @mutates context - provider stream implementations consume message context and reachable content
 *
 * @mutates providerOptions - provider stream implementations observe abort and auth capabilities
 *
 * @throws when selected model provider is not registered
 *
 * @example
 * ```typescript
 * const message = await defaultCompleteAdvisorModel({ ctx, model, context, providerOptions });
 * ```
 */
async function defaultCompleteAdvisorModel(
  {
    ctx,
    model,
    context,
    providerOptions,
  }: ForeignBorrowed<CompleteAdvisorModelOptions>,
): Promise<AssistantMessage> {
  /**
   * Registered provider implementation for selected Advisor model.
   */
  const provider = ctx
    .modelRegistry
    .getProvider(model.provider,);
  if (provider === undefined) {
    throw new Error(
      `No provider registered for advisor model "${model.provider}/${model.id}"`,
    );
  }
  if (providerOptions !== undefined)
    return await provider
      .streamSimple(
        model,
        context,
        providerOptions,
      )
      .result();
  return await provider
    .streamSimple(
      model,
      context,
    )
    .result();
}

/**
 * Complete function used to call Advisor model.
 */
export type CompleteAdvisorModel = typeof defaultCompleteAdvisorModel;

/**
 * Options for invoking the selected Advisor model.
 */
export type CompleteAdvisorOptions = ForeignHostCapability<{
  /**
   * Pi extension context, used for auth lookup.
   */
  readonly ctx: ForeignHostCapability<ExtensionContext>;
  /**
   * Selected Advisor model handed to provider runtime.
   */
  readonly model: ForeignHostCapability<AdvisorReadonlyModel>;
  /**
   * Runtime Advisor config.
   */
  readonly config: AdvisorConfig;
  /**
   * Serialized Advisor context.
   */
  readonly advisorContext: AdvisorContext;
  /**
   * Focused question supplied by the primary agent.
   */
  readonly question?: string;
  /**
   * Abort signal from tool or command mode.
   */
  readonly signal?: ForeignHostCapability<AbortSignal>;
  /**
   * Advisor operation start time before context preparation.
   */
  readonly operationStartedAtMs?: number;
  /**
   * Override model completion implementation for focused tests.
   */
  readonly completeModel?: CompleteAdvisorModel;
}>;

//endregion Types

//region Public API

/**
 * Call the selected Advisor model with serialized conversation context and no tools.
 *
 * @param options - call inputs
 *
 * @returns final assistant message from the advisor model
 *
 * @mutates options - auth lookup can run command-backed configuration, provider callbacks consume supplied capabilities, and `AbortSignal.any` stores dependent-signal relations
 *
 * @throws when auth lookup or provider call fails
 *
 * @example
 * ```typescript
 * const message = await completeAdvisor({ ctx, model, config, advisorContext });
 * ```
 */
export async function completeAdvisor(
  options: ForeignHostCapability<CompleteAdvisorOptions>,
): Promise<AssistantMessage> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- pi-ai accepts mutable Model while this boundary retains the selected model without changing it. */
  /**
   * Mutable view of the advisor model for external pi-ai API calls.
   */
  const mutableModel = options.model as ForeignHostCapability<Model<Api>>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Canonical selected model slug used in eligibility and attempt diagnostics.
   */
  const modelSlug = `${options.model
    .provider}/${options.model
      .id}`;
  assertAdvisorEndpointOutputCapacity({
    endpointSlug: modelSlug,
    advertisedOutputTokens: options.model
      .maxTokens,
    maxAdvisorOutputTokens: options.config
      .maxAdvisorOutputTokens,
  },);
  /**
   * Request auth resolved through pi's model registry.
   */
  const auth = await options
    .ctx
    .modelRegistry
    .getApiKeyAndHeaders(mutableModel,);
  if (!auth.ok) {
    throw new Error(
      `advisor: auth failed for ${options.model
        .provider}/${options.model
          .id}: ${auth.error}`,
    );
  }

  /**
   * Model-supported reasoning levels ordered from least to most reasoning.
   */
  const supportedReasoningLevels = getSupportedThinkingLevels(mutableModel,);
  /**
   * Supported levels strictly below `max`, including any provider default levels.
   */
  const allowedReasoningLevels = supportedReasoningLevels.filter(
    function isAllowedAdvisorReasoningLevel(
      level: ModelThinkingLevel,
    ): boolean {
      return ADVISOR_REASONING_LEVELS_BELOW_MAX.has(level,);
    },
  );
  /**
   * Highest allowed reasoning level advertised by selected model.
   */
  const highestAllowedReasoningLevel = allowedReasoningLevels
    .at(-1,);
  /**
   * Highest allowed reasoning effort supplied to simple provider API, or no effort for non-reasoning model.
   */
  const advisorReasoningLevel = highestAllowedReasoningLevel
    === 'off'
    ? undefined
    : highestAllowedReasoningLevel;

  /**
   * Secondary user message containing serialized evidence.
   */
  const userMessage: Message = {
    role: 'user',
    content: [{
      type: 'text',
      text: buildAdvisorUserMessageText({
        contextText: options.advisorContext
          .text,
        ...(options.question === undefined ? {} : { question: options.question, }),
      },),
    },],
    timestamp: Date.now(),
  };

  /**
   * Provider API key, when the selected model registry supplies one.
   */
  const providerApiKey = auth.apiKey;
  /**
   * Provider headers, when the selected model registry supplies them.
   */
  const providerHeaders = auth.headers;

  /**
   * Completion implementation for provider call.
   */
  const completeModel = options.completeModel
    ?? defaultCompleteAdvisorModel;

  /**
   * Provider context shared by initial call and retry.
   */
  const providerContext = {
    systemPrompt: buildAdvisorSystemPrompt(options.config,),
    messages: [userMessage,],
  };
  /**
   * Provider options independent of attempt deadline state.
   */
  const providerOptions: Omit<SimpleStreamOptions, 'signal' | 'timeoutMs'> = {
    maxTokens: options.config
      .maxAdvisorOutputTokens,
    ...(advisorReasoningLevel
      === undefined ? {} : { reasoning: advisorReasoningLevel, }),
    ...(providerApiKey
      === undefined ? {} : { apiKey: providerApiKey, }),
    ...(providerHeaders
      === undefined ? {} : { headers: providerHeaders, }),
  };

  return await completeAdvisorAttempts({
    modelSlug,
    timeoutMs: options.config
      .timeoutMs,
    ...(options.operationStartedAtMs === undefined
      ? {}
      : { operationStartedAtMs: options.operationStartedAtMs, }),
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
    providerOptions,
    complete:
    /**
     * Invoke selected provider with current attempt options.
     *
     * @param attempt - deadline-bound provider attempt
     *
     * @returns terminal provider response
     *
     * @mutates attempt - registered provider can consume or retain supplied host capabilities
     */
      async function completeAttempt(
      attempt: ForeignHostCapability<{
        readonly providerOptions: ForeignHostCapability<SimpleStreamOptions>;
      }>,
    ): Promise<AssistantMessage> {
      return await completeModel({
        ctx: options.ctx,
        model: mutableModel,
        context: providerContext,
        providerOptions: attempt.providerOptions,
      },);
    },
  },);
}

/**
 * Extract all text blocks from an advisor response.
 *
 * @param message - advisor assistant message
 *
 * @returns joined text content
 *
 * @example
 * ```typescript
 * const text = extractAdvisorText(message);
 * ```
 */
export function extractAdvisorText(
  message: ReadonlyDeep<AssistantMessage>,
): string {
  /**
   * Text blocks collected from Advisor response.
   */
  const textParts: string[] = [];
  for (const block of message.content) {
    if (block.type
      === 'text')
      textParts.push(block.text,);
  }
  return textParts.join('\n',);
}

/**
 * Build Advisor-model system prompt from built-in and project-specific prompts.
 *
 * @param config - runtime Advisor config
 *
 * @returns final system prompt
 *
 * @example
 * ```typescript
 * const systemPrompt = buildAdvisorSystemPrompt(config);
 * ```
 */
export function buildAdvisorSystemPrompt(
  config: AdvisorConfig,
): string {
  return (config.systemPrompt
    === undefined) || (config.systemPrompt
      .trim()
      === '')
    ? ADVISOR_SYSTEM_PROMPT
    : `${ADVISOR_SYSTEM_PROMPT}\n\n## Project-specific instructions\n\n${config.systemPrompt}`;
}

//endregion Public API
