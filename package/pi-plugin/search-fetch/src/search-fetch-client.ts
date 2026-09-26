
/**
 Provider-routing client for Pi Search Fetch tools.
 
 @module
 */

import { caughtValueText as errorMessage, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  combinedFallbackError,
  fetchExaFallback,
  hasCredential,
  rethrowIfCancelled,
  searchLinkupFallback,
} from './provider-fallback.ts';
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
import { createGhClient, } from './gh-client.ts';
import { planGitHubFetch, } from './github-url-plan.ts';
import type { GhClient, } from './github-fetch-types.ts';
import type {
  ProviderFallback,
  ProviderResponse,
  SearchFetchClient,
  SearchFetchClientOptions,
  SearchFetchClientRuntime,
} from './search-fetch-types.ts';

/**
 Logger root for pi-search-fetch after removing the package log shim.
 
 @example
 ```ts
 const rl = tagged({ tag: someFunction.name, l: searchFetchLogger, },);
 ```
 */
const searchFetchLogger = tagged({ tag: 'pi-search-fetch', },);

/**
 Module logger.
 */
const l = tagged({
  tag: 'search-fetch-client',
  l: searchFetchLogger,
},);

//region Client factory

/**
 Create provider-routing Search Fetch client.
 
 @param clientOptions - client options
 
 @returns frozen provider-routing client
 
 @example
 ```ts
 const client = createSearchFetchClient({ exaApiKey: 'key', blocklist: [] });
 ```
 */
