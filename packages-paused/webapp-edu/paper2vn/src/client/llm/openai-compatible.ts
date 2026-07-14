/**
 * Shared OpenAI-compatible chat completions client.
 *
 * Used by the OpenAI and OpenRouter providers; both speak the same
 * `/v1/chat/completions` shape with `Bearer <key>` auth. The base URL
 * is the only difference.
 */
import type {
  ChatOptions,
  Message,
} from './types.ts';

/**
 * Response shape of `/v1/chat/completions`.
 */
type ChatCompletionResponse = {
  choices: readonly {
    message: { content: string | null; };
  }[];
};

/**
 * Default sampling temperature when callers do not supply one.
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Maximum body snippet length included in error messages on non-2xx responses.
 */
const ERROR_BODY_PREVIEW_CHARS = 500;

/**
 * POSTs to an OpenAI-compatible chat completions endpoint.
 *
 * @param baseUrl - root URL ending without `/chat/completions`
 *
 * @param extraHeaders - additional headers (e.g. OpenRouter referer)
 *
 * @param opts - chat options
 *
 * @returns assistant text
 *
 * @example
 * ```ts
 * const reply = await chatOpenAICompatible({
 *   baseUrl: 'https://api.openai.com/v1',
 *   extraHeaders: {},
 *   opts: {
 *     apiKey: process.env.OPENAI_API_KEY ?? '',
 *     model: 'gpt-4o-mini',
 *     messages: [{ role: 'user', content: 'one line haiku about lint' }],
 *   },
 * });
 * ```
 */
export async function chatOpenAICompatible(
  {
    baseUrl,
    extraHeaders,
    opts,
  }: {
    baseUrl: string;
    extraHeaders: Record<string, string>;
    opts: ChatOptions;
  },
): Promise<string> {
  /**
   * Provider base URL with any trailing slash removed so the endpoint suffix joins cleanly.
   */
  const trimmedBase = baseUrl.endsWith('/',)
    ? baseUrl.slice(
      0,
      -1,
    )
    : baseUrl;
  /**
   * Full chat-completions endpoint URL built from the provider base URL.
   */
  const url = `${trimmedBase}/chat/completions`;
  /**
   * Request headers: JSON content-type, bearer auth, plus provider extras.
   */
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${opts.apiKey}`,
    ...extraHeaders,
  };
  /**
   * Outgoing JSON payload (model, messages, temperature, optional JSON format).
   */
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages
      .map(function toApi(
      m: Readonly<Message>,
    ): {
      role: string;
      content: string;
    } {
      return {
        role: m.role,
        content: m.content,
      };
    },),
    temperature: opts.temperature
      ?? DEFAULT_TEMPERATURE,
  };
  if (opts.expectJson
    === true)
    body.response_format = { type: 'json_object', };
  /**
   * Raw fetch response so status can gate the JSON read.
   */
  const res = await fetch(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body,),
      signal: opts.signal
        ?? null,
    },
  );
  if (!res.ok) {
    /**
     * Best-effort error-body snippet included in the thrown message.
     */
    const text = await (async function safeText(): Promise<string> {
      try {
        return await res.text();
      }
      catch {
        return '';
      }
    })();
    throw new Error(
      `openai-compatible: HTTP ${res.status} ${res.statusText}: ${
        text.slice(
          0,
          ERROR_BODY_PREVIEW_CHARS,
        )
      }`,
    );
  }
  /*
   * Provider response shape is documented; we narrow at the seam and
   * treat fields defensively (`choices[0]?.message.content ?? ''`).
   */
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- documented provider response shape, narrowed at the seam */
  /**
   * Parsed chat-completions payload, narrowed to the fields we read.
   */
  const json = await res.json() as ChatCompletionResponse;
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  /**
   * First choice's assistant content, defaulting to empty when missing.
   */
  const content = json.choices[0]
    ?.message
    .content
    ?? '';
  return content;
}
