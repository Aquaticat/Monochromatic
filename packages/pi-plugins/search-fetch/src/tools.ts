/**
 * Pi tool definitions for Linkup search and fetch.
 *
 * @module
 */

import {
  defineTool,
  formatSize,
  type AgentToolUpdateCallback,
  type ExtensionContext,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import {
  type TArray,
  type TObject,
  type TOptional,
  type TString,
  Type,
} from 'typebox';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  LinkupConfig,
} from './config.ts';
import type {
  LinkupWebFetchInput,
  LinkupWebSearchInput,
} from './client.ts';
import type {
  SearchFetchClient,
} from './search-fetch-client.ts';
import {
  filterBlockedSearchResults,
  findBlockedUrlMatch,
} from './domain-policy.ts';
import {
  createLinkupToolOutput,
  LINKUP_VISIBLE_JSON_MAX_BYTES,
  type LinkupToolDetails,
} from './tool-output.ts';

/**
 * Logger root for pi-search-fetch after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 * ```
 */
const linkupLogger = tagged({ tag: 'pi-search-fetch', },);

//region Constants

/**
 * Public Linkup search tool name.
 */
const LINKUP_WEB_SEARCH_TOOL_NAME = 'web_search' as const;

/**
 * Public Linkup fetch tool name.
 */
const LINKUP_WEB_FETCH_TOOL_NAME = 'web_fetch' as const;

/**
 * Supported search input keys.
 */
const SEARCH_SUPPORTED_KEYS = [
  'query',
  'fromDate',
  'includeDomains',
  'toDate',
] as const;

/**
 * Supported fetch input keys.
 */
const FETCH_SUPPORTED_KEYS = [
  'url',
] as const;

/**
 * Search ignored-key fixed behavior text.
 */
const SEARCH_FIXED_BEHAVIOR: string = 'This extension uses Exa fast search first, Linkup standard search as fallback, the configured global blocklist, and no per-search result-count controls.';

/**
 * Fetch ignored-key fixed behavior text.
 */
const FETCH_FIXED_BEHAVIOR: string = 'This extension uses Linkup renderJs fetch first and may fall back to Exa contents.';

//endregion Constants

//region Schemas

/**
 * TypeBox object builder alias.
 */
const typeObject = Type.Object;

/**
 * TypeBox string builder alias.
 */
const typeString = Type.String;

/**
 * TypeBox array builder alias.
 */
const typeArray = Type.Array;

/**
 * TypeBox optional builder alias.
 */
const typeOptional = Type.Optional;

/**
 * Model-facing search parameter schema.
 */
const LinkupWebSearchParametersSchema: TObject<{
  query: TString;
  fromDate: TOptional<TString>;
  includeDomains: TOptional<TArray<TString>>;
  toDate: TOptional<TString>;
}> = typeObject({
  query: typeString({
    description: 'Search query sent to Exa first and Linkup fallback. Be specific and include names, dates, versions, or locations when relevant.',
  },),
  fromDate: typeOptional(typeString({
    description: 'Optional ISO date forwarded to providers as a start date.',
  },),),
  includeDomains: typeOptional(typeArray(
    typeString(),
    {
    description: 'Optional domain allow-list forwarded to providers as includeDomains.',
  },
  ),),
  toDate: typeOptional(typeString({
    description: 'Optional ISO date forwarded to providers as an end date.',
  },),),
},);

/**
 * Model-facing fetch parameter schema.
 */
const LinkupWebFetchParametersSchema: TObject<{
  url: TString;
}> = typeObject({
  url: typeString({
    description: 'Absolute URL to fetch with Linkup first and Exa fallback.',
  },),
},);

/**
 * Runtime search params accepted from Pi after TypeBox validation.
 */
type LinkupWebSearchParams = {
  /**
   * Search query sent to Linkup.
   */
  readonly query: string;
  /**
   * Optional start date forwarded to Linkup.
   */
  readonly fromDate?: string;
  /**
   * Optional include-domain filter forwarded to Linkup.
   */
  readonly includeDomains?: readonly string[];
  /**
   * Optional end date forwarded to Linkup.
   */
  readonly toDate?: string;
};

