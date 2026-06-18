/**
 * Linkup HTTP client for Pi Linkup tools.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { linkupLogger, } from './log.ts';

//region Constants

/** Default Linkup API base URL. */
const DEFAULT_LINKUP_BASE_URL: 'https://api.linkup.so/v1' = 'https://api.linkup.so/v1';

/** Linkup search endpoint path. */
const LINKUP_SEARCH_ENDPOINT: '/search' = '/search';

/** Linkup fetch endpoint path. */
const LINKUP_FETCH_ENDPOINT: '/fetch' = '/fetch';

/** Fixed Linkup search depth selected for this package. */
const LINKUP_SEARCH_DEPTH: 'standard' = 'standard';

/** Fixed Linkup search output type selected for this package. */
const LINKUP_SEARCH_OUTPUT_TYPE: 'searchResults' = 'searchResults';

/** Fixed Linkup fetch JavaScript rendering mode. */
const LINKUP_FETCH_RENDER_JS: true = true;

/** Fixed Linkup fetch image extraction mode. */
const LINKUP_FETCH_EXTRACT_IMAGES: false = false;

/** Fixed Linkup fetch raw HTML mode. */
const LINKUP_FETCH_INCLUDE_RAW_HTML: false = false;

/** HTTP POST method. */
const HTTP_POST = 'POST';

/** Authorization header name. */
const AUTHORIZATION_HEADER = 'Authorization';

/** JSON content type header name. */
const CONTENT_TYPE_HEADER = 'Content-Type';

/** JSON media type sent to Linkup. */
const JSON_CONTENT_TYPE = 'application/json';

/** User-Agent header name. */
const USER_AGENT_HEADER = 'User-Agent';

/** User-Agent value sent by this package. */
const USER_AGENT_VALUE = '@monochromatic-dev/pi-linkup';

/** AbortError name used by fetch implementations. */
const ABORT_ERROR_NAME = 'AbortError';

//endregion Constants

//region Types

/**
 * Model-facing search input supported by Pi Linkup.
 */
type LinkupWebSearchInput = {
  /** Natural language search query. */
  readonly query: string;
  /** Optional start date forwarded to Linkup. */
  readonly fromDate?: string;
  /** Optional include-domain filter forwarded to Linkup. */
  readonly includeDomains?: readonly string[];
  /** Optional end date forwarded to Linkup. */
  readonly toDate?: string;
};

/**
 * Model-facing fetch input supported by Pi Linkup.
 */
type LinkupWebFetchInput = {
  /** Absolute URL to fetch through Linkup. */
  readonly url: string;
};

/**
 * Request body sent to Linkup search.
 */
type LinkupSearchRequestBody = {
  /** Linkup query field. */
  readonly q: string;
  /** Fixed search depth. */
  readonly depth: typeof LINKUP_SEARCH_DEPTH;
  /** Fixed search output type. */
  readonly outputType: typeof LINKUP_SEARCH_OUTPUT_TYPE;
  /** Global blocklist sent to Linkup as excluded domains. */
  readonly excludeDomains: readonly string[];
  /** Optional start date. */
  readonly fromDate?: string;
  /** Optional include-domain filter. */
  readonly includeDomains?: readonly string[];
  /** Optional end date. */
  readonly toDate?: string;
};

/**
 * Request body sent to Linkup fetch.
 */
type LinkupFetchRequestBody = {
  /** URL to fetch. */
  readonly url: string;
  /** Fixed JavaScript rendering behavior. */
  readonly renderJs: typeof LINKUP_FETCH_RENDER_JS;
  /** Fixed image extraction behavior. */
  readonly extractImages: typeof LINKUP_FETCH_EXTRACT_IMAGES;
  /** Fixed raw HTML behavior. */
  readonly includeRawHtml: typeof LINKUP_FETCH_INCLUDE_RAW_HTML;
};

/**
 * Fetch implementation injected for tests or supplied by globalThis.
 */
type FetchLike = typeof fetch;

/**
 * Linkup client constructor options.
 */
type LinkupClientOptions = {
  /** Optional Linkup API key. */
  readonly apiKey?: string;
  /** Normalized global blocklist sent to search. */
  readonly blocklist: readonly string[];
  /** Optional base URL override for tests. */
  readonly baseUrl?: string;
  /** Optional fetch implementation override for tests. */
  readonly fetchImpl?: FetchLike;
};

