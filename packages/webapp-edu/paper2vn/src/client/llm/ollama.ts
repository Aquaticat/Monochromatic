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

/** Default Ollama base URL when not overridden. */
const DEFAULT_BASE = 'http://localhost:11434';

/** Subset of Ollama's `/api/chat` non-streaming response. */
type OllamaResponse = {
  message: { content: string; };
};

/** Ollama provider implementation. */
export const ollama: Provider = {
  id: 'ollama',
  chat: async function chat(opts: ChatOptions,): Promise<string> {
    const base = opts.baseUrl === '' ? DEFAULT_BASE : opts.baseUrl;
    const url = `${
      base.replace(
        /\/$/,
        '',
      )
    }/api/chat`;
    const body: Record<string, unknown> = {
      model: opts.model,
      stream: false,
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
      options: {
        temperature: opts.temperature ?? 0.7,
      },
    };
    if (opts.expectJson === true)
      body['format'] = 'json';
    const res = await fetch(
      url,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', },
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
        `ollama: HTTP ${res.status} ${res.statusText}: ${
          text.slice(
            0,
            500,
          )
        }`,
      );
    }
    /*
     * Ollama's `/api/chat` non-streaming response is stable since 0.1.
     * Field access is safe under that contract.
     */
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    const json = await res.json() as OllamaResponse;
    return json.message.content;
  },
};