/**
 * Runtime fetch params accepted from Pi after TypeBox validation.
 */
type LinkupWebFetchParams = {
  /**
   * URL fetched by Linkup.
   */
  readonly url: string;
};

//endregion Schemas

//region Types

/**
 * Minimal client surface used by tool execution.
 */
type LinkupToolClient = Pick<SearchFetchClient, 'search' | 'fetch'>;

/**
 * Options for creating Linkup tools.
 */
type CreateLinkupToolsOptions = {
  /**
   * Loaded extension config.
   */
  readonly config: LinkupConfig;
  /**
   * Linkup HTTP client.
   */
  readonly client: LinkupToolClient;
};

/**
 * Linkup tool definition type.
 */
type LinkupToolDefinition = ToolDefinition<
  typeof LinkupWebSearchParametersSchema | typeof LinkupWebFetchParametersSchema,
  LinkupToolDetails
>;

//endregion Types

/**
 * Module logger.
 */
const l = tagged({
  tag: 'tools',
  l: linkupLogger,
},);

//region Public API

/**
 * Create the two public Linkup tool definitions.
 *
 * @param options - config and client dependencies
 *
 * @returns search and fetch tools in registration order
 *
 * @example
 * ```ts
 * createLinkupTools({ config, client });
 * ```
 */
function createLinkupTools(options: CreateLinkupToolsOptions,): readonly LinkupToolDefinition[] {
  return [
    createLinkupWebSearchTool(options,),
    createLinkupWebFetchTool(options,),
  ];
}

/**
 * Create the public Linkup search tool.
 *
 * @param options - config and client dependencies
 *
 * @returns Pi tool definition
 */
function createLinkupWebSearchTool(
  options: CreateLinkupToolsOptions,
): ToolDefinition<typeof LinkupWebSearchParametersSchema, LinkupToolDetails> {
  return defineTool({
    name: LINKUP_WEB_SEARCH_TOOL_NAME,
    label: 'Web Search',
    description: `Search the web with Exa fast search first and Linkup standard search fallback. Uses the configured global blocklist. Exact {"results":[...]} responses, plus exact metadata envelopes with requestId, resolvedSearchType, results, searchTime, and costDollars, return object results as JSONL; other output is JSON and may be truncated after ${formatSize(LINKUP_VISIBLE_JSON_MAX_BYTES,)} with a full response temp path.`,
    promptSnippet: 'Search the web with Exa fast search first, Linkup fallback, and the global blocklist.',
    promptGuidelines: [
      'Use web_search to discover sources across the web before fetching a specific page.',
      'web_search uses Exa type="fast" first and Linkup depth="standard" fallback; do not rely on deep, web-answer, limit, or maxResults controls.',
      'web_search applies the configured global blocklist locally after providers respond.',
      'web_search returns object results as JSONL for exact {"results":[...]} responses and exact metadata envelopes with requestId, resolvedSearchType, results, searchTime, and costDollars.',
    ],
    parameters: LinkupWebSearchParametersSchema,
    async execute(
      _toolCallId: string,
      params: ForeignBorrowed<LinkupWebSearchParams>,
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Pi ToolDefinition.execute requires positional signal before later context args, so optionality cannot move to a trailing parameter.
      signal: AbortSignal | undefined,
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Pi ToolDefinition.execute provides onUpdate as callback-or-undefined in a fixed positional signature.
      onUpdate: AgentToolUpdateCallback<LinkupToolDetails> | undefined,
      _ctx: ExtensionContext,
    ) {
      /**
       * Logger tagged for this tool execution.
       */
      const innerL = tagged({
        tag: LINKUP_WEB_SEARCH_TOOL_NAME,
        l,
      },);
      /**
       * Ignored compatibility keys supplied by the model.
       */
      const ignoredKeys = collectIgnoredKeys({
        input: params,
        supportedKeys: SEARCH_SUPPORTED_KEYS,
      },);
      /**
       * Sanitized search input that cannot carry unsupported keys to the client.
       */
      const searchInput = supportedSearchInput(params,);

      onUpdate?.({
        content: [{
          type: 'text',
          text: `Searching web for: ${searchInput.query}`,
        },],
        details: {
          linkupResponse: undefined,
          rawLinkupResponse: undefined,
        },
      },);

      innerL.debug(`executing search for query: ${searchInput.query}`,);
      if (ignoredKeys.length > 0)
        innerL.warn(`ignoring search parameters: ${ignoredKeys.join(', ',)}`,);

      /**
       * Provider-tagged upstream response.
       */
      const providerResponse = await options.client
        .search({
        input: searchInput,
        ...(signal === undefined ? {} : { signal, }),
      },);
      /**
       * Local policy-filtered response.
       */
      const filtered = filterBlockedSearchResults({
        response: providerResponse.response,
        blocklist: options.config
          .blocklist,
      },);

      return createLinkupToolOutput({
        toolName: LINKUP_WEB_SEARCH_TOOL_NAME,
        linkupResponse: filtered.linkupResponse,
        rawLinkupResponse: filtered.rawLinkupResponse,
        ignoredKeys,
        fixedBehavior: SEARCH_FIXED_BEHAVIOR,
        renderResultsArrayAsJsonl: true,
        removedBlockedUrls: filtered.removedBlockedUrls,
        provider: providerResponse.provider,
        ...(providerResponse.fallback === undefined ? {} : { fallback: providerResponse.fallback, }),
      },);
    },
  },);
}

