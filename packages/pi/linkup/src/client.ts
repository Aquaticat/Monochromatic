/**
 * Linkup HTTP client for Pi Linkup tools.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { linkupLogger, } from './log.ts';

import {
  ABORT_ERROR_NAME,
  AUTHORIZATION_HEADER,
  CONTENT_TYPE_HEADER,
  DEFAULT_LINKUP_BASE_URL,
  HTTP_POST,
  JSON_CONTENT_TYPE,
  LINKUP_FETCH_ENDPOINT,
  LINKUP_FETCH_EXTRACT_IMAGES,
  LINKUP_FETCH_INCLUDE_RAW_HTML,
  LINKUP_FETCH_RENDER_JS,
  LINKUP_SEARCH_DEPTH,
  LINKUP_SEARCH_ENDPOINT,
  LINKUP_SEARCH_OUTPUT_TYPE,
  USER_AGENT_HEADER,
  USER_AGENT_VALUE,
} from './client-constants.ts';
import type {
  ClientRuntime,
  ExtractedLinkupErrorMessage,
  FetchLike,
  FetchOptions,
  LinkupClient,
  LinkupClientOptions,
  LinkupFetchRequestBody,
  LinkupSearchRequestBody,
  LinkupWebFetchInput,
  LinkupWebSearchInput,
  PostJsonOptions,
  SearchOptions,
} from './client-types.ts';

/**
 * Module logger.
 */
const l = tagged({
  tag: 'client',
  l: linkupLogger,
},);

//region Client factory

/**
 * Create Linkup HTTP client that preserves this extension's fixed request policy.
 *
 * @param options - client options
 *
 * @returns frozen Linkup client
 *
 * @example
 * ```ts
 * const client = createLinkupClient({ apiKey: 'key', blocklist: [] });
 * ```
 */
function createLinkupClient(clientOptions: LinkupClientOptions,): LinkupClient {
  /**
   * Runtime dependencies captured by client methods.
   */
  const runtime: ClientRuntime = {
    ...(clientOptions.apiKey === undefined ? {} : { apiKey: clientOptions.apiKey, }),
    blocklist: clientOptions.blocklist,
    baseUrl: clientOptions.baseUrl ?? DEFAULT_LINKUP_BASE_URL,
    fetchImpl: clientOptions.fetchImpl ?? fetch,
  };

  return Object.freeze({
    search: function search(searchOptions: SearchOptions,): Promise<unknown> {
      return searchLinkup({
        runtime,
        options: searchOptions,
      },);
    },
    fetch: function fetch(fetchOptions: FetchOptions,): Promise<unknown> {
      return fetchLinkup({
        runtime,
        options: fetchOptions,
      },);
    },
  },);
}

/**
 * Execute a fixed-policy Linkup search.
 *
 * @param runtime - client runtime dependencies
 *
 * @param options - search input and cancellation signal
 *
 * @returns parsed Linkup response object
 *
 * @throws when API key is absent, Linkup rejects, JSON parsing fails, or request aborts
 */
function searchLinkup(
  {
    runtime,
    options,
  }: {
    readonly runtime: ClientRuntime;
    readonly options: SearchOptions;
  },
): Promise<unknown> {
  /**
   * Logger tagged for this search call.
   */
  const innerL = tagged({
    tag: searchLinkup.name,
    l,
  },);
  /**
   * Search input snapshot.
   */
  const {input} = options;
  /**
   * Linkup search body with fixed depth, output type, and global blocklist.
   */
  const body: LinkupSearchRequestBody = {
    q: input.query,
    depth: LINKUP_SEARCH_DEPTH,
    outputType: LINKUP_SEARCH_OUTPUT_TYPE,
    excludeDomains: runtime.blocklist,
    ...(input.fromDate === undefined ? {} : { fromDate: input.fromDate, }),
    ...(input.includeDomains === undefined ? {} : { includeDomains: input.includeDomains, }),
    ...(input.toDate === undefined ? {} : { toDate: input.toDate, }),
  };

  innerL.info(`calling Linkup search for query: ${input.query}`,);
  return postJson({
    runtime,
    endpoint: LINKUP_SEARCH_ENDPOINT,
    body,
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
  },);
}

