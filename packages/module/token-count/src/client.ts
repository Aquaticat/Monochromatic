import Anthropic from '@anthropic-ai/sdk';
import { readFile, } from 'node:fs/promises';

import {
  l,
  tagged,
} from './log.ts';
import type {
  CountTokensConfig,
  FileTokenCountResult,
  TokenCountResult,
} from './types.ts';

/**
 * Default Claude model used when no model is specified in config.
 * The API requires a model to select the tokenizer, but all current Claude
 * models share the same tokenizer so the choice has no effect on the count.
 * No inference is performed; only the dedicated token counting endpoint is called.
 *
 * @example
 * ```ts
 * console.log(DEFAULT_MODEL); // 'claude-sonnet-4-6'
 * ```
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Env var names checked in priority order when no explicit API key is provided.
 * `TOKEN_COUNT_CLAUDE_API_KEY` takes precedence, then `CLAUDE_API_KEY`,
 * then the SDK default `ANTHROPIC_API_KEY`.
 */
const API_KEY_ENV_VARS = [
  'TOKEN_COUNT_CLAUDE_API_KEY',
  'CLAUDE_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;

/**
 * Resolve an API key from an explicit value or env var fallback chain.
 *
 * @param explicit - caller-provided API key, checked first
 *
 * @returns resolved API key, or `undefined` to let the SDK try its own default
 *
 * @example
 * ```ts
 * const key = resolveApiKey(undefined); // checks env vars
 * const key2 = resolveApiKey('sk-ant-...'); // uses explicit value
 * ```
 */
function resolveApiKey(explicit: string | undefined,): string | undefined {
  if (explicit !== undefined)
    return explicit;
  for (const envVar of API_KEY_ENV_VARS) {
    /** Treat empty-string env vars as unset so a blank shell export does not shadow later fallbacks. */
    const value = process.env[envVar];
    if ((value !== undefined) && (value !== ''))
      return value;
  }
  return undefined;
}

/**
 * Resolve an Anthropic client from an optional API key.
 * Checks `TOKEN_COUNT_CLAUDE_API_KEY`, `CLAUDE_API_KEY`, then
 * `ANTHROPIC_API_KEY` env vars when no explicit key is provided.
 *
 * @param apiKey - optional API key for client construction
 *
 * @returns configured Anthropic client
 *
 * @example
 * ```ts
 * const client = resolveClient({ apiKey: 'sk-ant-...' });
 * ```
 */
function resolveClient(
  { apiKey, }: { readonly apiKey: string | undefined; },
): Anthropic {
  /** Branch on the resolved value so the SDK still falls through to its own default when nothing is found. */
  const resolved = resolveApiKey(apiKey,);
  return new Anthropic(resolved !== undefined ? { apiKey: resolved, } : undefined,);
}

/**
 * Count input tokens for a text string using the Anthropic token counting API.
 *
 * @param content - text string whose tokens to count
 *
 * @param config - optional configuration (model, apiKey)
 *
 * @returns token count and model used
 *
 * @throws Anthropic.AuthenticationError when API key is invalid or missing
 *
 * @throws Anthropic.BadRequestError when model is invalid
 *
 * @example
 * ```ts
 * const result = await countTokens({ content: 'Hello, world!' });
 * console.log(result.inputTokens); // e.g. 4
 * ```
 */
export async function countTokens({
  content,
  config = {},
}: {
  readonly content: string;
  readonly config?: CountTokensConfig;
},): Promise<TokenCountResult> {
  /** Scope log lines to this function so concurrent counts stay distinguishable. */
  const rl = tagged({
    tag: countTokens.name,
    l,
  },);
  /** Fall back to the shared default so callers can omit model when the tokenizer choice is irrelevant. */
  const model = config.model
    ?? DEFAULT_MODEL;
  /** Build the SDK client lazily here so each call can supply its own apiKey override. */
  const client = resolveClient({ apiKey: config.apiKey, },);

  rl.debug(`counting tokens model=${model} contentLength=${String(content.length,)}`,);

  /** Hold the SDK response so the input_tokens field can be logged before being repackaged for the caller. */
  const response = await client.messages
    .countTokens({
    model,
    messages: [{
      role: 'user',
      content,
    },],
  },);

  rl.debug(`counted inputTokens=${String(response.input_tokens,)}`,);

  return {
    inputTokens: response.input_tokens,
    model,
  };
}

/**
 * Count input tokens for a file by reading it and passing its content
 * to the Anthropic token counting API.
 *
 * @param filePath - path to the file to read and count tokens for
 *
 * @param config - optional configuration (model, apiKey)
 *
 * @returns token count, model used, and file path
 *
 * @throws Error when file cannot be read (ENOENT, EACCES, etc.)
 *
 * @throws Anthropic.AuthenticationError when API key is invalid or missing
 *
 * @example
 * ```ts
 * const result = await countFileTokens({ filePath: './CLAUDE.md' });
 * console.log(`${result.filePath}: ${result.inputTokens} tokens`);
 * ```
 */
export async function countFileTokens({
  filePath,
  config = {},
}: {
  readonly filePath: string;
  readonly config?: CountTokensConfig;
},): Promise<FileTokenCountResult> {
  /** Scope log lines to this function so concurrent file reads stay distinguishable. */
  const rl = tagged({
    tag: countFileTokens.name,
    l,
  },);
  rl.debug(`reading file path=${filePath}`,);

  /** Read once up front so the file path is reported in any read error before the API is touched. */
  const content = await readFile(
    filePath,
    'utf8',
  );
  /** Delegate token counting to the string variant so the API call has a single owner. */
  const result = await countTokens({
    content,
    config,
  },);

  return {
    ...result,
    filePath,
  };
}
