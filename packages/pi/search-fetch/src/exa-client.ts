
/**
 * Exa HTTP client for Pi Search Fetch tools.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  ABORT_ERROR_NAME,
  CONTENT_TYPE_HEADER,
  HTTP_POST,
  JSON_CONTENT_TYPE,
  USER_AGENT_HEADER,
  USER_AGENT_VALUE,
} from './client-constants.ts';
import type {
  ExaClient,
  ExaClientOptions,
  ExaClientRuntime,
  ExaContentsRequestBody,
  ExaPostJsonOptions,
  ExaSearchRequestBody,
} from './search-fetch-types.ts';
import type {
  FetchOptions,
  SearchOptions,
} from './client.ts';

/**
 * Logger root for pi-search-fetch after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: exaLogger, },);
 * ```
 */
const exaLogger = tagged({ tag: 'pi-search-fetch', },);

//region Constants

/**
 * Default Exa API base URL.
 */
const DEFAULT_EXA_BASE_URL = 'https://api.exa.ai' as const;

/**
 * Exa search endpoint path.
 */
const EXA_SEARCH_ENDPOINT = '/search' as const;

/**
 * Exa contents endpoint path.
 */
const EXA_CONTENTS_ENDPOINT = '/contents' as const;

/**
 * Header used by Exa API keys.
 */
const EXA_API_KEY_HEADER = 'x-api-key' as const;

/**
 * Fixed Exa search mode chosen for web_search.
 */
const EXA_SEARCH_TYPE = 'fast' as const;

/**
 * Fixed Exa result count chosen for web_search.
 */
const EXA_SEARCH_NUM_RESULTS = 10 as const;

/**
 * Separator indicating a host-like blocklist entry.
 */
const HOST_LABEL_SEPARATOR = '.' as const;

//endregion Constants

/**
 * Module logger.
 */
const l = tagged({
  tag: 'exa-client',
  l: exaLogger,
},);

//region Client factory

/**
 * Create Exa HTTP client that preserves this extension's fixed request policy.
 *
 * @param clientOptions - client options
 *
 * @returns frozen Exa client
 *
 * @example
 * ```ts
 * const client = createExaClient({ apiKey: 'key', blocklist: [] });
 * ```
 */
function createExaClient(clientOptions: ExaClientOptions,): ExaClient {
  /**
   * Runtime dependencies captured by client methods.
   */
  const runtime: ExaClientRuntime = {
    ...(clientOptions.apiKey === undefined ? {} : { apiKey: clientOptions.apiKey, }),
    blocklist: clientOptions.blocklist,
    baseUrl: clientOptions.baseUrl ?? DEFAULT_EXA_BASE_URL,
    fetchImpl: clientOptions.fetchImpl ?? fetch,
  };

  return Object.freeze({
    search(searchOptions: SearchOptions,): Promise<unknown> {
      return searchExa({
        runtime,
        options: searchOptions,
      },);
    },
    fetch(fetchOptions: FetchOptions,): Promise<unknown> {
      return fetchExa({
        runtime,
        options: fetchOptions,
      },);
    },
  },);
}

/**
 * Execute a fixed-policy Exa search.
 *
 * @param runtime - client runtime dependencies
 *
 * @param options - search input and cancellation signal
 *
 * @returns parsed Exa response object
 *
 * @throws when API key is absent, Exa rejects, JSON parsing fails, or request aborts
 */
function searchExa(
  {
    runtime,
    options,
  }: {
    readonly runtime: ExaClientRuntime;
    readonly options: SearchOptions;
  },
): Promise<unknown> {
  /**
   * Logger tagged for this search call.
   */
  const innerL = tagged({
    tag: searchExa.name,
    l,
  },);
  /**
   * Search input snapshot.
   */
  const { input, } = options;
  /**
   * Exa search body with fixed mode, result count, and compatible blocklist.
   */
  const body: ExaSearchRequestBody = {
    query: input.query,
    type: EXA_SEARCH_TYPE,
    numResults: EXA_SEARCH_NUM_RESULTS,
    excludeDomains: exaForwardableBlocklist(runtime.blocklist,),
    ...(input.fromDate === undefined ? {} : { startPublishedDate: input.fromDate, }),
    ...(input.includeDomains === undefined ? {} : { includeDomains: input.includeDomains, }),
    ...(input.toDate === undefined ? {} : { endPublishedDate: input.toDate, }),
  };

  innerL.debug(`calling Exa search for query: ${input.query}`,);
  return postExaJson({
    runtime,
    endpoint: EXA_SEARCH_ENDPOINT,
    body,
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
  },);
}

/**
 * Execute a fixed-policy Exa contents fetch.
 *
 * @param runtime - client runtime dependencies
 *
 * @param options - fetch input and cancellation signal
 *
 * @returns parsed Exa response object
 *
 * @throws when API key is absent, Exa rejects, JSON parsing fails, or request aborts
 */
