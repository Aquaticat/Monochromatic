/**
 * OpenAI provider.
 *
 * `/v1/chat/completions` allows browser CORS, so the call is direct.
 */
import { chatOpenAICompatible, } from './openai-compatible.ts';
import type {
  ChatOptions,
  Provider,
} from './types.ts';

/** Default OpenAI API base. */
const DEFAULT_BASE = 'https://api.openai.com/v1';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- `opts` carries an `AbortSignal` so deep-readonly cannot apply; the call delegates without mutation. */
/** OpenAI provider implementation. */
export const openai: Provider = {
  id: 'openai',
  chat: function chat(opts: ChatOptions,): Promise<string> {
    return chatOpenAICompatible({
      baseUrl: opts.baseUrl === '' ? DEFAULT_BASE : opts.baseUrl,
      extraHeaders: {},
      opts,
    },);
  },
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