/**
 * Execute a fixed-policy Linkup fetch.
 *
 * @param runtime - client runtime dependencies
 *
 * @param options - fetch input and cancellation signal
 *
 * @returns parsed Linkup response object
 *
 * @throws when API key is absent, Linkup rejects, JSON parsing fails, or request aborts
 */
function fetchLinkup(
  {
    runtime,
    options,
  }: {
    readonly runtime: ClientRuntime;
    readonly options: FetchOptions;
  },
): Promise<unknown> {
  /**
   * Logger tagged for this fetch call.
   */
  const innerL = tagged({
    tag: fetchLinkup.name,
    l,
  },);
  /**
   * Fetch input snapshot.
   */
  const {input} = options;
  /**
   * Linkup fetch body with fixed rendering and extraction flags.
   */
  const body: LinkupFetchRequestBody = {
    url: input.url,
    renderJs: LINKUP_FETCH_RENDER_JS,
    extractImages: LINKUP_FETCH_EXTRACT_IMAGES,
    includeRawHtml: LINKUP_FETCH_INCLUDE_RAW_HTML,
  };

  innerL.info(`calling Linkup fetch for URL: ${input.url}`,);
  return postJson({
    runtime,
    endpoint: LINKUP_FETCH_ENDPOINT,
    body,
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
  },);
}

//endregion Client factory

//region Request helpers

/**
 * POST JSON to Linkup and parse JSON response.
 *
 * @param runtime - client runtime dependencies
 *
 * @param endpoint - endpoint path
 *
 * @param body - JSON request body
 *
 * @param signal - optional cancellation signal
 *
 * @returns parsed JSON response
 */
async function postJson(
  {
    runtime,
    endpoint,
    body,
    signal,
  }: PostJsonOptions & {
    readonly runtime: ClientRuntime;
  },
): Promise<unknown> {
  /**
   * API key validated for this endpoint.
   */
  const apiKey = apiKeyForEndpoint({
    ...(runtime.apiKey === undefined ? {} : { apiKey: runtime.apiKey, }),
    endpoint,
  },);
  /**
   * Full Linkup request URL.
   */
  const requestUrl = `${runtime.baseUrl}${endpoint}`;
  /**
   * Fetch response from Linkup.
   */
  const response = await sendRequest({
    runtime,
    endpoint,
    requestUrl,
    apiKey,
    body,
    ...(signal === undefined ? {} : { signal, }),
  },);
  /**
   * Raw response text.
   */
  const responseText = await response.text();

  if (!response.ok)
    throw new Error(formatHttpError({
      endpoint,
      response,
      responseText,
    },),);

  return parseJsonResponse({
    endpoint,
    responseText,
  },);
}

/**
 * Send fetch request and normalize abort or network failures.
 *
 * @param runtime - client runtime dependencies
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param requestUrl - full URL to call
 *
 * @param apiKey - Linkup API key
 *
 * @param body - JSON body
 *
 * @param signal - optional abort signal
 *
 * @returns fetch response
 */