function createSearchFetchClient(
  clientOptions: ForeignBorrowed<SearchFetchClientOptions>,
): SearchFetchClient {
  /**
   Runtime dependencies captured by client methods.
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
   Exa client shared by routed operations.
   */
  const exaClient = createExaClient({
    ...(runtime.exaApiKey === undefined ? {} : { apiKey: runtime.exaApiKey, }),
    blocklist: runtime.blocklist,
    baseUrl: runtime.exaBaseUrl,
    fetchImpl: runtime.fetchImpl,
  },);
  /**
   Linkup client shared by routed operations.
   */
  const linkupClient = createLinkupClient({
    ...(runtime.linkupApiKey === undefined ? {} : { apiKey: runtime.linkupApiKey, }),
    blocklist: runtime.blocklist,
    baseUrl: runtime.linkupBaseUrl,
    fetchImpl: runtime.fetchImpl,
  },);
  /**
   gh-backed client serving planned GitHub URLs before paid providers.
   */
  const ghClient = clientOptions.ghClient ?? createGhClient({},);

  return Object.freeze({
    search(searchOptions: ForeignBorrowed<SearchOptions>,): Promise<ProviderResponse> {
      return searchWithFallback({
        runtime,
        exaClient,
        linkupClient,
        options: searchOptions,
      },);
    },
    fetch(fetchOptions: ForeignBorrowed<FetchOptions>,): Promise<ProviderResponse> {
      return fetchWithFallback({
        runtime,
        ghClient,
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
 Search through Exa first and fall back to Linkup.
 
 @param runtime - client runtime dependencies
 
 @param exaClient - Exa client
 
 @param linkupClient - Linkup client
 
 @param options - search options
 
 @returns provider-tagged search response
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
      rethrowIfCancelled(options.signal === undefined ? {} : { signal: options.signal, },);
      /**
       Safe Exa failure text for logs and details.
       */
      const reason = errorMessage(error,);
      l.warn(`Exa search unavailable; falling back to Linkup: ${reason}`,);
      return searchLinkupFallback({
        linkupClient,
        options,
        fallbackChain: [
          {
            from: 'exa',
            to: 'linkup',
            reason,
          },
        ],
      },);
    }
  }

  l.warn('Exa search unavailable; falling back to Linkup: missing Exa API key',);
  return searchLinkupFallback({
    linkupClient,
    options,
    fallbackChain: [
      {
        from: 'exa',
        to: 'linkup',
        reason: 'missing Exa API key',
      },
    ],
  },);
}

/**
 Fetch through gh for planned GitHub URLs, then Linkup, then Exa contents.
 
 @param runtime - client runtime dependencies
 
 @param ghClient - gh-backed fetch client
 
 @param exaClient - Exa client
 
 @param linkupClient - Linkup client
 
 @param options - fetch options
 
 @returns provider-tagged fetch response
 
 @throws when the caller-owned signal cancels a gh invocation
 
 @mutates options - gh children register abort listeners on `options.signal`.
 */
async function fetchWithFallback(
  {
    runtime,
    ghClient,
    exaClient,
    linkupClient,
    options,
  }: {
    readonly runtime: SearchFetchClientRuntime;
    readonly ghClient: GhClient;
    readonly exaClient: ExaClient;
    readonly linkupClient: LinkupClient;
    readonly options: FetchOptions;
  },
): Promise<ProviderResponse> {
  /**
   gh plan for this fetch URL.
   */
  const plan = planGitHubFetch({ url: options.input
    .url, },);
  if (!plan.planned) {
    l.debug(`routing ${options.input
      .url} to paid providers: ${plan.reason}`,);
    return fetchLinkupThenExa({
      runtime,
      exaClient,
      linkupClient,
      options,
    },);
  }

  try {
    return {
      provider: 'gh',
      response: await ghClient.fetch({
        url: options.input
          .url,
        kind: plan.kind,
        attempts: plan.attempts,
        ...(options.signal === undefined ? {} : { signal: options.signal, }),
      },),
    };
  }
  catch (error: unknown) {
    rethrowIfCancelled(options.signal === undefined ? {} : { signal: options.signal, },);
    /**
     Safe gh failure text for logs and details.
     */
    const reason = errorMessage(error,);
    l.warn(`gh fetch unavailable; falling back to Linkup: ${reason}`,);
    return fetchLinkupThenExa({
      runtime,
      exaClient,
      linkupClient,
      options,
      fallbackChain: [
        {
          from: 'gh',
          to: 'linkup',
          reason,
        },
      ],
    },);
  }
}

/**
 Fetch through Linkup first and fall back to Exa contents.
 
 @param runtime - client runtime dependencies
 
 @param exaClient - Exa client
 
 @param linkupClient - Linkup client
 
 @param options - fetch options
 
 @param fallbackChain - fallback steps already taken before Linkup
 
 @returns provider-tagged fetch response
 */
async function fetchLinkupThenExa(
  {
    runtime,
    exaClient,
    linkupClient,
    options,
    fallbackChain = [],
  }: {
    readonly runtime: SearchFetchClientRuntime;
    readonly exaClient: ExaClient;
    readonly linkupClient: LinkupClient;
    readonly options: FetchOptions;
    readonly fallbackChain?: readonly ProviderFallback[];
  },
): Promise<ProviderResponse> {
  rethrowIfCancelled(options.signal === undefined ? {} : { signal: options.signal, },);
  if ((runtime.linkupApiKey !== undefined) && hasCredential({ value: runtime.linkupApiKey, })) {
    try {
      return {
        provider: 'linkup',
        response: await linkupClient.fetch(options,),
        ...(fallbackChain.length === 0 ? {} : { fallbackChain, }),
      };
    }
    catch (error: unknown) {
      rethrowIfCancelled(options.signal === undefined ? {} : { signal: options.signal, },);
      /**
       Safe Linkup failure text for logs and details.
       */
      const reason = errorMessage(error,);
      l.warn(`Linkup fetch unavailable; falling back to Exa: ${reason}`,);
      return fetchExaFallback({
        exaClient,
        options,
        fallbackChain: [
          ...fallbackChain,
          {
            from: 'linkup',
            to: 'exa',
            reason,
          },
        ],
      },);
    }
  }

  l.warn('Linkup fetch unavailable; falling back to Exa: missing Linkup API key',);
  return fetchExaFallback({
    exaClient,
    options,
    fallbackChain: [
      ...fallbackChain,
      {
        from: 'linkup',
        to: 'exa',
        reason: 'missing Linkup API key',
      },
    ],
  },);
}

//endregion Routed operations

export { createSearchFetchClient, };
export type {
  ProviderFallback,
  ProviderResponse,
  SearchFetchClient,
  SearchFetchClientOptions,
  SearchFetchProvider,
} from './search-fetch-types.ts';
