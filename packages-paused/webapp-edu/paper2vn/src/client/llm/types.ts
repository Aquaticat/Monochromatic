/**
 * LLM provider abstraction types.
 *
 * Every provider implements the same `chat` shape. Streaming is left
 * as a follow-up; MVP uses single-shot completions to keep the build
 * lean.
 */

/**
 * Chat role.
 */
export type Role = 'system' | 'user' | 'assistant';

/**
 * A single chat message.
 */
export type Message = {
  /**
   * Sender role.
   */
  role: Role;

  /**
   * Plain-text content.
   */
  content: string;
};

/**
 * Provider configuration handed to a chat call.
 */
export type ChatOptions = {
  /**
   * Messages in turn order.
   */
  messages: readonly Message[];

  /**
   * Model identifier (provider-specific).
   */
  model: string;

  /**
   * API key, or empty for keyless providers like Ollama.
   */
  apiKey: string;

  /**
   * Base URL override; empty means provider default.
   */
  baseUrl: string;

  /**
   * Optional abort signal for cancellation. Undefined means uncancellable.
   */
  signal: AbortSignal | undefined;

  /**
   * Sampling temperature (0-2).
   */
  temperature: number | undefined;

  /**
   * Hint to the model that the response should be valid JSON.
   */
  expectJson: boolean | undefined;
};

/**
 * Concrete provider implementation.
 */
export type Provider = {
  /**
   * Stable provider id matching {@link import('../types.ts').ProviderId}.
   */
  id: string;

  /**
   * Sends a chat completion request.
   *
   * @param opts - request options
   *
   * @returns assistant content text
   *
   * @throws when the HTTP call fails or the response shape is unexpected
   */
  chat: (opts: ChatOptions,) => Promise<string>;
};
