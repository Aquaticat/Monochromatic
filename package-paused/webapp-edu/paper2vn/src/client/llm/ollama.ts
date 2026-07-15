/**
 * Ollama (local) provider.
 *
 * Talks to a local `ollama serve` process via its native chat API at
 * `/api/chat`. CORS still applies: the user must start Ollama with
 * `OLLAMA_ORIGINS=*` (or the page origin) for the call to succeed.
 */
import type {
  ChatOptions,
  Message,
  Provider,
} from './types.ts';

/**
 * Default Ollama base URL when not overridden.
 */
const DEFAULT_BASE = 'http://localhost:11434';

/**
 * Default sampling temperature when callers do not supply one.
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Maximum body snippet length included in error messages on non-2xx responses.
 */
const ERROR_BODY_PREVIEW_CHARS = 500;

/**
 * Subset of Ollama's `/api/chat` non-streaming response.
 */
type OllamaResponse = {
  message: { content: string; };
};

/**
 * Ollama provider implementation.
 */
export const ollama: Provider = {
  id: 'ollama',
  chat: async function chat(opts: ChatOptions,): Promise<string> {
    /**
     * Configured base URL falling back to localhost when unset.
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
     * Full chat endpoint URL composed from {@link base}.
     */
    const url = `${trimmedBase}/api/chat`;
    /**
     * Outgoing payload for Ollama's `/api/chat` (model, messages, options).
     */
    const body: Record<string, unknown> = {
      model: opts.model,
      stream: false,
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
      options: {
        temperature: opts.temperature
          ?? DEFAULT_TEMPERATURE,
      },
    };
    if (opts.expectJson
      === true)
      body.format = 'json';
    /**
     * Raw fetch response so status can gate the JSON read.
     */
    const res = await fetch(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
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
        `ollama: HTTP ${res.status} ${res.statusText}: ${
          text.slice(
            0,
            ERROR_BODY_PREVIEW_CHARS,
          )
        }`,
      );
    }
    /*
     * Ollama's `/api/chat` non-streaming response is stable since 0.1.
     * Field access is safe under that contract.
     */
    /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- stable Ollama 0.1+ response shape */
    /**
     * Parsed Ollama response payload, narrowed to the fields we read.
     */
    const json = await res.json() as OllamaResponse;
    /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
    return json.message
      .content;
  },
};