/**
 * Arguments for a Linkup search request.
 */
type SearchOptions = {
  /** Supported search input. */
  readonly input: LinkupWebSearchInput;
  /** Abort signal from Pi tool execution. */
  readonly signal?: AbortSignal;
};

/**
 * Arguments for a Linkup fetch request.
 */
type FetchOptions = {
  /** Supported fetch input. */
  readonly input: LinkupWebFetchInput;
  /** Abort signal from Pi tool execution. */
  readonly signal?: AbortSignal;
};

/**
 * Arguments for internal POST requests.
 */
type PostJsonOptions = {
  /** Endpoint path beginning with slash. */
  readonly endpoint: string;
  /** JSON request body. */
  readonly body: unknown;
  /** Abort signal from Pi tool execution. */
  readonly signal?: AbortSignal;
};

//endregion Types

/** Module logger. */
const l = tagged({
  tag: 'client',
  l: linkupLogger,
},);

//region Client

/**
 * Linkup HTTP client that preserves this extension's fixed request policy.
 *
 * @example
 * ```ts
 * const client = new LinkupClient({ apiKey: 'key', blocklist: [] });
 * ```
 */
class LinkupClient {
  /** Optional Linkup API key. */
  readonly #apiKey: string | undefined;

  /** Normalized global blocklist. */
  readonly #blocklist: readonly string[];

  /** Base URL for Linkup API. */
  readonly #baseUrl: string;

  /** Fetch implementation. */
  readonly #fetchImpl: FetchLike;

  /**
   * Construct a Linkup client.
   *
   * @param options - client options
   */
  public constructor(options: LinkupClientOptions,) {
    this.#apiKey = options.apiKey;
    this.#blocklist = options.blocklist;
    this.#baseUrl = options.baseUrl ?? DEFAULT_LINKUP_BASE_URL;
    this.#fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Execute a fixed-policy Linkup search.
   *
   * @param options - search input and cancellation signal
   *
   * @returns parsed Linkup response object
   *
   * @throws when API key is absent, Linkup rejects, JSON parsing fails, or request aborts
   */
  public async search(options: SearchOptions,): Promise<unknown> {
    /** Logger tagged for this search call. */
    const innerL = tagged({
      tag: this.search.name,
      l,
    },);
    /** Linkup search body with fixed depth, output type, and global blocklist. */
    const body: LinkupSearchRequestBody = {
      q: options.input.query,
      depth: LINKUP_SEARCH_DEPTH,
      outputType: LINKUP_SEARCH_OUTPUT_TYPE,
      excludeDomains: this.#blocklist,
      ...(options.input.fromDate === undefined ? {} : { fromDate: options.input.fromDate, }),
      ...(options.input.includeDomains === undefined ? {} : { includeDomains: options.input.includeDomains, }),
      ...(options.input.toDate === undefined ? {} : { toDate: options.input.toDate, }),
    };

    innerL.info(`calling Linkup search for query: ${options.input.query}`,);
    return this.#postJson({
      endpoint: LINKUP_SEARCH_ENDPOINT,
      body,
      ...(options.signal === undefined ? {} : { signal: options.signal, }),
    },);
  }

  /**
   * Execute a fixed-policy Linkup fetch.
   *
   * @param options - fetch input and cancellation signal
   *
   * @returns parsed Linkup response object
   *
   * @throws when API key is absent, Linkup rejects, JSON parsing fails, or request aborts
   */
  public async fetch(options: FetchOptions,): Promise<unknown> {
    /** Logger tagged for this fetch call. */
    const innerL = tagged({
      tag: this.fetch.name,
      l,
    },);
    /** Linkup fetch body with fixed rendering and extraction flags. */
    const body: LinkupFetchRequestBody = {
      url: options.input.url,
      renderJs: LINKUP_FETCH_RENDER_JS,
      extractImages: LINKUP_FETCH_EXTRACT_IMAGES,
      includeRawHtml: LINKUP_FETCH_INCLUDE_RAW_HTML,
    };

    innerL.info(`calling Linkup fetch for URL: ${options.input.url}`,);
    return this.#postJson({
      endpoint: LINKUP_FETCH_ENDPOINT,
      body,
      ...(options.signal === undefined ? {} : { signal: options.signal, }),
    },);
  }

  /**
   * POST JSON to Linkup and parse JSON response.
   *
   * @param options - endpoint, body, and cancellation signal
   *
   * @returns parsed JSON response
   */
  async #postJson(options: PostJsonOptions,): Promise<unknown> {
    /** API key validated for this endpoint. */
    const apiKey = this.#apiKeyForEndpoint({ endpoint: options.endpoint, },);
    /** Full Linkup request URL. */
    const requestUrl = `${this.#baseUrl}${options.endpoint}`;
    /** Fetch response from Linkup. */
    const response = await this.#sendRequest({
      endpoint: options.endpoint,
      requestUrl,
      apiKey,
      body: options.body,
      ...(options.signal === undefined ? {} : { signal: options.signal, }),
    },);
    /** Raw response text. */
    const responseText = await response.text();

    if (!response.ok)
      throw new Error(formatHttpError({
        endpoint: options.endpoint,
        response,
        responseText,
      },),);

    return parseJsonResponse({
      endpoint: options.endpoint,
      responseText,
    },);
  }

  /**
   * Send fetch request and normalize abort/network failures.
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
  async #sendRequest(
    {
      endpoint,
      requestUrl,
      apiKey,
      body,
      signal,
    }: {
      readonly endpoint: string;
      readonly requestUrl: string;
      readonly apiKey: string;
      readonly body: unknown;
      readonly signal?: AbortSignal;
    },
  ): Promise<Response> {
    try {
      return await this.#fetchImpl(requestUrl, {
        method: HTTP_POST,
        signal,
        headers: {
          [AUTHORIZATION_HEADER]: `Bearer ${apiKey}`,
          [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
          [USER_AGENT_HEADER]: USER_AGENT_VALUE,
        },
        body: JSON.stringify(body,),
      },);
    }
    catch (error: unknown) {
      if (isAbortError({ error, signal, },))
        throw new Error(`Linkup ${endpoint} request aborted`,);
      throw new Error(`Linkup ${endpoint} request failed: ${errorMessage(error,)}`,);
    }
  }

  /**
   * Return API key or throw endpoint-specific missing-key error.
   *
   * @param endpoint - endpoint path for diagnostics
   *
   * @returns configured API key
   */
  #apiKeyForEndpoint({ endpoint, }: { readonly endpoint: string; }): string {
    if (this.#apiKey === undefined || this.#apiKey.trim() === '')
      throw new Error(
        `Linkup ${endpoint} missing API key. Set LINKUP_API_KEY or apiKey in pi-linkup.json.`,
      );
    return this.#apiKey;
  }
}

