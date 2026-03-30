/**
 * Multi-provider comparison that dispatches to all embedding providers
 * concurrently and combines results with an optional visual description.
 *
 * @module
 */
// oxlint-disable typescript/no-unsafe-type-assertion -- Promise.allSettled values require type assertions
import type { MultiProviderComparisonEntry, } from './client.multi.types.ts';
import { compareEmbeddings, } from './client.ts';
import { describeImageDifference, } from './describe.ts';
import {
  l,
  tagged,
} from './log.ts';
import type {
  ComparisonResult,
  ImageInput,
  Provider,
} from './types.ts';

/**
 * All available provider names, used when dispatching to all providers.
 */
const ALL_PROVIDERS: readonly Provider[] = [
  'voyage',
  'gemini',
];

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
  const rl = tagged({
    tag: compareAll.name,
    l,
  },);
  rl.debug(
    `comparing two images across all ${
      String(ALL_PROVIDERS.length,)
    } providers with description`,
  );

  const allResults = await Promise.allSettled([
    ...ALL_PROVIDERS.map(async function compareWithProvider(provider,) {
      const result = await compareEmbeddings(
        imageA,
        imageB,
        { provider, },
      );
      return {
        provider,
        result,
      };
    },),
    describeImageDifference(
      imageA,
      imageB,
    ),
  ],);

  /** Last settlement is the description call. */
  const descriptionSettlement = allResults.at(-1,);
  if (descriptionSettlement === undefined)
    throw new Error('unreachable — allResults is non-empty',);
  const description = descriptionSettlement.status === 'fulfilled'
    ? descriptionSettlement.value as string | undefined
    : undefined;

  /** All settlements before the last are provider results. */
  const providerSettlements = allResults.slice(
    0,
    -1,
  );
  const successfulEntries: MultiProviderComparisonEntry[] = [];
  for (const settlement of providerSettlements) {
    if (settlement.status === 'fulfilled') {
      const entry = settlement.value as {
        provider: Provider;
        result: Omit<ComparisonResult, 'description'>;
      };
      successfulEntries.push({
        provider: entry.provider,
        result: {
          ...entry.result,
          description,
        },
      },);
    }
    else {
      rl.debug(`provider skipped: ${String(settlement.reason,)}`,);
    }
  }

  if (successfulEntries.length === 0 && description === undefined) {
    throw new Error(
      'No results: all embedding providers failed and no description was generated. Check that at least one API key is configured.',
    );
  }

  rl.debug(
    `${String(successfulEntries.length,)} provider(s) succeeded, description ${
      description !== undefined ? 'available' : 'unavailable'
    }`,
  );
  return successfulEntries;
}
