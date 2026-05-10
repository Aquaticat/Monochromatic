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

/** Response shape of `/v1/chat/completions`. */
type ChatCompletionResponse = {
  choices: readonly {
    message: { content: string | null; };
  }[];
};

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
  const url = `${
    baseUrl.replace(
      /\/$/,
      '',
    )
  }/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${opts.apiKey}`,
    ...extraHeaders,
  };
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages.map(function toApi(
      m: Message,
    ): {
      role: string;
      content: string;
    } {
      return {
        role: m.role,
        content: m.content,
      };
    },),
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.expectJson === true)
    body['response_format'] = { type: 'json_object', };
  const res = await fetch(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body,),
      signal: opts.signal ?? null,
    },
  );
  if (!res.ok) {
    const text = await res
      .text()
      .catch(function ignore(): string {
        return '';
      },);
    throw new Error(
      `openai-compatible: HTTP ${res.status} ${res.statusText}: ${
        text.slice(
          0,
          500,
        )
      }`,
    );
  }
  /*
   * Provider response shape is documented; we narrow at the seam and
   * treat fields defensively (`choices[0]?.message.content ?? ''`).
   */
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const json = await res.json() as ChatCompletionResponse;
  const content = json.choices[0]?.message.content ?? '';
  return content;
}