/**
 * Create the public Linkup fetch tool.
 *
 * @param options - config and client dependencies
 *
 * @returns Pi tool definition
 */
function createLinkupWebFetchTool(
  options: CreateLinkupToolsOptions,
): ToolDefinition<typeof LinkupWebFetchParametersSchema, LinkupToolDetails> {
  return defineTool({
    name: LINKUP_WEB_FETCH_TOOL_NAME,
    label: 'Web Fetch',
    description: `Fetch one page with Linkup renderJs first and Exa contents fallback. Blocked hosts throw before providers are called. Output is raw markdown when Linkup returns only a markdown field; otherwise JSON. Model-visible output may be truncated after ${formatSize(LINKUP_VISIBLE_JSON_MAX_BYTES,)} with a full response temp path.`,
    promptSnippet: 'Fetch a known URL with Linkup renderJs first, Exa fallback, and the global blocklist preflight.',
    promptGuidelines: [
      'Use web_fetch when the URL is already known and the goal is to read page content.',
      'web_fetch uses Linkup renderJs=true first and Exa contents fallback; unsupported fetch knobs are ignored with a warning.',
      'web_fetch returns raw markdown when Linkup responds with only a markdown field; otherwise it returns JSON.',
      'web_fetch refuses configured blocked hosts before any provider network request is made.',
    ],
    parameters: LinkupWebFetchParametersSchema,
    async execute(
      _toolCallId: string,
      params: ForeignBorrowed<LinkupWebFetchParams>,
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Pi ToolDefinition.execute requires positional signal before later context args, so optionality cannot move to a trailing parameter.
      signal: AbortSignal | undefined,
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Pi ToolDefinition.execute provides onUpdate as callback-or-undefined in a fixed positional signature.
      onUpdate: AgentToolUpdateCallback<LinkupToolDetails> | undefined,
      _ctx: ExtensionContext,
    ) {
      /**
       * Logger tagged for this tool execution.
       */
      const innerL = tagged({
        tag: LINKUP_WEB_FETCH_TOOL_NAME,
        l,
      },);
      /**
       * Ignored compatibility keys supplied by the model.
       */
      const ignoredKeys = collectIgnoredKeys({
        input: params,
        supportedKeys: FETCH_SUPPORTED_KEYS,
      },);
      /**
       * Sanitized fetch input that cannot carry unsupported keys to the client.
       */
      const fetchInput = supportedFetchInput(params,);
      /**
       * Matching blocklist entry for this fetch URL, when blocked.
       */
      const blockedEntry = findBlockedUrlMatch({
        url: fetchInput.url,
        blocklist: options.config
          .blocklist,
      },);

      if (blockedEntry.blocked)
        throw new Error(`Blocked by pi-search-fetch blocklist: ${blockedEntry.entry}`,);

      onUpdate?.({
        content: [{
          type: 'text',
          text: `Fetching URL: ${fetchInput.url}`,
        },],
        details: {
          linkupResponse: undefined,
          rawLinkupResponse: undefined,
        },
      },);

      innerL.debug(`executing fetch for URL: ${fetchInput.url}`,);
      if (ignoredKeys.length > 0)
        innerL.warn(`ignoring fetch parameters: ${ignoredKeys.join(', ',)}`,);

      /**
       * Provider-tagged upstream response.
       */
      const providerResponse = await options.client
        .fetch({
        input: fetchInput,
        ...(signal === undefined ? {} : { signal, }),
      },);

      return createLinkupToolOutput({
        toolName: LINKUP_WEB_FETCH_TOOL_NAME,
        linkupResponse: providerResponse.response,
        rawLinkupResponse: providerResponse.response,
        ignoredKeys,
        fixedBehavior: FETCH_FIXED_BEHAVIOR,
        provider: providerResponse.provider,
        ...(providerResponse.fallback === undefined ? {} : { fallback: providerResponse.fallback, }),
      },);
    },
  },);
}

