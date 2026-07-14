/**
 * OpenRouter provider.
 *
 * OpenAI-compatible. Adds `HTTP-Referer` and `X-Title` headers so the
 * call is attributed to paper2vn in the OpenRouter dashboard.
 */
import { chatOpenAICompatible, } from './openai-compatible.ts';
import type {
  ChatOptions,
  Provider,
} from './types.ts';

/**
 * Default OpenRouter API base.
 */
const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter provider implementation.
 */
export const openrouter: Provider = {
  id: 'openrouter',
  chat: function chat(opts: ChatOptions,): Promise<string> {
    return chatOpenAICompatible({
      baseUrl: opts.baseUrl
        === '' ? DEFAULT_BASE : opts.baseUrl,
      extraHeaders: {
        'HTTP-Referer': globalThis.location
          .origin,
        'X-Title': 'paper2vn',
      },
      opts,
    },);
  },
};
