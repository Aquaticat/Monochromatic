// oxlint-disable typescript/no-unsafe-type-assertion, prefer-destructuring -- API response types require assertions
import type {
  BatchEmbeddingResult,
  EmbeddingProvider,
  EmbeddingResult,
  ImageDiffConfig,
  ImageInput,
  VoyageApiRequest,
  VoyageApiResponse,
  VoyageModel,
} from './types.ts';
import { toVoyageContentItem } from './encoding.ts';
import { l, tagged } from './log.ts';

/**
 * Voyage AI multimodal embeddings API endpoint.
 */
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/multimodalembeddings';

/**
 * Default Voyage model -- latest and highest quality.
 */
const DEFAULT_VOYAGE_MODEL: VoyageModel = 'voyage-multimodal-3.5';

/**
 * Resolve the Voyage AI API key from config or environment.
 *
 * @param configKey - explicitly provided API key, if any
 *
 * @returns resolved API key
 *
 * @throws when no API key is available from either source
 *
 * @example
 * ```ts
 * const key = resolveVoyageApiKey(undefined);
 * ```
 */
function resolveVoyageApiKey(configKey: string | undefined): string {
  const rl = tagged({ tag: resolveVoyageApiKey.name, l });
  const key = configKey ?? process.env['IMAGE_DIFF_VOYAGE_API_KEY'] ?? process.env['VOYAGE_API_KEY'];
  if (key === undefined || key === '') {
    throw new Error(
      'Voyage AI API key is required. Provide it via config.apiKey or set IMAGE_DIFF_VOYAGE_API_KEY (or VOYAGE_API_KEY) environment variable.',
    );
  }
  rl.debug('Voyage API key resolved');
  return key;
}

/**
 * Send a request to the Voyage AI multimodal embeddings API.
 *
 * @param requestBody - serializable request payload
 *
 * @param apiKey - Voyage AI API key for authorization
 *
 * @returns parsed API response
 *
 * @throws on non-OK HTTP status with the error body
 *
 * @example
 * ```ts
 * const response = await callVoyageApi(request, 'pa-...');
 * ```
 */
async function callVoyageApi(requestBody: VoyageApiRequest, apiKey: string): Promise<VoyageApiResponse> {
  const rl = tagged({ tag: callVoyageApi.name, l });

  rl.debug(`calling Voyage API with model "${requestBody.model}", ${String(requestBody.inputs.length)} input(s)`);

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    rl.error(`API returned ${String(response.status)}: ${errorBody}`);
    throw new Error(`Voyage AI API error (${String(response.status)}): ${errorBody}`);
  }

  const result = await response.json() as VoyageApiResponse;
  rl.debug(`received ${String(result.data.length)} embedding(s), total tokens: ${String(result.usage.total_tokens)}`);
  return result;
}

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
 * const { embedding } = await voyageEmbed({ path: './photo.png' }, {});
 * ```
 */
async function voyageEmbed(input: ImageInput, config: ImageDiffConfig): Promise<EmbeddingResult> {
  const rl = tagged({ tag: voyageEmbed.name, l });
  rl.debug('computing single image embedding via Voyage');

  const apiKey = resolveVoyageApiKey(config.apiKey);
  const model = (config.model as VoyageModel | undefined) ?? DEFAULT_VOYAGE_MODEL;
  const contentItem = await toVoyageContentItem(input);

  const request: VoyageApiRequest = {
    inputs: [{ content: [contentItem] }],
    model,
    input_type: 'document',
    truncation: true,
  };

  const response = await callVoyageApi(request, apiKey);
  const firstData = response.data[0];
  if (firstData === undefined) {
    throw new Error('Voyage API returned empty data array');
  }

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
 * const { embeddings } = await voyageEmbedBatch([{ path: 'a.png' }, { path: 'b.png' }], {});
 * ```
 */
async function voyageEmbedBatch(
  inputs: readonly ImageInput[],
  config: ImageDiffConfig,
): Promise<BatchEmbeddingResult> {
  const rl = tagged({ tag: voyageEmbedBatch.name, l });
  rl.debug(`computing batch embeddings via Voyage for ${String(inputs.length)} image(s)`);

  const apiKey = resolveVoyageApiKey(config.apiKey);
  const model = (config.model as VoyageModel | undefined) ?? DEFAULT_VOYAGE_MODEL;

  const contentItems = await Promise.all(
    inputs.map(function convertInput(input) {
      return toVoyageContentItem(input);
    }),
  );

  const request: VoyageApiRequest = {
    inputs: contentItems.map(function wrapContent(item) {
      return { content: [item] };
    }),
    model,
    input_type: 'document',
    truncation: true,
  };

  const response = await callVoyageApi(request, apiKey);

  /** Sort by index to guarantee input order. */
  const sorted = [...response.data].toSorted(function byIndex(a, b) {
    return a.index - b.index;
  });

  return {
    embeddings: sorted.map(function extractEmbedding(d) {
      return d.embedding;
    }),
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
