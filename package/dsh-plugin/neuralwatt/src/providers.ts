/**
 Served provider dict for the NeuralWatt route: the stable reference the
 shipped adapter reads per operation, its swap boundary, and the refresh that
 lands the live listing on it. @module
 */

import {
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  caughtValueText,
} from '@monochromatic-dev/module-caught-value/ts';
import type {
  PiAiProviderProfile,
} from '@deepseek-ai/dsh-llm-pi-ai';
import {
  fetchNeuralWattListing,
  type NeuralWattListingFetcher,
} from './fetch-listing.ts';
import {
  mapNeuralWattProviders,
  type NeuralWattListingEntry,
} from './listing.ts';
import {
  neuralWattLogger,
} from './logging.ts';
import {
  NEURALWATT_ROUTE,
} from './constants.ts';

//region Types

/**
 Stable reference to the provider dict the shipped pi-ai adapter reads per
 operation, matching the `Volatile` shape its `apply` takes: callers keep the
 reference and read the current mapping through `get`.
 */
export type NeuralWattProvidersReference = {
  get(): Record<string, PiAiProviderProfile>;
};

/**
 Served provider dict with its swap boundary: the reference handed to the
 shipped adapter, and the one replacement step that makes the next adapter
 read see a new mapping.
 */
export type NeuralWattProviders = {
  readonly reference: NeuralWattProvidersReference;
  replace(options: {
    readonly providers: Record<string, PiAiProviderProfile>;
  }): void;
};

//endregion Types

//region Public API

/**
 Build the served provider dict over one listing, usually the checked-in
 snapshot: the route serves immediately, before any fetch runs.

 @param listing - listing entries to serve first

 @returns served dict with its reference and swap boundary

 @example
 ```ts
 const providers = createNeuralWattProviders({ listing: snapshot, },);
 ```
 */
export function createNeuralWattProviders(
  { listing, }: { readonly listing: readonly NeuralWattListingEntry[]; },
): NeuralWattProviders {
  /**
   Current served mapping, replaced in place by {@link NeuralWattProviders.replace}.
   */
  let current = mapNeuralWattProviders({ listing, },);
  return {
    reference: {
      get: () => current,
    },
    replace: ({ providers, }) => {
      current = providers;
    },
  };
}

/**
 Land the live NeuralWatt listing on the served provider dict.

 A fetch failure, or a listing mapping to no serviceable model, keeps the
 already-served mapping and logs why: an unreachable or empty endpoint must
 never take a route that the default model rides on down with it. This is the
 plugin's degradation boundary, so the call never throws.

 @param options - served dict to update, and the transport to read

 @example
 ```ts
 await refreshNeuralWattProviders({ providers, },);
 ```
 */
export async function refreshNeuralWattProviders(
  {
    providers,
    fetchListing = fetchNeuralWattListing,
  }: {
    readonly providers: NeuralWattProviders;
    readonly fetchListing?: typeof fetchNeuralWattListing;
  },
): Promise<void> {
  /**
   Logger tagged with the function name.
   */
  const logger = tagged({
    tag: refreshNeuralWattProviders.name,
    l: neuralWattLogger,
  },);
  try {
    /**
     Live listing entries the endpoint returned.
     */
    const listing = await fetchListing();
    /**
     Live mapping the fetch lands on the served dict.
     */
    const mapped = mapNeuralWattProviders({ listing, },);
    /**
     Model count the live mapping serves on the route.
     */
    const modelCount = mapped[NEURALWATT_ROUTE]?.models?.length ?? 0;
    if (modelCount === 0) {
      logger.warn(
        `neuralwatt listing GET mapped to no serviceable model; keeping the served mapping`,
      );
      return;
    }
    providers.replace({ providers: mapped, },);
    logger.debug(
      `neuralwatt listing landed: ${String(modelCount,)} models on route ${NEURALWATT_ROUTE}`,
    );
  } catch (error) {
    logger.warn(
      `neuralwatt listing fetch failed (${caughtValueText(error,)}); keeping the served mapping`,
    );
  }
}

//endregion Public API
