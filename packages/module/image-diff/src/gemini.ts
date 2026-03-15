// oxlint-disable typescript/no-unsafe-type-assertion, prefer-destructuring, require-await -- API response types require assertions; provider interface requires async
import { toGeminiInlineData, } from './encoding.gemini.ts';
import { geminiEmbedBatch, } from './gemini.batch.ts';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_BASE,
  resolveGeminiApiKey,
} from './gemini.config.ts';
import {
  l,
  tagged,
} from './log.ts';
import type {
  GeminiEmbedContentRequest,
  GeminiEmbedContentResponse,
} from './types.gemini-api.ts';
import type {
  EmbeddingProvider,
  EmbeddingResult,
  GeminiModel,
  ImageDiffConfig,
  ImageInput,
} from './types.ts';

/**
 * Compute a single image embedding via the Gemini embedContent API.
 *
 * @param input - image to embed, in any supported format
 *
 * @param config - client configuration
 *
 * @returns embedding vector and usage metadata
 *
 * @example
 * ```ts
 * const { embedding } = await geminiEmbed({ path: './photo.png' }, {});
 * ```
 */
async function geminiEmbed(input: ImageInput,
  config: ImageDiffConfig,): Promise<EmbeddingResult>
{
  const rl = tagged({ tag: geminiEmbed.name, l, },);
  rl.debug('computing single image embedding via Gemini',);

  const apiKey = resolveGeminiApiKey(config.apiKey,);
  const model = (config.model as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL;
  const inlineData = await toGeminiInlineData(input,);

  const requestBody: GeminiEmbedContentRequest = {
    content: {
      parts: [{ inline_data: inlineData, },],
    },
  };

  const url = `${GEMINI_API_BASE}/${model}:embedContent`;
  rl.debug(`calling Gemini API: ${url}`,);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody,),
  },);

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`Gemini API returned ${String(response.status,)}: ${errorBody}`,);
    throw new Error(`Gemini API error (${String(response.status,)}): ${errorBody}`,);
  }

  const result = await response.json() as GeminiEmbedContentResponse;
  rl.debug(
    `received embedding with ${String(result.embedding.values.length,)} dimensions`,
  );

  return {
    embedding: result.embedding.values,
    usage: {
      textTokens: 0,
      imagePixels: 0,
      totalTokens: 0,
    },
  };
}

/**
 * Gemini embedding provider.
 * Implements the {@link EmbeddingProvider} interface for the Gemini multimodal API.
 *
 * @example
 * ```ts
 * const result = await geminiProvider.embed({ path: 'photo.png' }, {});
 * ```
 */
export const geminiProvider: EmbeddingProvider = {
  embed: geminiEmbed,
  embedBatch: geminiEmbedBatch,
};