//endregion Public API

//region Input helpers

/**
 * Collect input keys unsupported by this extension version.
 *
 * @param input - actual runtime tool params
 *
 * @param supportedKeys - supported key names
 *
 * @returns ignored key names in caller-provided order
 *
 * @example
 * ```ts
 * collectIgnoredKeys({ input: { query: 'docs', limit: 3 }, supportedKeys: ['query'] });
 * ```
 */
function collectIgnoredKeys(
  {
    input,
    supportedKeys,
  }: {
    input: object;
    supportedKeys: readonly string[];
  },
): readonly string[] {
  /**
   * Supported key lookup set.
   */
  const supported = new Set(supportedKeys,);
  return Object.keys(input,)
    .filter(function isIgnoredKey(key,) {
      return !supported.has(key,);
    },);
}

/**
 * Build supported search input from possibly noisy runtime params.
 *
 * @param params - TypeBox-validated params that may still include extra keys
 *
 * @returns sanitized search input
 */
function supportedSearchInput(params: LinkupWebSearchParams,): LinkupWebSearchInput {
  return {
    query: params.query,
    ...(params.fromDate === undefined ? {} : { fromDate: params.fromDate, }),
    ...(params.includeDomains === undefined ? {} : { includeDomains: params.includeDomains, }),
    ...(params.toDate === undefined ? {} : { toDate: params.toDate, }),
  };
}

/**
 * Build supported fetch input from possibly noisy runtime params.
 *
 * @param params - TypeBox-validated params that may still include extra keys
 *
 * @returns sanitized fetch input
 */
function supportedFetchInput(params: LinkupWebFetchParams,): LinkupWebFetchInput {
  return {
    url: params.url,
  };
}

//endregion Input helpers

export {
  FETCH_FIXED_BEHAVIOR,
  LINKUP_WEB_FETCH_TOOL_NAME,
  LINKUP_WEB_SEARCH_TOOL_NAME,
  LinkupWebFetchParametersSchema,
  LinkupWebSearchParametersSchema,
  SEARCH_FIXED_BEHAVIOR,
  collectIgnoredKeys,
  createLinkupTools,
};
export type {
  CreateLinkupToolsOptions,
  LinkupToolClient,
  LinkupToolDefinition,
  LinkupWebFetchParams,
  LinkupWebSearchParams,
};
