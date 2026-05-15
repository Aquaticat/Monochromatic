/**
 * Secondary model call client for Advisor.
 *
 * @module
 */

import {
  complete,
  type Api,
  type AssistantMessage,
  type Message,
  type Model,
  type ProviderStreamOptions,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import { ADVISOR_SYSTEM_PROMPT, } from './constants.ts';
import type {
  AdvisorConfig,
  AdvisorContext,
} from './types.ts';

//region Types

/** Options for invoking the selected Advisor model. */
export type CompleteAdvisorOptions = {
  /** Pi extension context, used for auth lookup. */
  ctx: ExtensionContext;
  /** Selected Advisor model. */
  model: Model<Api>;
  /** Runtime Advisor config. */
  config: AdvisorConfig;
  /** Serialized Advisor context. */
  advisorContext: AdvisorContext;
  /** Abort signal from tool or command mode. */
  signal?: AbortSignal | undefined;
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
  /** Request auth resolved through pi's model registry. */
  const auth = await options.ctx.modelRegistry.getApiKeyAndHeaders(options.model,);
  if (!auth.ok) {
    throw new Error(
      `advisor: auth failed for ${options.model.provider}/${options.model.id}: ${auth.error}`,
    );
  }

  /** Secondary user message containing serialized evidence. */
  const userMessage: Message = {
    role: 'user',
    content: [{
      type: 'text',
      text: `## Serialized conversation\n\n${options.advisorContext.text}`,
    },],
    timestamp: Date.now(),
  };

  /** Provider options built field-by-field for exact optional property types. */
  const providerOptions: ProviderStreamOptions = {
    signal: combinedSignal({
      ...(options.signal === undefined ? {} : { signal: options.signal, }),
      timeoutMs: options.config.timeoutMs,
    },),
    timeoutMs: options.config.timeoutMs,
    maxTokens: options.config.maxAdvisorOutputTokens,
    ...(auth.apiKey === undefined ? {} : { apiKey: auth.apiKey, }),
    ...(auth.headers === undefined ? {} : { headers: auth.headers, }),
  };

  try {
    return await complete(
      options.model,
      {
        systemPrompt: buildAdvisorSystemPrompt(options.config,),
        messages: [userMessage,],
      },
      providerOptions,
    );
  }
  catch (error) {
    throw new Error(
      `advisor: provider call failed for ${options.model.provider}/${options.model.id}: ${
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
  return message.content
    .filter(function keepText(block,) {
      return block.type === 'text';
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
  return (config.systemPrompt === undefined) || (config.systemPrompt.trim() === '')
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
    signal?: AbortSignal;
    timeoutMs: number;
  },
): AbortSignal {
  /** Timeout signal for this Advisor call. */
  const timeoutSignal = AbortSignal.timeout(timeoutMs,);
  return signal === undefined
    ? timeoutSignal
    : AbortSignal.any([
      signal,
      timeoutSignal,
    ],);
}

//endregion Internal helpers
