
/**
 * Provider-routing client for Pi Search Fetch tools.
 *
 * @module
 */

import { caughtValueText as errorMessage, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  DEFAULT_LINKUP_BASE_URL,
  createLinkupClient,
  type FetchOptions,
  type LinkupClient,
  type SearchOptions,
} from './client.ts';
import {
  DEFAULT_EXA_BASE_URL,
  createExaClient,
  type ExaClient,
} from './exa-client.ts';
import type {
  ProviderFallback,
  ProviderResponse,
  SearchFetchClient,
  SearchFetchClientOptions,
  SearchFetchClientRuntime,
} from './search-fetch-types.ts';

/**
 * Logger root for pi-search-fetch after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: searchFetchLogger, },);
 * ```
 */
const searchFetchLogger = tagged({ tag: 'pi-search-fetch', },);

/**
 * Module logger.
 */
const l = tagged({
  tag: 'search-fetch-client',
  l: searchFetchLogger,
},);

//region Client factory

/**
 * Create provider-routing Search Fetch client.
 *
 * @param clientOptions - client options
 *
 * @returns frozen provider-routing client
 *
 * @example
 * ```ts
 * const client = createSearchFetchClient({ exaApiKey: 'key', blocklist: [] });
 * ```
 */
function createSearchFetchClient(clientOptions: SearchFetchClientOptions,): SearchFetchClient {
  /**
   * Runtime dependencies captured by client methods.
   */
  const runtime: SearchFetchClientRuntime = {
    ...(clientOptions.exaApiKey === undefined ? {} : { exaApiKey: clientOptions.exaApiKey, }),
    ...(clientOptions.linkupApiKey === undefined ? {} : { linkupApiKey: clientOptions.linkupApiKey, }),
    blocklist: clientOptions.blocklist,
    exaBaseUrl: clientOptions.exaBaseUrl ?? DEFAULT_EXA_BASE_URL,
    linkupBaseUrl: clientOptions.linkupBaseUrl ?? DEFAULT_LINKUP_BASE_URL,
    fetchImpl: clientOptions.fetchImpl ?? fetch,
  };
  /**
   * Exa client shared by routed operations.
   */
  const exaClient = createExaClient({
    ...(runtime.exaApiKey === undefined ? {} : { apiKey: runtime.exaApiKey, }),
    blocklist: runtime.blocklist,
    baseUrl: runtime.exaBaseUrl,
    fetchImpl: runtime.fetchImpl,
  },);
  /**
   * Linkup client shared by routed operations.
   */
  const linkupClient = createLinkupClient({
    ...(runtime.linkupApiKey === undefined ? {} : { apiKey: runtime.linkupApiKey, }),
    blocklist: runtime.blocklist,
    baseUrl: runtime.linkupBaseUrl,
    fetchImpl: runtime.fetchImpl,
  },);

  return Object.freeze({
    search(searchOptions: SearchOptions,): Promise<ProviderResponse> {
      return searchWithFallback({
        runtime,
        exaClient,
        linkupClient,
        options: searchOptions,
      },);
    },
    fetch(fetchOptions: FetchOptions,): Promise<ProviderResponse> {
      return fetchWithFallback({
        runtime,
        exaClient,
        linkupClient,
        options: fetchOptions,
      },);
    },
  },);
}

//endregion Client factory

//region Routed operations

/**
 * Search through Exa first and fall back to Linkup.
 *
 * @param runtime - client runtime dependencies
 *
 * @param exaClient - Exa client
 *
 * @param linkupClient - Linkup client
 *
 * @param options - search options
 *
 * @returns provider-tagged search response
 */
async function searchWithFallback(
  {
    runtime,
    exaClient,
    linkupClient,
    options,
  }: {
    readonly runtime: SearchFetchClientRuntime;
    readonly exaClient: ExaClient;
    readonly linkupClient: LinkupClient;
    readonly options: SearchOptions;
  },
): Promise<ProviderResponse> {
  if ((runtime.exaApiKey !== undefined) && hasCredential({ value: runtime.exaApiKey, })) {
    try {
      return {
        provider: 'exa',
        response: await exaClient.search(options,),
      };
    }
    catch (error: unknown) {
      /**
       * Safe Exa failure text for logs and details.
       */
      const reason = errorMessage(error,);
      l.warn(`Exa search unavailable; falling back to Linkup: ${reason}`,);
      return searchLinkupFallback({
        linkupClient,
        options,
        fallback: {
          from: 'exa',
          to: 'linkup',
          reason,
        },
      },);
    }
  }

  l.warn('Exa search unavailable; falling back to Linkup: missing Exa API key',);
  return searchLinkupFallback({
    linkupClient,
    options,
    fallback: {
      from: 'exa',
      to: 'linkup',
      reason: 'missing Exa API key',
    },
  },);
}

