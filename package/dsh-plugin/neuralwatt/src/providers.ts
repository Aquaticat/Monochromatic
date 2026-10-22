/**
 Served provider dict for the NeuralWatt route: the stable reference the
 shipped adapter reads per operation, its swap boundary, and the refresh that
 lands the live listing on it. @module
 */

import {
  caughtValueText,
} from '@monochromatic-dev/module-caught-value/ts';
import type {
  PiAiProviderProfile,
} from '@deepseek-ai/dsh-llm-pi-ai';
import {
  NEURALWATT_ROUTE,
} from './constants.ts';
import {
  fetchNeuralWattListing,
} from './fetch-listing.ts';
import {
  mapNeuralWattProviders,
  type NeuralWattListingEntry,
} from './listing.ts';
import {
  neuralWattLogger,
} from './logging.ts';

//region Types

/**
 Provider dict accessor the shipped pi-ai adapter reads at request time: one
 structurally typed seam over the swappable served value, so the shipped
 apply function needs nothing from this package.
 */
export type NeuralWattProvidersReference = {
  get: () => Record<string, PiAiProviderProfile>;
};

/**
 Served provider dict with its swap operation: the mount refresh replaces
 the value every reference read returns.
 */
export type NeuralWattProviders = {
  readonly reference: NeuralWattProvidersReference;
  replace: (options: {
    readonly providers: Record<string, PiAiProviderProfile>;
  }) => void;
};

//endregion Types

//region Public API

/**
 Build the served provider dict over one listing: the reference hands out
 the current mapping, and `replace` swaps it.

 @param listing - listing entries the served mapping starts from

 @returns reference and swap operation over the served dict

 @example
 ```ts
 const providers = createNeuralWattProviders({
   listing: neuralWattListingSnapshot,
 });
 ```
 */
export function createNeuralWattProviders({
  listing,
}: {
  readonly listing: readonly NeuralWattListingEntry[];
}): NeuralWattProviders {
  // The swappable mapping lives inside this named function so its mutable
  // binding never leaks across the factory body.
  return (function servedProviders(): NeuralWattProviders {
    /**
     Served mapping the reference hands out, swapped by `replace`.
     */
    let current = mapNeuralWattProviders({ listing });
    return {
      reference: {
        get: function readServedProviders(): Record<string, PiAiProviderProfile> {
          return current;
        },
      },
      replace: function replaceServedProviders(replaceOptions: {
        readonly providers: Record<string, PiAiProviderProfile>;
      }): void {
        current = replaceOptions.providers;
      },
    };
  })();
}

/**
 Land the live listing on the served mapping at mount: a fetch failure or a
 listing without serviceable models keeps the served snapshot and logs why,
 so provider startup never fails on the network.

 @param providers - served mapping the refresh lands on

 @param fetchListing - listing fetch, defaulted to the real transport

 @example
 ```ts
 await refreshNeuralWattProviders({ providers });
 ```
 */
export async function refreshNeuralWattProviders({
  providers,
  fetchListing = fetchNeuralWattListing,
}: {
  readonly providers: NeuralWattProviders;
  readonly fetchListing?: typeof fetchNeuralWattListing;
}): Promise<void> {
  try {
    /**
     Listing entries the live endpoint served at mount.
     */
    const listing = await fetchListing();
    /**
     Served mapping the live listing earns, built before the gate that
     protects the served snapshot from an empty catalog.
     */
    const mapped = mapNeuralWattProviders({ listing });
    /**
     Route profile read back so its model count can gate the swap.
     */
    const route = mapped[NEURALWATT_ROUTE];
    /**
     Serviceable model count the mapping produced; zero keeps the snapshot.
     */
    const modelCount = route?.models
      ?.length
      ?? 0;
    if (modelCount === 0) {
      neuralWattLogger
        .warn('neuralwatt listing GET mapped to no serviceable model; keeping the served mapping');
      return;
    }
    providers
      .replace({ providers: mapped });
    neuralWattLogger.debug('neuralwatt listing GET refreshed the served mapping');
  } catch (error) {
    neuralWattLogger
      .warn(`neuralwatt listing GET failed (${caughtValueText(error)}); keeping the served mapping`);
  }
}

//endregion Public API
