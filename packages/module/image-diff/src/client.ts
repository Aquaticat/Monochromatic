import type {
  BatchEmbeddingResult,
  ComparisonResult,
  EmbeddingProvider,
  EmbeddingResult,
  ImageDiffConfig,
  ImageInput,
  Provider,
} from './types.ts';
import { voyageProvider } from './voyage.ts';
import { geminiProvider } from './gemini.ts';
import { dotProduct } from './similarity.ts';
import { l, tagged } from './log.ts';

/**
 * Registry mapping provider names to their implementations.
 */
const PROVIDERS: Record<Provider, EmbeddingProvider> = {
  voyage: voyageProvider,
  gemini: geminiProvider,
};

/**
 * All available provider names, used when dispatching to all providers.
 */
const ALL_PROVIDERS: ReadonlyArray<Provider> = ['voyage', 'gemini'];

/**
 * Resolve a single provider from config.
 *
 * @param provider - provider name
 * @returns provider implementation
 *
 * @example
 * ```ts
 * const p = getProvider('voyage');
 * ```
 */
function getProvider(provider: Provider): EmbeddingProvider {
  return PROVIDERS[provider];
}

//region Single-provider functions

/**
 * Compute a multimodal embedding for a single image via the specified provider.
 * When no provider is specified, defaults to Voyage.
 *
 * @param input - image to embed, in any supported format
 * @param config - optional client configuration (provider, API key, model)
 * @returns embedding vector and usage metadata
 *
 * @example
 * ```ts
 * const { embedding } = await embed({ path: './photo.png' });
 * const geminiResult = await embed({ path: './photo.png' }, { provider: 'gemini' });
 * ```
 */
export async function embed(input: ImageInput, config: ImageDiffConfig = {}): Promise<EmbeddingResult> {
  const provider = config.provider ?? 'voyage';
  return getProvider(provider).embed(input, config);
}

/**
 * Compute multimodal embeddings for multiple images in a single batch API call.
 * When no provider is specified, defaults to Voyage.
 *
 * @param inputs - array of images to embed
 * @param config - optional client configuration (provider, API key, model)
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
  inputs: ReadonlyArray<ImageInput>,
  config: ImageDiffConfig = {},
): Promise<BatchEmbeddingResult> {
  const provider = config.provider ?? 'voyage';
  return getProvider(provider).embedBatch(inputs, config);
}

/**
 * Compare two images using a single provider by computing their multimodal embeddings
 * and returning cosine similarity and perceptual distance.
 * When no provider is specified, defaults to Voyage.
 *
 * @param imageA - first image
 * @param imageB - second image
 * @param config - optional client configuration (provider, API key, model)
 * @returns similarity score, distance, and both embedding vectors
 *
 * @example
 * ```ts
 * const result = await compare(
 *   { path: './before.png' },
 *   { path: './after.png' },
 * );
 * ```
 */
export async function compare(
  imageA: ImageInput,
  imageB: ImageInput,
  config: ImageDiffConfig = {},
): Promise<ComparisonResult> {
  const rl = tagged({ tag: compare.name, l });
  const provider = config.provider ?? 'voyage';
  rl.debug(`comparing two images via ${provider}`);

  const { embeddings } = await getProvider(provider).embedBatch([imageA, imageB], config);
  const embeddingA = embeddings[0];
  const embeddingB = embeddings[1];
  if (embeddingA === undefined || embeddingB === undefined) {
    throw new Error('Expected exactly 2 embeddings from batch call');
  }

  const similarity = dotProduct(embeddingA, embeddingB);
  const distance = 1 - similarity;

  rl.debug(`comparison complete (${provider}): similarity=${String(similarity)}, distance=${String(distance)}`);

  return { similarity, distance, embeddingA, embeddingB };
}

//endregion Single-provider functions

//region Multi-provider functions

/**
 * Result from a single provider in a multi-provider comparison.
 *
 * @example
 * ```ts
 * for (const entry of results) {
 *   console.log(`${entry.provider}: similarity=${entry.result.similarity}`);
 * }
 * ```
 */