/**
 * Fetch through Linkup first and fall back to Exa contents.
 *
 * @param runtime - client runtime dependencies
 *
 * @param exaClient - Exa client
 *
 * @param linkupClient - Linkup client
 *
 * @param options - fetch options
 *
 * @returns provider-tagged fetch response
 */
async function fetchWithFallback(
  {
    runtime,
    exaClient,
    linkupClient,
    options,
  }: {
    readonly runtime: SearchFetchClientRuntime;
    readonly exaClient: ExaClient;
    readonly linkupClient: LinkupClient;
    readonly options: FetchOptions;
  },
): Promise<ProviderResponse> {
  if ((runtime.linkupApiKey !== undefined) && hasCredential({ value: runtime.linkupApiKey, })) {
    try {
      return {
        provider: 'linkup',
        response: await linkupClient.fetch(options,),
      };
    }
    catch (error: unknown) {
      /**
       * Safe Linkup failure text for logs and details.
       */
      const reason = errorMessage(error,);
      l.warn(`Linkup fetch unavailable; falling back to Exa: ${reason}`,);
      return fetchExaFallback({
        exaClient,
        options,
        fallback: {
          from: 'linkup',
          to: 'exa',
          reason,
        },
      },);
    }
  }

  l.warn('Linkup fetch unavailable; falling back to Exa: missing Linkup API key',);
  return fetchExaFallback({
    exaClient,
    options,
    fallback: {
      from: 'linkup',
      to: 'exa',
      reason: 'missing Linkup API key',
    },
  },);
}

//endregion Routed operations

//region Fallback helpers

/**
 * Execute Linkup search fallback and wrap failures with original fallback context.
 *
 * @param linkupClient - Linkup client
 *
 * @param options - search options
 *
 * @param fallback - fallback metadata
 *
 * @returns provider-tagged Linkup response
 */
async function searchLinkupFallback(
  {
    linkupClient,
    options,
    fallback,
  }: {
    readonly linkupClient: LinkupClient;
    readonly options: SearchOptions;
    readonly fallback: ProviderFallback;
  },
): Promise<ProviderResponse> {
  try {
    return {
      provider: 'linkup',
      response: await linkupClient.search(options,),
      fallback,
    };
  }
  catch (error: unknown) {
    throw combinedFallbackError({
      operation: 'search',
      fallback,
      finalProvider: 'Linkup',
      finalError: error,
    },);
  }
}

/**
 * Execute Exa fetch fallback and wrap failures with original fallback context.
 *
 * @param exaClient - Exa client
 *
 * @param options - fetch options
 *
 * @param fallback - fallback metadata
 *
 * @returns provider-tagged Exa response
 */
async function fetchExaFallback(
  {
    exaClient,
    options,
    fallback,
  }: {
    readonly exaClient: ExaClient;
    readonly options: FetchOptions;
    readonly fallback: ProviderFallback;
  },
): Promise<ProviderResponse> {
  try {
    return {
      provider: 'exa',
      response: await exaClient.fetch(options,),
      fallback,
    };
  }
  catch (error: unknown) {
    throw combinedFallbackError({
      operation: 'fetch',
      fallback,
      finalProvider: 'Exa',
      finalError: error,
    },);
  }
}

/**
 * Build an error that includes first fallback reason and final provider failure.
 *
 * @param operation - operation name
 *
 * @param fallback - fallback metadata
 *
 * @param finalProvider - final provider display name
 *
 * @param finalError - final provider error
 *
 * @returns combined provider failure
 *
 * @mutates finalError - `errorMessage` may invoke string-conversion hooks.
 */
function combinedFallbackError(
  {
    operation,
    fallback,
    finalProvider,
    finalError,
  }: {
    readonly operation: string;
    readonly fallback: ProviderFallback;
    readonly finalProvider: string;
    readonly finalError: unknown;
  },
): Error {
  return new Error(
    `Search Fetch ${operation} failed. ${fallback.from} unavailable: ${fallback.reason}. ${finalProvider} failed: ${errorMessage(finalError,)}`,
    { cause: finalError, },
  );
}

//endregion Fallback helpers

//region Utility helpers

/**
 * Return whether optional credential has non-blank content.
 *
 * @param value - optional credential
 *
 * @returns whether credential is configured
 */
function hasCredential({ value, }: { readonly value: string; }): boolean {
  return value.trim() !== '';
}

//endregion Utility helpers

export { createSearchFetchClient, };
export type {
  ProviderFallback,
  ProviderResponse,
  SearchFetchClient,
  SearchFetchClientOptions,
  SearchFetchProvider,
} from './search-fetch-types.ts';
