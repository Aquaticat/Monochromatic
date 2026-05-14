// oxlint-disable typescript/no-unsafe-type-assertion, prefer-destructuring -- API response types require assertions
import { toVoyageContentItem, } from './encoding.voyage.ts';
import {
  l,
  tagged,
} from './log.ts';
import type {
  BatchEmbeddingResult,
  EmbeddingProvider,
  EmbeddingResult,
  ImageDiffConfig,
  ImageInput,
  VoyageModel,
} from './types.ts';
import type { VoyageApiRequest, } from './types.voyage-api.ts';
import {
  callVoyageApi,
  resolveVoyageApiKey,
} from './voyage.api.ts';

/**
 * Default Voyage model -- latest and highest quality.
 */
const DEFAULT_VOYAGE_MODEL: VoyageModel = 'voyage-multimodal-3.5';

/**
 * Compute a single image embedding via the Voyage AI API.
 *
 * @param input - image to embed, in any supported format
 *
 * @param config - client configuration
 *
 * @returns embedding vector and usage metadata
 *
 * @example
 * ```ts
 * const { embedding } = await voyageEmbed({ input: { path: './photo.png' }, config: {} });
 * ```
 */
async function voyageEmbed({
  input,
  config,
}: {
  input: ImageInput;
  config: ImageDiffConfig;
},): Promise<EmbeddingResult> {
  const rl = tagged({
    tag: voyageEmbed.name,
    l,
  },);
  rl.debug('computing single image embedding via Voyage',);

  const apiKey = resolveVoyageApiKey(config.apiKey,);
  const model = (config.model as VoyageModel | undefined) ?? DEFAULT_VOYAGE_MODEL;
  const contentItem = await toVoyageContentItem(input,);

  const request: VoyageApiRequest = {
    inputs: [{ content: [contentItem,], },],
    model,
    input_type: 'document',
    truncation: true,
  };

  const response = await callVoyageApi({
    requestBody: request,
    apiKey,
  },);
  const firstData = response.data[0];
  if (firstData === undefined)
    throw new Error('Voyage API returned empty data array',);

  return {
    embedding: firstData.embedding,
    usage: {
      textTokens: response.usage.text_tokens,
      imagePixels: response.usage.image_pixels,
      totalTokens: response.usage.total_tokens,
    },
  };
}

/**
 * Compute embeddings for multiple images in a single batch via the Voyage AI API.
 *
 * @param inputs - array of images to embed
 *
 * @param config - client configuration
 *
 * @returns embedding vectors (in input order) and aggregate usage metadata
 *
 * @example
 * ```ts
 * const { embeddings } = await voyageEmbedBatch({
 *   inputs: [{ path: 'a.png' }, { path: 'b.png' }],
 *   config: {},
 * });
 * ```
 */
async function voyageEmbedBatch({
  inputs,
  config,
}: {
  inputs: readonly ImageInput[];
  config: ImageDiffConfig;
},): Promise<BatchEmbeddingResult> {
  const rl = tagged({
    tag: voyageEmbedBatch.name,
    l,
  },);
  rl.debug(
    `computing batch embeddings via Voyage for ${String(inputs.length,)} image(s)`,
  );

  const apiKey = resolveVoyageApiKey(config.apiKey,);
  const model = (config.model as VoyageModel | undefined) ?? DEFAULT_VOYAGE_MODEL;

  const contentItems = await Promise.all(
    inputs.map(function convertInput(input,) {
      return toVoyageContentItem(input,);
    },),
  );

  const request: VoyageApiRequest = {
    inputs: contentItems.map(function wrapContent(item,) {
      return { content: [item,], };
    },),
    model,
    input_type: 'document',
    truncation: true,
  };

  const response = await callVoyageApi({
    requestBody: request,
    apiKey,
  },);

  /** Sort by index to guarantee input order. */
  const sorted = [...response.data,].toSorted(function byIndex(
    a,
    b,
  ) {
    return a.index - b.index;
  },);

  return {
    embeddings: sorted.map(function extractEmbedding(d,) {
      return d.embedding;
    },),
    usage: {
      textTokens: response.usage.text_tokens,
      imagePixels: response.usage.image_pixels,
      totalTokens: response.usage.total_tokens,
    },
  };
}

/**
 * Voyage AI embedding provider.
 * Implements the {@link EmbeddingProvider} interface for the Voyage multimodal API.
 *
 * @example
 * ```ts
 * const result = await voyageProvider.embed({ path: 'photo.png' }, {});
 * ```
 */
export const voyageProvider: EmbeddingProvider = {
  embed: voyageEmbed,
  embedBatch: voyageEmbedBatch,
};
