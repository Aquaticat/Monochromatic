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

/**
 * Default Anthropic API base.
 */
const DEFAULT_BASE = 'https://api.anthropic.com';

/**
 * Required Messages API version pin.
 */
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Maximum tokens to request. Used for both single-shot and JSON modes.
 */
const MAX_TOKENS = 4_096;

/**
 * Default sampling temperature when callers do not supply one.
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Maximum body snippet length included in error messages on non-2xx responses.
 */
const ERROR_BODY_PREVIEW_CHARS = 500;

/**
 * Anthropic Messages API response shape (subset).
 */
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
 *
 * @param opts - chat options including `apiKey`, `baseUrl`, `model`, `messages`,
 *   optional `temperature`, optional `signal`
 *
 * @returns assistant text from the first text content block
 */
async function callAnthropic(opts: ChatOptions,): Promise<string> {
  if (opts.apiKey
    === '')
    throw new Error('anthropic: no API key configured',);
  /**
   * Configured base URL falling back to the public Anthropic endpoint.
   */
  const base = opts.baseUrl
    === '' ? DEFAULT_BASE : opts.baseUrl;
  /**
   * Provider base URL with any trailing slash removed so the endpoint suffix joins cleanly.
   */
  const trimmedBase = base.endsWith('/',)
    ? base.slice(
      0,
      -1,
    )
    : base;
  /**
   * Full `/v1/messages` URL composed from {@link base}.
   */
  const url = `${trimmedBase}/v1/messages`;
  /**
   * Leading system turns split out since Anthropic accepts them as a separate field.
   */
  const systemMessages = opts.messages
    .filter(function isSystem(
    m: Readonly<Message>,
  ): boolean {
    return m.role
      === 'system';
  },);
  /**
   * Non-system turns forming the message list payload.
   */
  const turnMessages = opts.messages
    .filter(function isTurn(
    m: Readonly<Message>,
  ): boolean {
    return m.role
      !== 'system';
  },);
  /**
   * Joined system-message text passed via Anthropic's `system` field.
   */
  const system = systemMessages
    .map(function toText(m: Readonly<Message>,): string {
      return m.content;
    },)
    .join('\n\n',);
  /**
   * Outgoing payload for Anthropic's `/v1/messages`.
   */
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: MAX_TOKENS,
    temperature: opts.temperature
      ?? DEFAULT_TEMPERATURE,
    system,
    messages: turnMessages.map(function toApi(
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
  };
  /**
   * Request headers including the dangerous-browser opt-in and version pin.
   */
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-api-key': opts.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
  };
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
     * Best-effort error-body snippet appended to the thrown message.
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
      `anthropic: HTTP ${res.status} ${res.statusText}: ${
        text.slice(
          0,
          ERROR_BODY_PREVIEW_CHARS,
        )
      }`,
    );
  }
  /*
   * Provider response shape pinned via `anthropic-version` header.
   * Read defensively below.
   */
  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- response shape pinned by `anthropic-version` header */
  /**
   * Parsed Messages API payload, narrowed to the fields we read.
   */
  const json = await res.json() as MessagesResponse;
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  /**
   * First `text`-typed content block, the assistant's reply.
   */
  const textPart = json.content
    .find(function isText(
    c: Readonly<MessagesResponse['content'][number]>,
  ): boolean {
    return c.type
      === 'text';
  },);
  return textPart?.text
    ?? '';
}

/**
 * Anthropic provider implementation.
 */
export const anthropic: Provider = {
  id: 'anthropic',
  chat: callAnthropic,
};
