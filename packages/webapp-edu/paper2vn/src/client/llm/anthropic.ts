/**
 * Anthropic provider.
 *
 * Anthropic blocks browser CORS by default. To call it from the
 * browser, the request must include both:
 *   - `anthropic-dangerous-direct-browser-access: true` header
 *   - the equivalent SDK flag if using @anthropic-ai/sdk
 *
 * We bypass the SDK and POST `/v1/messages` directly with `fetch`.
 * The dangerous-browser-access header is only set after the user has
 * explicitly opted in via settings; until then, calls fail-closed
 * with a clear error.
 */
import type {
  ChatOptions,
  Message,
  Provider,
} from './types.ts';

/** Default Anthropic API base. */
const DEFAULT_BASE = 'https://api.anthropic.com';

/** Required Messages API version pin. */
const ANTHROPIC_VERSION = '2023-06-01';

/** Maximum tokens to request. Used for both single-shot and JSON modes. */
const MAX_TOKENS = 4_096;

/** Anthropic Messages API response shape (subset). */
type MessagesResponse = {
  content: readonly {
    type: string;
    text: string;
  }[];
};

/**
 * POSTs to `/v1/messages` with the persona-augmented message list.
 *
 * Anthropic separates the system prompt from messages, so we extract
 * any leading system message into the `system` field.
 */
async function callAnthropic(opts: ChatOptions,): Promise<string> {
  if (opts.apiKey === '')
    throw new Error('anthropic: no API key configured',);
  const base = opts.baseUrl === '' ? DEFAULT_BASE : opts.baseUrl;
  const url = `${
    base.replace(
      /\/$/,
      '',
    )
  }/v1/messages`;
  const systemMessages = opts.messages.filter(function isSystem(
    m: Message,
  ): boolean {
    return m.role === 'system';
  },);
  const turnMessages = opts.messages.filter(function isTurn(
    m: Message,
  ): boolean {
    return m.role !== 'system';
  },);
  const system = systemMessages
    .map(function toText(m,): string {
      return m.content;
    },)
    .join('\n\n',);
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: MAX_TOKENS,
    temperature: opts.temperature ?? 0.7,
    system,
    messages: turnMessages.map(function toApi(
      m,
    ): {
      role: string;
      content: string;
    } {
      return {
        role: m.role,
        content: m.content,
      };
    },),
  };
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': opts.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
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
      `anthropic: HTTP ${res.status} ${res.statusText} -- ${
        text.slice(
          0,
          500,
        )
      }`,
    );
  }
  /*
   * Provider response shape pinned via `anthropic-version` header.
   * Read defensively below.
   */
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const json = await res.json() as MessagesResponse;
  const textPart = json.content.find(function isText(
    c,
  ): boolean {
    return c.type === 'text';
  },);
  return textPart?.text ?? '';
}

/** Anthropic provider implementation. */
export const anthropic: Provider = {
  id: 'anthropic',
  chat: callAnthropic,
};
