// oxlint-disable typescript/no-unsafe-type-assertion, require-await -- Promise.allSettled values require type assertions; async functions return provider promises directly
import type {
  BatchEmbeddingResult,
  ComparisonResult,
  EmbeddingResult,
  ImageInput,
  Provider,
} from './types.ts';
import { compareEmbeddings, embed, embedBatch } from './client.ts';
import { describeImageDifference } from './describe.ts';
import { l, tagged } from './log.ts';

/**
 * All available provider names, used when dispatching to all providers.
 */
const ALL_PROVIDERS: readonly Provider[] = ['voyage', 'gemini'];

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
 *
 * @param imageB - second image
 *
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
): Promise<readonly MultiProviderComparisonEntry[]> {
  const rl = tagged({ tag: compareAll.name, l });
  rl.debug(`comparing two images across all ${String(ALL_PROVIDERS.length)} providers with description`);

  const allResults = await Promise.allSettled([
    ...ALL_PROVIDERS.map(async function compareWithProvider(provider) {
      const result = await compareEmbeddings(imageA, imageB, { provider });
      return { provider, result };
    }),
    describeImageDifference(imageA, imageB),
  ]);

  /** Last settlement is the description call. */
  const descriptionSettlement = allResults.at(-1);
  if (descriptionSettlement === undefined) throw new Error('unreachable — allResults is non-empty');
  const description = descriptionSettlement.status === 'fulfilled'
    ? descriptionSettlement.value as string | undefined
    : undefined;

  /** All settlements before the last are provider results. */
  const providerSettlements = allResults.slice(0, -1);
  const successfulEntries: MultiProviderComparisonEntry[] = [];
  for (const settlement of providerSettlements) {
    if (settlement.status === 'fulfilled') {
      const entry = settlement.value as { provider: Provider; result: Omit<ComparisonResult, 'description'> };
      successfulEntries.push({
        provider: entry.provider,
        result: { ...entry.result, description },
      });
    } else {
      rl.debug(`provider skipped: ${String(settlement.reason)}`);
    }
  }

  if (successfulEntries.length === 0 && description === undefined) {
    throw new Error(
      'No results: all embedding providers failed and no description was generated. Check that at least one API key is configured.',
    );
  }

  rl.debug(`${String(successfulEntries.length)} provider(s) succeeded, description ${description !== undefined ? 'available' : 'unavailable'}`);
  return successfulEntries;
}

/**
 * Embed a single image using all available providers concurrently.
 * Each provider uses its own API key (from env vars) and default latest model.
 *
 * @param input - image to embed
 *
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
): Promise<readonly MultiProviderEmbedEntry[]> {
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
 *
 * @returns array of results, one per provider
 *
 * @example
 * ```ts
 * const results = await embedBatchAll([{ path: 'a.png' }, { path: 'b.png' }]);
 * ```
 */
export async function embedBatchAll(
  inputs: readonly ImageInput[],
): Promise<readonly MultiProviderBatchEmbedEntry[]> {
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
