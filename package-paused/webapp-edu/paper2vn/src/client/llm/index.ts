/**
 * LLM provider registry and dispatch.
 *
 * Reads provider config from the state store and routes the call to
 * the matching adapter. Every provider returns plain assistant text;
 * shape-validation happens in the dialogue generator.
 */
import {
  getProvider,
  getSettings,
} from '../state.ts';
import type { ProviderId, } from '../types.ts';
import { anthropic, } from './anthropic.ts';
import { ollama, } from './ollama.ts';
import { openai, } from './openai.ts';
import { openrouter, } from './openrouter.ts';
import type {
  Message,
  Provider,
} from './types.ts';

/**
 * Registered providers keyed by id.
 */
const PROVIDERS: Record<ProviderId, Provider> = {
  openrouter,
  openai,
  anthropic,
  ollama,
};

/**
 * Returns `true` when the configured provider is ready to make calls.
 *
 * Anthropic also requires the explicit dangerous-browser opt-in.
 *
 * @returns true when the active provider has the credentials and
 *   acknowledgements it needs to dispatch a chat completion
 *
 * @example
 * ```ts
 * if (!isProviderReady()) {
 *   showSettingsScreen();
 *   return;
 * }
 * const reply = await chat({ messages, expectJson: false, signal: undefined });
 * ```
 */
export function isProviderReady(): boolean {
  /**
   * Active provider config snapshot from the settings store.
   */
  const cfg = getProvider();
  if (cfg.id
    === 'ollama')
    return true;
  if (cfg.apiKey
    === '')
    return false;
  if ((cfg.id
    === 'anthropic') && (!cfg.acknowledgedAnthropicWarning))
    return false;
  return true;
}

/**
 * Sends a chat completion through the active provider.
 *
 * @param messages - chat messages in turn order
 *
 * @param expectJson - hint to the provider that JSON output is desired
 *
 * @param signal - optional abort signal
 *
 * @returns assistant text
 *
 * @throws when no provider is configured or the request fails
 *
 * @example
 * ```ts
 * const reply = await chat({
 *   messages: [{ role: 'user', content: 'Summarise this in one sentence.' }],
 *   expectJson: false,
 *   signal: undefined,
 * });
 * console.error('[main]', reply);
 * ```
 */
export function chat(
  {
    messages,
    expectJson,
    signal,
  }: {
    messages: readonly Message[];
    expectJson: boolean | undefined;
    signal: AbortSignal | undefined;
  },
): Promise<string> {
  if (!isProviderReady())
    throw new Error('llm: provider not ready (missing key or pending warning)',);
  /**
   * Active provider config (id, key, model, base URL).
   */
  const cfg = getProvider();
  /**
   * Adapter implementation for the active provider id.
   */
  const provider = PROVIDERS[cfg.id];
  console.error(
    '[llm] dispatching to',
    cfg.id,
    'model',
    cfg.model,
    'json',
    expectJson === true,
  );
  return provider.chat({
    messages,
    model: cfg.model,
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    signal,
    expectJson,
    temperature: undefined,
  },);
}

/**
 * Re-exports for callers that want the locale string to bind to messages.
 */
export type { Message, } from './types.ts';

/**
 * Re-exports settings access for prompt builders.
 */
export { getSettings, };