function fetchExa(
  {
    runtime,
    options,
  }: {
    readonly runtime: ExaClientRuntime;
    readonly options: FetchOptions;
  },
): Promise<unknown> {
  /**
   * Logger tagged for this fetch call.
   */
  const innerL = tagged({
    tag: fetchExa.name,
    l,
  },);
  /**
   * Fetch input snapshot.
   */
  const { input, } = options;
  /**
   * Exa contents body requesting text extraction for one URL.
   */
  const body: ExaContentsRequestBody = {
    urls: [input.url,],
    text: true,
  };

  innerL.debug(`calling Exa contents for URL: ${input.url}`,);
  return postExaJson({
    runtime,
    endpoint: EXA_CONTENTS_ENDPOINT,
    body,
    ...(options.signal === undefined ? {} : { signal: options.signal, }),
  },);
}

//endregion Client factory

//region Request helpers

/**
 * POST JSON to Exa and parse JSON response.
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
async function postExaJson(
  {
    runtime,
    endpoint,
    body,
    signal,
  }: ExaPostJsonOptions & {
    readonly runtime: ExaClientRuntime;
  },
): Promise<unknown> {
  /**
   * API key validated for this endpoint.
   */
  const apiKey = exaApiKeyForEndpoint({
    ...(runtime.apiKey === undefined ? {} : { apiKey: runtime.apiKey, }),
    endpoint,
  },);
  /**
   * Full Exa request URL.
   */
  const requestUrl = `${runtime.baseUrl}${endpoint}`;
  /**
   * Fetch response from Exa.
   */
  const response = await sendExaRequest({
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
    throw new Error(formatExaHttpError({
      endpoint,
      response,
      responseText,
    },),);

  return parseExaJsonResponse({
    endpoint,
    responseText,
  },);
}

/**
 * Send Exa fetch request and normalize abort or network failures.
 *
 * @param runtime - client runtime dependencies
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param requestUrl - full URL to call
 *
 * @param apiKey - Exa API key
 *
 * @param body - JSON body
 *
 * @param signal - optional abort signal
 *
 * @returns fetch response
 */
async function sendExaRequest(
  {
    runtime,
    endpoint,
    requestUrl,
    apiKey,
    body,
    signal,
  }: {
    readonly runtime: ExaClientRuntime;
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
        [EXA_API_KEY_HEADER]: apiKey,
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
        `Exa ${endpoint} request aborted`,
        { cause: error, },
      );
    throw new Error(
      `Exa ${endpoint} request failed: ${errorMessage(error,)}`,
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
function exaApiKeyForEndpoint(
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
      `Exa ${endpoint} missing API key. Set EXA_API_KEY or exaApiKey in pi-search-fetch.json.`,
    );
  return apiKey;
}

//endregion Request helpers

//region Response helpers

/**
 * Parse successful Exa JSON response text.
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param responseText - raw response text
 *
 * @returns parsed JSON response
 */
function parseExaJsonResponse(
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
      `Exa ${endpoint} returned invalid JSON response: ${errorMessage(error,)}`,
      { cause: error, },
    );
  }
}

/**
 * Format non-2xx Exa failures without exposing request secrets.
 *
 * @param endpoint - endpoint path for diagnostics
 *
 * @param response - Exa response metadata
 *
 * @param responseText - raw response text
 *
 * @returns safe error message
 */
function formatExaHttpError(
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
   * Exa message suffix.
   */
  const messageSuffix = exaErrorMessage(responseText,);
  return `Exa ${endpoint} failed with HTTP ${String(response.status,)}${statusText}${messageSuffix}`;
}

/**
 * Extract Exa error message suffix from JSON response body.
 *
 * @param responseText - raw error response text
 *
 * @returns safe suffix beginning with colon when present
 */
function exaErrorMessage(responseText: string,): string {
  try {
    /**
     * Parsed error response.
     */
    const parsed = JSON.parse(responseText,) as unknown;
    if (!isRecord(parsed,))
      return '';
    if ((typeof parsed.message) === 'string')
      return `: ${parsed.message}`;
    if ((typeof parsed.error) === 'string')
      return `: ${parsed.error}`;
    if (isRecord(parsed.error,) && ((typeof parsed.error.message) === 'string'))
      return `: ${parsed.error.message}`;
    return '';
  }
  catch (error: unknown) {
    l.debug(`ignoring unparsable Exa error response body: ${String(error,)}`,);
    return '';
  }
}

//endregion Response helpers

//region Policy helpers

/**
 * Return blocklist entries Exa accepts in excludeDomains.
 *
 * @param blocklist - normalized local blocklist
 *
 * @returns Exa-compatible domain entries
 *
 * @example
 * ```ts
 * exaForwardableBlocklist(['gov', 'example.com']);
 * ```
 */
function exaForwardableBlocklist(blocklist: readonly string[],): readonly string[] {
  return blocklist.filter(function hasHostLabelSeparator(entry,) {
    return entry.includes(HOST_LABEL_SEPARATOR,);
  },);
}

//endregion Policy helpers

//region Utility helpers

/**
 * Return whether fetch failed because request was aborted.
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
  return (Error.isError(error,))
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
  return Error.isError(error,)
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

//endregion Utility helpers

export {
  DEFAULT_EXA_BASE_URL,
  EXA_CONTENTS_ENDPOINT,
  EXA_SEARCH_ENDPOINT,
  createExaClient,
  exaForwardableBlocklist,
};
export type {
  ExaClient,
  ExaClientOptions,
  ExaContentsRequestBody,
  ExaSearchRequestBody,
} from './search-fetch-types.ts';