//endregion Client

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
    throw new Error(`Linkup ${endpoint} returned invalid JSON response: ${errorMessage(error,)}`,);
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
  /** Optional status text suffix. */
  const statusText = response.statusText.trim() === ''
    ? ''
    : ` ${response.statusText}`;
  /** Linkup error message parsed from response body, when present. */
  const linkupMessage = extractLinkupErrorMessage(responseText,);
  /** Optional Linkup message suffix. */
  const messageSuffix = linkupMessage === undefined
    ? ''
    : `: ${linkupMessage}`;
  return `Linkup ${endpoint} failed with HTTP ${String(response.status,)}${statusText}${messageSuffix}`;
}

/**
 * Extract Linkup error message from a JSON error body.
 *
 * @param responseText - raw error response text
 *
 * @returns upstream error message, when shaped as expected
 */
function extractLinkupErrorMessage(responseText: string,): string | undefined {
  try {
    /** Parsed error response. */
    const parsed = JSON.parse(responseText,) as unknown;
    if (!isRecord(parsed,))
      return undefined;
    /** Upstream error property. */
    const error = parsed.error;
    if (!isRecord(error,))
      return undefined;
    return typeof error.message === 'string'
      ? error.message
      : undefined;
  }
  catch {
    return undefined;
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
  return error instanceof Error
    && error.name === ABORT_ERROR_NAME;
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
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value,);
}

//endregion Response helpers

export {
  DEFAULT_LINKUP_BASE_URL,
  LINKUP_FETCH_ENDPOINT,
  LINKUP_SEARCH_ENDPOINT,
  LinkupClient,
};
export type {
  FetchLike,
  FetchOptions,
  LinkupClientOptions,
  LinkupFetchRequestBody,
  LinkupSearchRequestBody,
  LinkupWebFetchInput,
  LinkupWebSearchInput,
  SearchOptions,
};
