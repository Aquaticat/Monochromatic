/**
 * Secondary model call client for Advisor.
 *
 * @module
 */

import type {
  Api,
  AssistantMessage,
  Message,
  Model,
  ProviderStreamOptions,
} from '@earendil-works/pi-ai';
import { complete, } from '@earendil-works/pi-ai/compat';
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
 * Complete function used to call Advisor model.
 */
export type CompleteAdvisorModel = typeof complete;

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
   * Provider options built field-by-field for exact optional property types.
   */
  const providerOptions: ProviderStreamOptions = {
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
    ...(auth.apiKey
      === undefined ? {} : { apiKey: auth.apiKey, }),
    ...(auth.headers
      === undefined ? {} : { headers: auth.headers, }),
  };

  /**
   * Completion implementation for provider call.
   */
  const completeModel = options.completeModel
    ?? complete;

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
    const firstResponse = await completeModel(
      mutableModel,
      providerContext,
      providerOptions,
    );
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

    return await completeModel(
      mutableModel,
      providerContext,
      providerOptions,
    );
  }
  catch (error) {
    throw new Error(
      `advisor: provider call failed for ${options.model
        .provider}/${options.model
          .id}: ${
        error instanceof Error ? error.message : String(error,)
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