async function sendRequest(
  {
    runtime,
    endpoint,
    requestUrl,
    apiKey,
    body,
    signal,
  }: {
    readonly runtime: ClientRuntime;
    readonly endpoint: string;
    readonly requestUrl: string;
    readonly apiKey: string;
    readonly body: unknown;
    readonly signal?: AbortSignal;
  },
): Promise<Response> {
  try {
    /**
     * Fetch request init without undefined optional properties.
     */
    const requestInit: RequestInit = {
      method: HTTP_POST,
      headers: {
        [AUTHORIZATION_HEADER]: `Bearer ${apiKey}`,
        [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
        [USER_AGENT_HEADER]: USER_AGENT_VALUE,
      },
      body: JSON.stringify(body,),
      ...(signal === undefined ? {} : { signal, }),
    };
    return await runtime.fetchImpl(
      requestUrl,
      requestInit,
    );
  }
  catch (error: unknown) {
    if (isAbortError({
      error,
      ...(signal === undefined ? {} : { signal, }),
    },))
      throw new Error(
        `Linkup ${endpoint} request aborted`,
        { cause: error, },
      );
    throw new Error(
      `Linkup ${endpoint} request failed: ${errorMessage(error,)}`,
      { cause: error, },
    );
  }
}

/**
 * Return API key or throw endpoint-specific missing-key error.
 *
 * @param apiKey - optional configured API key
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @returns configured API key
 */
function apiKeyForEndpoint(
  {
    apiKey,
    endpoint,
  }: {
    readonly apiKey?: string;
    readonly endpoint: string;
  },
): string {
  if ((apiKey === undefined) || (apiKey.trim() === ''))
    throw new Error(
      `Linkup ${endpoint} missing API key. Set LINKUP_API_KEY or apiKey in pi-linkup.json.`,
    );
  return apiKey;
}

//endregion Request helpers

//region Response helpers

/**
 * Parse successful Linkup JSON response text.
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param responseText - raw response text
 *
 * @returns parsed JSON response
 *
 * @throws when response is not valid JSON
 */
function parseJsonResponse(
  {
    endpoint,
    responseText,
  }: {
    readonly endpoint: string;
    readonly responseText: string;
  },
): unknown {
  try {
    return JSON.parse(responseText,) as unknown;
  }
  catch (error: unknown) {
    throw new Error(
      `Linkup ${endpoint} returned invalid JSON response: ${errorMessage(error,)}`,
      { cause: error, },
    );
  }
}

/**
 * Format non-2xx HTTP failures without exposing request secrets.
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param response - Linkup response metadata
 *
 * @param responseText - raw response text
 *
 * @returns safe error message
 */
function formatHttpError(
  {
    endpoint,
    response,
    responseText,
  }: {
    readonly endpoint: string;
    readonly response: Response;
    readonly responseText: string;
  },
): string {
  /**
   * Status text with leading space, when present.
   */
  const statusText = response.statusText
    .trim()
    === ''
    ? ''
    : ` ${response.statusText}`;
  /**
   * Linkup error message parsed from response body, when present.
   */
  const linkupMessage = extractLinkupErrorMessage(responseText,);
  /**
   * Linkup message suffix.
   */
  const messageSuffix = linkupMessage.found
    ? `: ${linkupMessage.message}`
    : '';
  return `Linkup ${endpoint} failed with HTTP ${String(response.status,)}${statusText}${messageSuffix}`;
}

/**
 * Extract Linkup error message from a JSON error body.
 *
 * @param responseText - raw error response text
 *
 * @returns extraction result
 */
function extractLinkupErrorMessage(responseText: string,): ExtractedLinkupErrorMessage {
  try {
    /**
     * Parsed error response.
     */
    const parsed = JSON.parse(responseText,) as unknown;
    if (!isRecord(parsed,))
      return { found: false, };
    /**
     * Local destructured value.
     */
    const { error, } = parsed;
    if (!isRecord(error,))
      return { found: false, };
    if ((typeof error.message) !== 'string')
      return { found: false, };
    return {
      found: true,
      message: error.message,
    };
  }
  catch {
    return { found: false, };
  }
}

/**
 * Return whether fetch failed because the request was aborted.
 *
 * @param error - thrown fetch error
 *
 * @param signal - optional abort signal
 *
 * @returns whether failure is an abort
 */
function isAbortError(
  {
    error,
    signal,
  }: {
    readonly error: unknown;
    readonly signal?: AbortSignal;
  },
): boolean {
  if (signal?.aborted === true)
    return true;
  return (error instanceof Error)
    && (error.name === ABORT_ERROR_NAME);
}

/**
 * Convert unknown error to message text.
 *
 * @param error - unknown error value
 *
 * @returns error message text
 */
function errorMessage(error: unknown,): string {
  return error instanceof Error
    ? error.message
    : String(error,);
}

/**
 * Return whether value is a non-null object record.
 *
 * @param value - unknown value
 *
 * @returns whether value can be read by string keys
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

//endregion Response helpers

export {
  DEFAULT_LINKUP_BASE_URL,
  LINKUP_FETCH_ENDPOINT,
  LINKUP_SEARCH_ENDPOINT,
  createLinkupClient,
};
export type {
  FetchLike,
  FetchOptions,
  LinkupClient,
  LinkupClientOptions,
  LinkupFetchRequestBody,
  LinkupSearchRequestBody,
  LinkupWebFetchInput,
  LinkupWebSearchInput,
  SearchOptions,
};
