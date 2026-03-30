// oxlint-disable typescript/no-unsafe-type-assertion, prefer-destructuring -- API response types require assertions
import { toGeminiInlineData, } from './encoding.gemini.ts';
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
  GeminiBatchEmbedRequest,
  GeminiBatchEmbedResponse,
} from './types.gemini-api.ts';
import type {
  BatchEmbeddingResult,
  GeminiModel,
  ImageDiffConfig,
  ImageInput,
} from './types.ts';

/**
 * Compute embeddings for multiple images via the Gemini batchEmbedContents API.
 *
 * @param inputs - array of images to embed
 *
 * @param config - client configuration
 *
 * @returns embedding vectors (in input order) and aggregate usage metadata
 *
 * @example
 * ```ts
 * const { embeddings } = await geminiEmbedBatch([{ path: 'a.png' }, { path: 'b.png' }], {});
 * ```
 */
export async function geminiEmbedBatch(
  inputs: readonly ImageInput[],
  config: ImageDiffConfig,
): Promise<BatchEmbeddingResult> {
  const rl = tagged({
    tag: geminiEmbedBatch.name,
    l,
  },);
  rl.debug(
    `computing batch embeddings via Gemini for ${String(inputs.length,)} image(s)`,
  );

  const apiKey = resolveGeminiApiKey(config.apiKey,);
  const model = (config.model as GeminiModel | undefined) ?? DEFAULT_GEMINI_MODEL;

  const inlineDataItems = await Promise.all(
    inputs.map(function convertInput(input,) {
      return toGeminiInlineData(input,);
    },),
  );

  const requestBody: GeminiBatchEmbedRequest = {
    requests: inlineDataItems.map(function wrapInlineData(inlineData,) {
      return {
        model: `models/${model}`,
        content: {
          parts: [{ inline_data: inlineData, },],
        },
      };
    },),
  };

  const url = `${GEMINI_API_BASE}/${model}:batchEmbedContents`;
  rl.debug(`calling Gemini batch API: ${url}, ${String(inputs.length,)} input(s)`,);

  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody,),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`Gemini batch API returned ${String(response.status,)}: ${errorBody}`,);
    throw new Error(`Gemini API error (${String(response.status,)}): ${errorBody}`,);
  }

  const result = await response.json() as GeminiBatchEmbedResponse;
  rl.debug(`received ${String(result.embeddings.length,)} embedding(s)`,);

  return {
    embeddings: result.embeddings.map(function extractValues(e,) {
      return e.values;
    },),
    usage: {
      textTokens: 0,
      imagePixels: 0,
      totalTokens: 0,
    },
  };
}
