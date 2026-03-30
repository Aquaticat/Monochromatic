// oxlint-disable typescript/no-unsafe-type-assertion, require-await -- Promise.allSettled values require type assertions; async functions return provider promises directly
import { describeImageDifference, } from './describe.ts';
import { geminiProvider, } from './gemini.ts';
import {
  l,
  tagged,
} from './log.ts';
import { dotProduct, } from './similarity.ts';
import type {
  BatchEmbeddingResult,
  ComparisonResult,
  EmbeddingProvider,
  EmbeddingResult,
  ImageDiffConfig,
  ImageInput,
  Provider,
} from './types.ts';
import { voyageProvider, } from './voyage.ts';

/**
 * Registry mapping provider names to their implementations.
 */
const PROVIDERS: Record<Provider, EmbeddingProvider> = {
  voyage: voyageProvider,
  gemini: geminiProvider,
};

/**
 * Resolve a single provider from config.
 *
 * @param provider - provider name
 *
 * @returns provider implementation
 *
 * @example
 * ```ts
 * const p = getProvider('voyage');
 * ```
 */
function getProvider(provider: Provider,): EmbeddingProvider {
  return PROVIDERS[provider];
}

/**
 * Compute a multimodal embedding for a single image via the specified provider.
 * When no provider is specified, defaults to Voyage.
 *
 * @param input - image to embed, in any supported format
 *
 * @param config - optional client configuration (provider, API key, model)
 *
 * @returns embedding vector and usage metadata
 *
 * @example
 * ```ts
 * const { embedding } = await embed({ path: './photo.png' });
 * const geminiResult = await embed({ path: './photo.png' }, { provider: 'gemini' });
 * ```
 */
export async function embed(
  input: ImageInput,
  config: ImageDiffConfig = {},
): Promise<EmbeddingResult> {
  const provider = config.provider ?? 'voyage';
  return getProvider(provider,).embed(
    input,
    config,
  );
}

/**
 * Compute multimodal embeddings for multiple images in a single batch API call.
 * When no provider is specified, defaults to Voyage.
 *
 * @param inputs - array of images to embed
 *
 * @param config - optional client configuration (provider, API key, model)
 *
 * @returns embedding vectors (in input order) and aggregate usage metadata
 *
 * @example
 * ```ts
 * const { embeddings } = await embedBatch([
 *   { path: './before.png' },
 *   { path: './after.png' },
 * ]);
 * ```
 */
export async function embedBatch(
  inputs: readonly ImageInput[],
  config: ImageDiffConfig = {},
): Promise<BatchEmbeddingResult> {
  const provider = config.provider ?? 'voyage';
  return getProvider(provider,).embedBatch(
    inputs,
    config,
  );
}

/**
 * Embedding-only comparison without the natural-language description.
 * Used internally by {@link compare} and by the multi-provider comparison
 * to avoid duplicate description calls.
 *
 * @param imageA - first image
 *
 * @param imageB - second image
 *
 * @param config - client configuration (provider, API key, model)
 *
 * @returns similarity, distance, and both embedding vectors (no description)
 */
export async function compareEmbeddings(
  imageA: ImageInput,
  imageB: ImageInput,
  config: ImageDiffConfig = {},
): Promise<Omit<ComparisonResult, 'description'>> {
  const rl = tagged({
    tag: compareEmbeddings.name,
    l,
  },);
  const provider = config.provider ?? 'voyage';
  rl.debug(`comparing embeddings via ${provider}`,);

  const { embeddings, } = await getProvider(provider,).embedBatch(
    [imageA, imageB,],
    config,
  );
  const [embeddingA, embeddingB,] = embeddings;
  if (embeddingA === undefined || embeddingB === undefined)
    throw new Error('Expected exactly 2 embeddings from batch call',);

  const similarity = dotProduct(
    embeddingA,
    embeddingB,
  );
  const distance = 1 - similarity;

  rl.debug(
    `embedding comparison complete (${provider}): similarity=${
      String(similarity,)
    }, distance=${String(distance,)}`,
  );

  return {
    similarity,
    distance,
    embeddingA,
    embeddingB,
  };
}

/**
 * Compare two images using a single provider by computing their multimodal embeddings
 * and returning cosine similarity, perceptual distance, and a natural-language
 * description of the visual differences via Gemini 3.1 Pro Preview.
 * When no provider is specified, defaults to Voyage.
 *
 * @param imageA - first image
 *
 * @param imageB - second image
 *
 * @param config - optional client configuration (provider, API key, model)
 *
 * @returns similarity score, distance, both embedding vectors, and description
 *
 * @example
 * ```ts
 * const result = await compare(
 *   { path: './before.png' },
 *   { path: './after.png' },
 * );
 * console.log(result.description);
 * ```
 */
export async function compare(
  imageA: ImageInput,
  imageB: ImageInput,
  config: ImageDiffConfig = {},
): Promise<ComparisonResult> {
  const rl = tagged({
    tag: compare.name,
    l,
  },);
  rl.debug('running embedding comparison and description concurrently',);

  const results = await Promise.all([
    compareEmbeddings(
      imageA,
      imageB,
      config,
    ),
    describeImageDifference(
      imageA,
      imageB,
    ),
  ],);
  const [embeddingResult, description,] = results;
  if (description === undefined) {
    throw new Error(
      'OpenRouter API key is required for image comparison. Set IMAGE_DIFF_OPENROUTER_API_KEY (or OPENROUTER_API_KEY) environment variable.',
    );
  }

  rl.debug('comparison with description complete',);

  return {
    ...embeddingResult,
    description,
  };
}
