import {
  hyperIsDry,
  openRouterIsDry,
  syntheticIsDry,
} from '../budget-routing.ts';
import { createHyperClient, } from '../hyper-client.ts';
import { createOpenRouterClient, } from '../openrouter-client.ts';
import {
  isProviderName,
  PROVIDER_ORDER,
  type ProviderName,
} from '../provider-name.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';
import type { ModelTransport, } from '../synthetic-transport.ts';

//region Required providers for measured arms

/**
 * Provider identities a validation arm may require before calls.
 */
export type RequiredProvider = ProviderName;

/**
 * CLI token selecting required provider set.
 */
const REQUIRED_PROVIDERS_FLAG = '--require-providers';

/**
 * Array index result when flag is absent.
 */
const FLAG_NOT_FOUND = -1;

/**
 * Environment variable carrying each provider's key.
 */
const KEY_VARIABLES: Readonly<Record<ProviderName, string>> = {
  synthetic: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY',
  hyper: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
  openrouter: 'TRANSLATION_REPAIR_OPENROUTER_API_KEY',
};

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
      says: `${REQUIRED_PROVIDERS_FLAG} needs one or more of ${PROVIDER_ORDER.join(', ',)}`,
    },);
  /**
   * Parsed provider names before stable deduplication.
   */
  const parsedProviders = value
    .split(',',)
    .map(function parseProvider(provider,): RequiredProvider {
      if (isProviderName(provider,))
        return provider;
      throw new StatedRefusalError({
        says: `${REQUIRED_PROVIDERS_FLAG} accepts only ${PROVIDER_ORDER.join(', ',)}`,
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
 * Reads one provider's meter and refuses when it is dry or unreadable.
 *
 * @param provider - provider being gated
 *
 * @param readDry - live meter read answering whether the provider is dry
 *
 * @throws {@link RequiredProviderError} when the meter reads dry or cannot be read
 *
 * @example
 * ```ts
 * await gateProvider({ provider: 'hyper', readDry, },);
 * ```
 */
async function gateProvider(
  {
    provider,
    readDry,
  }: {
    readonly provider: ProviderName;
    readonly readDry: () => Promise<boolean>;
  },
): Promise<void> {
  /**
   * Whether the live meter reads dry, or that it could not be read.
   */
  const dry = await (async function read(): Promise<boolean | 'unreadable'> {
    try {
      return await readDry();
    } catch (error) {
      if (error instanceof RequiredProviderError)
        throw error;
      return 'unreadable';
    }
  })();
  if (dry === 'unreadable')
    throw new RequiredProviderError({
      provider,
      reason: 'meter unavailable',
    },);
  if (dry)
    throw new RequiredProviderError({
      provider,
      reason: 'budget dry',
    },);
}

/**
 * Requires selected provider keys and live non-dry meters before model calls.
 *
 * Ordinary runs pass empty requirement and retain any-provider behavior.
 * Validation and performance arms name the providers they require explicitly.
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
   * Each required provider's key, read without exposing its value.
   */
  const keys = required.map(function keyOf(provider,): {
    readonly provider: ProviderName;
    readonly key: string;
  } {
    return {
      provider,
      key: environment[KEY_VARIABLES[provider]] ?? '',
    };
  },);
  for (const { provider, key, } of keys) {
    if (key === '')
      throw new RequiredProviderError({
        provider,
        reason: 'key missing',
      },);
  }
  /**
   * Optional transport forwarded only in tests.
   */
  const seam = (transport === undefined) ? {} : { transport, };
  await Promise.all(keys.map(async function checkProvider({
    provider,
    key,
  },): Promise<void> {
    if (provider === 'synthetic') {
      /**
       * Required Synthetic meter client.
       */
      const client = createSyntheticClient({
        apiKey: key,
        ...seam,
      },);
      await gateProvider({
        provider,
        readDry: async function readQuota(): Promise<boolean> {
          return syntheticIsDry({ quota: await client.quotas({ signal, },), },);
        },
      },);
      return;
    }
    if (provider === 'hyper') {
      /**
       * Required Hyper meter client.
       */
      const client = createHyperClient({
        apiKey: key,
        ...seam,
      },);
      await gateProvider({
        provider,
        readDry: async function readCredits(): Promise<boolean> {
          return hyperIsDry({ credits: await client.credits({ signal, },), },);
        },
      },);
      return;
    }
    /**
     * Required OpenRouter meter client.
     */
    const client = createOpenRouterClient({
      apiKey: key,
      ...seam,
    },);
    await gateProvider({
      provider,
      readDry: async function readOpenRouterCredits(): Promise<boolean> {
        return openRouterIsDry({ credits: await client.credits({ signal, },), },);
      },
    },);
  },),);
}

//endregion Required providers for measured arms