export type MultiProviderComparisonEntry = {
  /** Provider that produced this result. */
  readonly provider: Provider;
  /** Comparison result from this provider. */
  readonly result: ComparisonResult;
};

/**
 * Result from a single provider in a multi-provider embed call.
 *
 * @example
 * ```ts
 * for (const entry of results) {
 *   console.log(`${entry.provider}: ${entry.result.embedding.length} dims`);
 * }
 * ```
 */
export type MultiProviderEmbedEntry = {
  /** Provider that produced this result. */
  readonly provider: Provider;
  /** Embedding result from this provider. */
  readonly result: EmbeddingResult;
};

/**
 * Result from a single provider in a multi-provider batch embed call.
 *
 * @example
 * ```ts
 * for (const entry of results) {
 *   console.log(`${entry.provider}: ${entry.result.embeddings.length} embeddings`);
 * }
 * ```
 */
export type MultiProviderBatchEmbedEntry = {
  /** Provider that produced this result. */
  readonly provider: Provider;
  /** Batch embedding result from this provider. */
  readonly result: BatchEmbeddingResult;
};

/**
 * Compare two images using all available providers concurrently.
 * Each provider uses its own API key (from env vars) and default latest model.
 *
 * @param imageA - first image
 * @param imageB - second image
 * @returns array of results, one per provider
 *
 * @example
 * ```ts
 * const results = await compareAll(
 *   { path: './before.png' },
 *   { path: './after.png' },
 * );
 * for (const { provider, result } of results) {
 *   console.log(`${provider}: similarity=${result.similarity}`);
 * }
 * ```
 */
export async function compareAll(
  imageA: ImageInput,
  imageB: ImageInput,
): Promise<ReadonlyArray<MultiProviderComparisonEntry>> {
  const rl = tagged({ tag: compareAll.name, l });
  rl.debug(`comparing two images across all ${String(ALL_PROVIDERS.length)} providers`);

  const results = await Promise.all(
    ALL_PROVIDERS.map(async function compareWithProvider(provider) {
      const result = await compare(imageA, imageB, { provider });
      return { provider, result };
    }),
  );

  rl.debug('all provider comparisons complete');
  return results;
}

/**
 * Embed a single image using all available providers concurrently.
 * Each provider uses its own API key (from env vars) and default latest model.
 *
 * @param input - image to embed
 * @returns array of results, one per provider
 *
 * @example
 * ```ts
 * const results = await embedAll({ path: './photo.png' });
 * for (const { provider, result } of results) {
 *   console.log(`${provider}: ${result.embedding.length} dimensions`);
 * }
 * ```
 */
export async function embedAll(
  input: ImageInput,
): Promise<ReadonlyArray<MultiProviderEmbedEntry>> {
  const rl = tagged({ tag: embedAll.name, l });
  rl.debug(`embedding image across all ${String(ALL_PROVIDERS.length)} providers`);

  const results = await Promise.all(
    ALL_PROVIDERS.map(async function embedWithProvider(provider) {
      const result = await embed(input, { provider });
      return { provider, result };
    }),
  );

  rl.debug('all provider embeddings complete');
  return results;
}

/**
 * Batch-embed multiple images using all available providers concurrently.
 * Each provider uses its own API key (from env vars) and default latest model.
 *
 * @param inputs - array of images to embed
 * @returns array of results, one per provider
 *
 * @example
 * ```ts
 * const results = await embedBatchAll([{ path: 'a.png' }, { path: 'b.png' }]);
 * ```
 */
export async function embedBatchAll(
  inputs: ReadonlyArray<ImageInput>,
): Promise<ReadonlyArray<MultiProviderBatchEmbedEntry>> {
  const rl = tagged({ tag: embedBatchAll.name, l });
  rl.debug(`batch embedding ${String(inputs.length)} image(s) across all ${String(ALL_PROVIDERS.length)} providers`);

  const results = await Promise.all(
    ALL_PROVIDERS.map(async function embedBatchWithProvider(provider) {
      const result = await embedBatch(inputs, { provider });
      return { provider, result };
    }),
  );

  rl.debug('all provider batch embeddings complete');
  return results;
}

//endregion Multi-provider functions
