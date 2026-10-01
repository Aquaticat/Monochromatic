import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  bedrockIsDry,
  hyperIsDry,
  openRouterIsDry,
  syntheticIsDry,
} from '../budget-routing.ts';
import { createBedrockClient, } from '../bedrock-client.ts';
import { bedrockLedgerFromEnv, } from '../bedrock-ledger.ts';
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
import { idListFlag, } from './command-flags.ts';
import type { ReadsFlag, } from './command-line-types.ts';

//region Required providers for measured arms

/**
 Provider identities a validation arm may require before calls.
 */
export type RequiredProvider = ProviderName;

/**
 CLI token selecting required provider set.
 */
const REQUIRED_PROVIDERS_FLAG = '--require-providers';

/**
 Environment variable carrying each provider's key.
 */
const KEY_VARIABLES: Readonly<Record<ProviderName, string>> = {
  synthetic: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY',
  hyper: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
  bedrock: 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY',
  openrouter: 'TRANSLATION_REPAIR_OPENROUTER_API_KEY',
};

/**
 Raised before model calls when measured arm provider requirement is not wet.
 
 @example
 ```ts
 throw new RequiredProviderError({ provider: 'hyper', reason: 'key missing', });
 ```
 */
export class RequiredProviderError extends StatedRefusalError {
  /**
   Declares message safe because provider and reason are closed vocabulary.
   */
  override readonly messageNamesOnly: true = true;

  /**
   Constructs provider requirement refusal.
   
   @param provider - required provider
   
   @param reason - closed launch reason
   
   @example
   ```ts
   new RequiredProviderError({ provider, reason: 'budget dry', });
   ```
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
 Parses measured-arm provider requirement from CLI.
 
 @param line - the pass's command line, read whole by `reportingRefusals`
 
 @returns Required providers in caller order without duplicates
 
 @throws {@link StatedRefusalError} when flag value names no provider or an
 unknown one
 
 @example
 ```ts
 const required = readRequiredProviders({ line, },);
 ```
 */
export function readRequiredProviders(
  { line, }: { readonly line: ReadsFlag<'require-providers'>; },
): readonly RequiredProvider[] {
  /**
   Parsed provider names before stable deduplication.
   */
  const parsedProviders = idListFlag({
    asked: line.flag('require-providers',),
    naming: `provider of ${PROVIDER_ORDER.join(', ',)}`,
  },)
    .map(function parseProvider(provider,): RequiredProvider {
      if (isProviderName(provider,))
        return provider;
      throw new StatedRefusalError({
        says: `${REQUIRED_PROVIDERS_FLAG} accepts only ${PROVIDER_ORDER.join(', ',)}, and ${
          JSON.stringify(provider,)
        } is none of them`,
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
 Reads one provider's meter and refuses when it is dry or unreadable.
 
 @param provider - provider being gated
 
 @param readDry - live meter read answering whether the provider is dry
 
 @throws {@link RequiredProviderError} when the meter reads dry or cannot be read
 
 @example
 ```ts
 await gateProvider({ provider: 'hyper', readDry, },);
 ```
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
   Whether the live meter reads dry, or that it could not be read.
   */
  const dry = await (async function read(): Promise<boolean | 'unreadable'> {
    try {
      return await readDry();
    } catch (error) {
      // Every meter failure refuses the arm alike, and the refusal names only
      // the provider, so what failed is written to the log here (ledger T8).
      /**
       Logger tagged with the gate's name.
       */
      const rl = tagged({ tag: gateProvider.name, },);
      rl.warn(`${provider} meter could not be read: ${caughtValueText(error,)}`,);
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
 Requires selected provider keys and live non-dry meters before model calls.
 
 Ordinary runs pass empty requirement and retain any-provider behavior.
 Validation and performance arms name the providers they require explicitly.
 
 @param required - providers measured arm requires wet

 @param env - environment the keys and the Bedrock ledger's place are read
 from: `process.env` in a run, a test's own otherwise

 @param transport - HTTP the meters are read over: `fetchTransport` in a run.
 Both are REQUIRED, since each reaches past the process (ledger M43, M68)

 @param signal - meter cancellation

 @throws {@link RequiredProviderError} before model call when requirement fails

 @example
 ```ts
 await assertRequiredProvidersReady({ required: ['synthetic', 'hyper'], env: process.env, transport: fetchTransport, signal, });
 ```
 */
export async function assertRequiredProvidersReady(
  {
    required,
    env,
    transport,
    signal,
  }: {
    readonly required: readonly RequiredProvider[];
    readonly env: Readonly<NodeJS.ProcessEnv>;
    readonly transport: ModelTransport;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  if (required.length === 0)
    return;
  /**
   Each required provider's key, read without exposing its value.
   */
  const keys = required.map(function keyOf(provider,): {
    readonly provider: ProviderName;
    readonly key: string;
  } {
    return {
      provider,
      key: env[KEY_VARIABLES[provider]] ?? '',
    };
  },);
  for (
    const {
      provider,
      key,
    } of keys
  ) {
    if (key === '')
      throw new RequiredProviderError({
        provider,
        reason: 'key missing',
      },);
  }
  await Promise.all(keys.map(async function checkProvider(
    {
      provider,
      key,
    },
  ): Promise<void> {
    if (provider === 'synthetic') {
      /**
       Required Synthetic meter client.
       */
      const client = createSyntheticClient({
        apiKey: key,
        transport,
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
       Required Hyper meter client.
       */
      const client = createHyperClient({
        apiKey: key,
        transport,
      },);
      await gateProvider({
        provider,
        readDry: async function readCredits(): Promise<boolean> {
          return hyperIsDry({ credits: await client.credits({ signal, },), },);
        },
      },);
      return;
    }
    if (provider === 'bedrock') {
      /**
       Required Bedrock meter client, over the ledger the environment names.
       */
      const client = createBedrockClient({
        apiKey: key,
        ledger: bedrockLedgerFromEnv({ env, },),
        transport,
      },);
      await gateProvider({
        provider,
        readDry: async function readBedrockCredits(): Promise<boolean> {
          return bedrockIsDry({ credits: await client.credits({ signal, },), },);
        },
      },);
      return;
    }
    /**
     Required OpenRouter meter client.
     */
    const client = createOpenRouterClient({
      apiKey: key,
      transport,
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
