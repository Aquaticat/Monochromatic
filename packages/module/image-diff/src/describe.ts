// oxlint-disable typescript/no-unsafe-type-assertion, require-await -- API response types require assertions
import { toImageUri, } from './encoding.uri.ts';
import {
  l,
  tagged,
} from './log.ts';
import type { ImageInput, } from './types.ts';

/**
 * OpenRouter chat completions endpoint URL.
 */
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Model ID for Gemini 3.1 Pro Preview on OpenRouter.
 */
const MODEL = 'google/gemini-3.1-pro-preview';

/**
 * Prompt instructing the model to describe visual differences between two images.
 */
const DESCRIBE_PROMPT =
  `Compare these two images and describe all visual differences in detail.
Cover: layout changes, color differences, typography changes, spacing modifications,
elements that were added or removed, and any other noticeable changes.
Image A is the first image, Image B is the second.`;

//region OpenRouter API types

/**
 * Content part in an OpenRouter chat message.
 */
type ContentPart =
  | { readonly type: 'text'; readonly text: string; }
  | { readonly type: 'image_url'; readonly image_url: { readonly url: string; }; };

/**
 * Chat message for the OpenRouter API.
 */
type ChatMessage = {
  readonly role: 'user';
  readonly content: readonly ContentPart[];
};

/**
 * Request body for the OpenRouter chat completions API.
 */
type ChatCompletionRequest = {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
};

/**
 * Response from the OpenRouter chat completions API.
 */
type ChatCompletionResponse = {
  readonly choices: readonly {
    readonly message: {
      readonly content: string;
    };
  }[];
};

//endregion OpenRouter API types

/**
 * Resolve the OpenRouter API key from the environment.
 * Returns `undefined` when no key is available, allowing callers
 * to skip the description gracefully.
 *
 * @returns resolved API key, or `undefined` if not configured
 *
 * @example
 * ```ts
 * const key = resolveOpenRouterApiKey();
 * if (key === undefined) return undefined;
 * ```
 */
function resolveOpenRouterApiKey(): string | undefined {
  const rl = tagged({ tag: resolveOpenRouterApiKey.name, l, },);
  const key = process.env['IMAGE_DIFF_OPENROUTER_API_KEY']
    ?? process.env['OPENROUTER_API_KEY'];
  if (key === undefined || key === '') {
    rl.debug('no OpenRouter API key found, skipping description',);
    return undefined;
  }
  rl.debug('OpenRouter API key resolved',);
  return key;
}

/**
 * Send two images to Gemini 3.1 Pro Preview via OpenRouter and return
 * a detailed natural-language description of the visual differences.
 *
 * @param imageA - first image (before)
 *
 * @param imageB - second image (after)
 *
 * @returns detailed description of visual differences, or `undefined` when no API key is configured
 *
 * @throws when the API call itself fails (key is present but request errors)
 *
 * @example
 * ```ts
 * const description = await describeImageDifference(
 *   { path: './before.png' },
 *   { path: './after.png' },
 * );
 * if (description !== undefined) console.log(description);
 * ```
 */
export async function describeImageDifference(imageA: ImageInput,
  imageB: ImageInput,): Promise<string | undefined>
{
  const rl = tagged({ tag: describeImageDifference.name, l, },);

  const apiKey = resolveOpenRouterApiKey();
  if (apiKey === undefined)
    return undefined;

  rl.debug('describing image differences via Gemini 3.1 Pro Preview on OpenRouter',);
  const [uriA, uriB,] = await Promise.all([toImageUri(imageA,), toImageUri(imageB,),],);

  const requestBody: ChatCompletionRequest = {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: DESCRIBE_PROMPT, },
          { type: 'image_url', image_url: { url: uriA, }, },
          { type: 'image_url', image_url: { url: uriB, }, },
        ],
      },
    ],
  };

  rl.debug(`calling OpenRouter API with model ${MODEL}`,);

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody,),
  },);

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`OpenRouter API returned ${String(response.status,)}: ${errorBody}`,);
    throw new Error(`OpenRouter API error (${String(response.status,)}): ${errorBody}`,);
  }

  const result = await response.json() as ChatCompletionResponse;
  const [choice,] = result.choices;
  if (choice === undefined)
    throw new Error('OpenRouter API returned no choices',);

  const description = choice.message.content;
  rl.debug(`received description (${String(description.length,)} chars)`,);
  return description;
}
