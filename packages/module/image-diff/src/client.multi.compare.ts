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
 * const results = await compareAll({
 *   imageA: { path: './before.png' },
 *   imageB: { path: './after.png' },
 * });
 * for (const { provider, result } of results) {
 *   console.log(`${provider}: similarity=${result.similarity}`);
 * }
 * ```
 */
export async function compareAll({
  imageA,
  imageB,
}: {
  readonly imageA: ImageInput;
  readonly imageB: ImageInput;
},): Promise<readonly MultiProviderComparisonEntry[]> {
  /** Logger pre-tagged with this function's name so call-site context is preserved across debug lines. */
  const rl = tagged({
    tag: compareAll.name,
    l,
  },);
  rl.debug(
    `comparing two images across all ${
      String(ALL_PROVIDERS.length,)
    } providers with description`,
  );

  /**
   * All concurrent settlements: one per provider comparison, plus the description call appended last.
   *
   * `allSettled` over `all` so a single provider's failure (missing API key, transport error) does
   * not abort the others; downstream code filters fulfilled entries and falls back gracefully.
   */
  const allResults = await Promise.allSettled([
    ...ALL_PROVIDERS.map(async function compareWithProvider(provider,) {
      /** Single-provider embedding comparison; paired with the provider name in the returned entry. */
      const result = await compareEmbeddings({
        imageA,
        imageB,
        config: { provider, },
      },);
      return {
        provider,
        result,
      };
    },),
    describeImageDifference({
      imageA,
      imageB,
    },),
  ],);

  /** Last settlement is the description call. */
  const descriptionSettlement = allResults.at(-1,);
  if (descriptionSettlement === undefined)
    throw new Error('unreachable: allResults is non-empty',);
  /** Textual diff description when the description call succeeded; `null` on rejection. */
  const description = descriptionSettlement.status
    === 'fulfilled'
    ? descriptionSettlement.value as string | null
    : null;

  /** All settlements before the last are provider results. */
  const providerSettlements = allResults.slice(
    0,
    -1,
  );
  /** Collected per-provider comparison entries that resolved successfully; rejections are logged and skipped. */
  const successfulEntries: MultiProviderComparisonEntry[] = [];
  for (const settlement of providerSettlements) {
    if (settlement.status
      === 'fulfilled') {
      /** Fulfilled settlement value reshaped via assertion; `allSettled` returns `unknown` for tuple inputs. */
      const entry = settlement.value as {
        provider: Provider;
        result: Omit<ComparisonResult, 'description'>;
      };
      successfulEntries.push({
        provider: entry.provider,
        result: {
          ...entry.result,
          ...(description !== null ? { description, } : {}),
        },
      },);
    }
    else {
      rl.debug(`provider skipped: ${String(settlement.reason,)}`,);
    }
  }

  if ((successfulEntries.length
    === 0) && (description === null)) {
    throw new Error(
      'No results: all embedding providers failed and no description was generated. Check that at least one API key is configured.',
    );
  }

  rl.debug(
    `${String(successfulEntries.length,)} provider(s) succeeded, description ${
      description !== null ? 'available' : 'unavailable'
    }`,
  );
  return successfulEntries;
}
