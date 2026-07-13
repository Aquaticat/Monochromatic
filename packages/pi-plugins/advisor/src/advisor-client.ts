/**
 * Secondary model call client for Advisor.
 *
 * @module
 */

import type {
  Api,
  AssistantMessage,
  Context,
  Message,
  Model,
  ProviderStreamOptions,
  ProviderStreams,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi, } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { azureOpenAIResponsesApi, } from '@earendil-works/pi-ai/api/azure-openai-responses.lazy';
import { bedrockConverseStreamApi, } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { googleGenerativeAIApi, } from '@earendil-works/pi-ai/api/google-generative-ai.lazy';
import { googleVertexApi, } from '@earendil-works/pi-ai/api/google-vertex.lazy';
import { mistralConversationsApi, } from '@earendil-works/pi-ai/api/mistral-conversations.lazy';
import { openAICodexResponsesApi, } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy';
import { openAICompletionsApi, } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi, } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import { ADVISOR_SYSTEM_PROMPT, } from './constants.ts';
import { buildAdvisorUserMessageText, } from './advisor-request.ts';
import type {
  AdvisorConfig,
  AdvisorContext,
  AdvisorReadonlyModel,
} from './types.ts';

//region Types

/**
 * Options handed to Advisor model completion seams.
 */
type CompleteAdvisorModelOptions = {
  /**
   * Selected Advisor model.
   */
  readonly model: Readonly<Model<Api>>;
  /**
   * Provider context.
   */
  readonly context: Readonly<Context>;
  /**
   * Provider stream options with resolved auth.
   */
  readonly providerOptions?: Readonly<ProviderStreamOptions>;
};

/**
 * Non-compat pi-ai API streams supported by Advisor.
 *
 * Direct API dispatch preserves registry-selected custom model records because
 * Advisor already resolves API keys and headers before calling the model.
 *
 * @example
 * ```typescript
 * const streams = ADVISOR_API_STREAMS.get('openai-completions');
 * ```
 */
const ADVISOR_API_STREAMS: ReadonlyMap<string, ProviderStreams> = new Map([
  [
    'anthropic-messages',
    anthropicMessagesApi(),
  ],
  [
    'azure-openai-responses',
    azureOpenAIResponsesApi(),
  ],
  [
    'bedrock-converse-stream',
    bedrockConverseStreamApi(),
  ],
  [
    'google-generative-ai',
    googleGenerativeAIApi(),
  ],
  [
    'google-vertex',
    googleVertexApi(),
  ],
  [
    'mistral-conversations',
    mistralConversationsApi(),
  ],
  [
    'openai-codex-responses',
    openAICodexResponsesApi(),
  ],
  [
    'openai-completions',
    openAICompletionsApi(),
  ],
  [
    'openai-responses',
    openAIResponsesApi(),
  ],
],);

/**
 * Complete through pi-ai's direct non-compat API implementation for the model API.
 *
 * @param model - selected Advisor model
 *
 * @param context - provider context
 *
 * @param providerOptions - provider stream options with resolved auth
 *
 * @returns final assistant message from matching pi-ai API implementation
 *
 * @throws when model API has no direct implementation registered for Advisor
 *
 * @example
 * ```typescript
 * const message = await defaultCompleteAdvisorModel({ model, context, providerOptions });
 * ```
 */
async function defaultCompleteAdvisorModel(
  {
    model,
    context,
    providerOptions,
  }: CompleteAdvisorModelOptions,
): Promise<AssistantMessage> {
  /**
   * Direct API stream implementation matching the selected Advisor model.
   */
  const streams = ADVISOR_API_STREAMS.get(model.api,);
  if (streams === undefined) {
    throw new Error(
      `No pi-ai API implementation available for advisor model api "${model.api}" (${model.provider}/${model.id})`,
    );
  }
  if (providerOptions !== undefined)
    return await streams
      .stream(
        model,
        context,
        providerOptions,
      )
      .result();
  return await streams
    .stream(
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
export type CompleteAdvisorOptions = {
  /**
   * Pi extension context, used for auth lookup.
   */
  readonly ctx: ReadonlyDeep<ExtensionContext>;
  /**
   * Selected Advisor model.
   */
  readonly model: AdvisorReadonlyModel;
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
  readonly signal?: ReadonlyDeep<AbortSignal>;
  /**
   * Override model completion implementation for focused tests.
   */
  readonly completeModel?: CompleteAdvisorModel;
};

//endregion Types

//region Public API

/**
 * Call the selected Advisor model with serialized conversation context and no tools.
 *
 * @param options - call inputs
 *
 * @returns final assistant message from the advisor model
 *
 * @throws when auth lookup or provider call fails
 *
 * @example
 * ```typescript
 * const message = await completeAdvisor({ ctx, model, config, advisorContext });
 * ```
 */
export async function completeAdvisor(
  options: CompleteAdvisorOptions,
): Promise<AssistantMessage> {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- pi-ai APIs require non-readonly Model; prefer-readonly-parameter-types forces our parent type to be deep-readonly. */
  /**
   * Mutable view of the advisor model for external pi-ai API calls.
   */
  const mutableModel = options.model as Model<Api>;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
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
   * Build provider options for one provider attempt.
   *
   * @returns provider options with fresh timeout signal
   */
  function createProviderOptions(): ProviderStreamOptions {
    return {
      signal: combinedSignal({
        ...(options.signal
          === undefined ? {} : { signal: options.signal, }),
        timeoutMs: options.config
          .timeoutMs,
      },),
      timeoutMs: options.config
        .timeoutMs,
      maxTokens: options.config
        .maxAdvisorOutputTokens,
      ...(providerApiKey
        === undefined ? {} : { apiKey: providerApiKey, }),
      ...(providerHeaders
        === undefined ? {} : { headers: providerHeaders, }),
    };
  }

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

  try {
    /**
     * Initial provider response from selected Advisor model.
     */
    const firstResponse = await completeModel({
      model: mutableModel,
      context: providerContext,
      providerOptions: createProviderOptions(),
    },);
    /**
     * Whether the initial response contains user-visible text.
     */
    const responseHasText = firstResponse
      .content
      .some(function hasTextContent(block,) {
        return (block.type
          === 'text')
          && (block.text !== '');
      },);
    if (responseHasText)
      return firstResponse;

    return await completeModel({
      model: mutableModel,
      context: providerContext,
      providerOptions: createProviderOptions(),
    },);
  }
  catch (error) {
    throw new Error(
      `advisor: provider call failed for ${options.model
        .provider}/${options.model
          .id}: ${
        Error.isError(error,) ? error.message : String(error,)
      }`,
      { cause: error, },
    );
  }
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
  message: AssistantMessage,
): string {
  return message
    .content
    .filter(function keepText(block,) {
      return block.type
        === 'text';
    },)
    .map(function mapText(block,) {
      return block.text;
    },)
    .join('\n',);
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

//region Internal helpers

/**
 * Combine caller signal with timeout signal when available.
 *
 * @param signal - caller abort signal
 *
 * @param timeoutMs - timeout in milliseconds
 *
 * @returns combined abort signal
 */
function combinedSignal(
  {
    signal,
    timeoutMs,
  }: {
    readonly signal?: ReadonlyDeep<AbortSignal>;
    readonly timeoutMs: number;
  },
): AbortSignal {
  /**
   * Timeout signal for this Advisor call.
   */
  const timeoutSignal = AbortSignal.timeout(timeoutMs,);
  return signal === undefined
    ? timeoutSignal
    : AbortSignal.any([
      signal,
      timeoutSignal,
    ],);
}

//endregion Internal helpers
