import {
  hyperIsDry,
  syntheticIsDry,
} from '../budget-routing.ts';
import { createHyperClient, } from '../hyper-client.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';
import type { ModelTransport, } from '../synthetic-transport.ts';

//region Required providers for measured arms

/**
 * Provider identities validation arm may require before calls.
 */
export type RequiredProvider = 'synthetic' | 'hyper';

/**
 * CLI token selecting required provider set.
 */
const REQUIRED_PROVIDERS_FLAG = '--require-providers';

/**
 * Array index result when flag is absent.
 */
const FLAG_NOT_FOUND = -1;

/**
 * Raised before model calls when measured arm provider requirement is not wet.
 *
 * @example
 * ```ts
 * throw new RequiredProviderError({ provider: 'hyper', reason: 'key missing', });
 * ```
 */
export class RequiredProviderError extends StatedRefusalError {
  /**
   * Declares message safe because provider and reason are closed vocabulary.
   */
  override readonly messageNamesOnly: true = true;

  /**
   * Constructs provider requirement refusal.
   *
   * @param provider - required provider
   *
   * @param reason - closed launch reason
   *
   * @example
   * ```ts
   * new RequiredProviderError({ provider, reason: 'budget dry', });
   * ```
   */
  public constructor(
    {
      provider,
      reason,
    }: {
      readonly provider: RequiredProvider;
      readonly reason: 'budget dry' | 'key missing' | 'meter unavailable';
    },
  ) {
    super({ says: `required provider ${provider} is not ready: ${reason}`, },);
    this.name = 'RequiredProviderError';
  }
}

/**
 * Whether CLI value names supported provider.
 *
 * @param value - untrusted comma-split value
 *
 * @returns Whether value is required provider identity
 *
 * @example
 * ```ts
 * if (isRequiredProvider(value)) use(value);
 * ```
 */
function isRequiredProvider(value: string,): value is RequiredProvider {
  return (value === 'synthetic') || (value === 'hyper');
}

/**
 * Parses measured-arm provider requirement from CLI.
 *
 * @param argv - process arguments after executable and entrypoint included
 *
 * @returns Required providers in caller order without duplicates
 *
 * @throws {@link StatedRefusalError} when flag value is missing or unknown
 *
 * @example
 * ```ts
 * const required = readRequiredProviders({ argv: ['node', 'pass', '--require-providers', 'synthetic,hyper'], });
 * ```
 */
export function readRequiredProviders(
  { argv, }: { readonly argv: readonly string[]; },
): readonly RequiredProvider[] {
  /**
   * Flag position in argument list.
   */
  const at = argv.indexOf(REQUIRED_PROVIDERS_FLAG,);
  if (at === FLAG_NOT_FOUND)
    return [];
  /**
   * Comma-separated provider value after flag.
   */
  const value = argv.at(at + 1,);
  if ((value === undefined) || (value === ''))
    throw new StatedRefusalError({
      says: `${REQUIRED_PROVIDERS_FLAG} needs synthetic, hyper, or both`,
    },);
  /**
   * Parsed provider names before stable deduplication.
   */
  const parsedProviders = value
    .split(',',)
    .map(function parseProvider(provider,): RequiredProvider {
      if (isRequiredProvider(provider,))
        return provider;
      throw new StatedRefusalError({
        says: `${REQUIRED_PROVIDERS_FLAG} accepts only synthetic and hyper`,
      },);
    },);
  return parsedProviders.filter(function unique(
    provider,
    index,
  ): boolean {
    return parsedProviders.indexOf(provider,) === index;
  },);
}

/**
 * Requires selected provider keys and live non-dry meters before model calls.
 *
 * Ordinary runs pass empty requirement and retain one-provider behavior.
 * Validation and performance arms pass both providers explicitly.
 *
 * @param required - providers measured arm requires wet
 *
 * @param transport - optional HTTP seam for tests
 *
 * @param signal - meter cancellation
 *
 * @throws {@link RequiredProviderError} before model call when requirement fails
 *
 * @example
 * ```ts
 * await assertRequiredProvidersReady({ required: ['synthetic', 'hyper'], signal, });
 * ```
 */
export async function assertRequiredProvidersReady(
  {
    required,
    transport,
    signal,
  }: {
    readonly required: readonly RequiredProvider[];
    readonly transport?: ModelTransport;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  if (required.length === 0)
    return;
  /**
   * Process environment read once for configured key names.
   */
  const environment = process.env;
  /**
   * Synthetic key read without exposing value.
   */
  const syntheticKey = environment.TRANSLATION_REPAIR_SYNTHETIC_API_KEY ?? '';
  /**
   * Hyper key read without exposing value.
   */
  const hyperKey = environment.TRANSLATION_REPAIR_CHARM_HYPER_API_KEY ?? '';
  if (required.includes('synthetic',) && (syntheticKey === '')) {
    throw new RequiredProviderError({
      provider: 'synthetic',
      reason: 'key missing',
    },);
  }
  if (required.includes('hyper',) && (hyperKey === '')) {
    throw new RequiredProviderError({
      provider: 'hyper',
      reason: 'key missing',
    },);
  }
  /**
   * Optional transport forwarded only in tests.
   */
  const seam = (transport === undefined) ? {} : { transport, };
  await Promise.all(required.map(async function checkProvider(provider,): Promise<void> {
    if (provider === 'synthetic') {
      try {
        /**
         * Required Synthetic meter client.
         */
        const client = createSyntheticClient({
          apiKey: syntheticKey,
          ...seam,
        },);
        /**
         * Live quota used for wetness gate.
         */
        const quota = await client.quotas({ signal, },);
        if (syntheticIsDry({ quota, })) {
          throw new RequiredProviderError({
            provider,
            reason: 'budget dry',
          },);
        }
        return;
      }
      catch (error) {
        if (error instanceof RequiredProviderError)
          throw error;
        throw new RequiredProviderError({
          provider,
          reason: 'meter unavailable',
        },);
      }
    }
    try {
      /**
       * Required Hyper meter client.
       */
      const client = createHyperClient({
        apiKey: hyperKey,
        ...seam,
      },);
      /**
       * Live credits used for wetness gate.
       */
      const credits = await client.credits({ signal, },);
      if (hyperIsDry({ credits, })) {
        throw new RequiredProviderError({
          provider,
          reason: 'budget dry',
        },);
      }
    }
    catch (error) {
      if (error instanceof RequiredProviderError)
        throw error;
      throw new RequiredProviderError({
        provider,
        reason: 'meter unavailable',
      },);
    }
  },),);
}

//endregion Required providers for measured arms
