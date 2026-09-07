import {
  type BedrockClient,
  createBedrockClient,
} from '../bedrock-client.ts';
import { bedrockLedgerFromEnv, } from '../bedrock-ledger.ts';
import {
  createHyperClient,
  type HyperClient,
} from '../hyper-client.ts';
import {
  createOpenRouterClient,
  type OpenRouterClient,
} from '../openrouter-client.ts';
import {
  createProviderBudgets,
  type ProviderBudgets,
} from '../provider-budget.ts';
import { hyperRequestsPerHour, } from '../request-pace.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { createSyntheticClient, } from '../synthetic-client.ts';
import type { ModelTransport, } from '../synthetic-transport.ts';
import { RunConfigError, } from './run-config-error.ts';

//region Run providers
// WHICH PROVIDERS A RUN HAS, read off the environment: one client per key
// present, and the shared budget view over them. Split out of
// `run-config.ts` on 2026-09-07 when the fourth provider put that file over
// the line budget. Any number of keys may be absent; the owner, 2026-09-07:
// "any number of provider being dry or lacking API key is expected and normal
// operation". Only no key at all is a refusal.

/**
 * Clients a run may route to, each present when its key is, plus the budget
 * view over all of them.
 *
 * @example
 * ```ts
 * const { budgets, } = configureProviders({},);
 * ```
 */
export type ConfiguredProviders = {
  /**
   * First provider client, when its key is set.
   */
  readonly synthetic?: SyntheticClient;

  /**
   * Second provider client, when its key is set.
   */
  readonly hyper?: HyperClient;

  /**
   * Fourth provider client, when its key is set.
   */
  readonly bedrock?: BedrockClient;

  /**
   * Third provider client, when its key is set.
   */
  readonly openrouter?: OpenRouterClient;

  /**
   * Shared budget view every provider is routed by.
   */
  readonly budgets: ProviderBudgets;
};

/**
 * Builds every configured provider's client and the budget view over them.
 *
 * @param transport - HTTP seam handed to every client; tests inject one
 *
 * @returns Clients present per key, plus the budgets
 *
 * @throws {@link RunConfigError} when every provider key variable is unset or empty
 *
 * @example
 * ```ts
 * const providers = configureProviders({},);
 * ```
 */
export function configureProviders(
  { transport, }: { readonly transport?: ModelTransport; } = {},
): ConfiguredProviders {
  /**
   * Synthetic API key, resolved by name from the mise-injected env.
   */
  const apiKey = process.env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';
  /**
   * Second provider key,
   * independently optional because either provider may run alone.
   */
  const hyperKey = process.env
    .TRANSLATION_REPAIR_CHARM_HYPER_API_KEY
    ?? '';
  /**
   * Third provider key, the paid fallback, optional for the same reason.
   */
  const openRouterKey = process.env
    .TRANSLATION_REPAIR_OPENROUTER_API_KEY
    ?? '';
  /**
   * Fourth provider key, the prepaid per-token provider, optional likewise.
   */
  const bedrockKey = process.env
    .TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY
    ?? '';
  /**
   * Whether no provider at all is configured, which nothing can run on.
   */
  const noKeyAtAll = (apiKey === '')
    && (hyperKey === '')
    && (bedrockKey === '')
    && (openRouterKey === '');
  if (noKeyAtAll) {
    throw new RunConfigError({
      variable: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, '
        + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY',
    },);
  }

  /**
   * Transport handed to configured clients,
   * absent when production's fetch is meant.
   */
  const seam = (transport === undefined)
    ? {}
    : { transport, };

  /**
   * First provider client when configured.
   */
  const synthetic = (apiKey === '')
    ? undefined
    : createSyntheticClient({
      apiKey,
      ...seam,
    },);

  /**
   * Second provider client when configured.
   */
  const hyper = (hyperKey === '')
    ? undefined
    : createHyperClient({
      apiKey: hyperKey,
      requestsPerHour: hyperRequestsPerHour({ env: process.env, },),
      ...seam,
    },);

  /**
   * Third provider client when configured.
   */
  const openrouter = (openRouterKey === '')
    ? undefined
    : createOpenRouterClient({
      apiKey: openRouterKey,
      ...seam,
    },);

  /**
   * Fourth provider client when configured, over the durable spend ledger
   * the environment names.
   */
  const bedrock = (bedrockKey === '')
    ? undefined
    : createBedrockClient({
      apiKey: bedrockKey,
      ledger: bedrockLedgerFromEnv({ env: process.env, },),
      ...seam,
    },);

  /**
   * Shared budget view every provider is routed by.
   */
  const budgets = createProviderBudgets({
    ...((synthetic === undefined) ? {} : { synthetic, }),
    ...((hyper === undefined) ? {} : { hyper, }),
    ...((bedrock === undefined) ? {} : { bedrock, }),
    ...((openrouter === undefined) ? {} : { openrouter, }),
  },);

  return {
    ...((synthetic === undefined) ? {} : { synthetic, }),
    ...((hyper === undefined) ? {} : { hyper, }),
    ...((bedrock === undefined) ? {} : { bedrock, }),
    ...((openrouter === undefined) ? {} : { openrouter, }),
    budgets,
  };
}

//endregion Run providers
