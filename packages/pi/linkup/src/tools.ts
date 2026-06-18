/**
 * Pi tool definitions for Linkup search and fetch.
 *
 * @module
 */

import type {
  AgentToolUpdateCallback,
  ExtensionContext,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { defineTool, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  type Static,
  type TArray,
  type TObject,
  type TOptional,
  type TString,
  Type,
} from 'typebox';
import type {
  LinkupConfig,
} from './config.ts';
import type {
  LinkupClient,
  LinkupWebFetchInput,
  LinkupWebSearchInput,
} from './client.ts';
import {
  filterBlockedSearchResults,
  findBlockedUrlMatch,
} from './domain-policy.ts';
import { linkupLogger, } from './log.ts';
import {
  createLinkupToolOutput,
  type LinkupToolDetails,
} from './tool-output.ts';

//region Constants

/** Public Linkup search tool name. */
const LINKUP_WEB_SEARCH_TOOL_NAME: 'linkup_web_search' = 'linkup_web_search';

/** Public Linkup fetch tool name. */
const LINKUP_WEB_FETCH_TOOL_NAME: 'linkup_web_fetch' = 'linkup_web_fetch';

/** Supported search input keys. */
const SEARCH_SUPPORTED_KEYS = [
  'query',
  'fromDate',
  'includeDomains',
  'toDate',
] as const;

/** Supported fetch input keys. */
const FETCH_SUPPORTED_KEYS = [
  'url',
] as const;

/** Search ignored-key fixed behavior text. */
const SEARCH_FIXED_BEHAVIOR: string = 'This extension always uses depth="standard", outputType="searchResults", the configured global blocklist, and no per-search result-count controls.';

/** Fetch ignored-key fixed behavior text. */
const FETCH_FIXED_BEHAVIOR: string = 'This extension always uses renderJs=true, extractImages=false, and includeRawHtml=false.';

//endregion Constants

//region Schemas

/** TypeBox object builder alias. */
const typeObject = Type.Object;

/** TypeBox string builder alias. */
const typeString = Type.String;

/** TypeBox array builder alias. */
const typeArray = Type.Array;

/** TypeBox optional builder alias. */
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
    description: 'Search query sent to Linkup as q. Be specific and include names, dates, versions, or locations when relevant.',
  },),
  fromDate: typeOptional(typeString({
    description: 'Optional ISO date forwarded to Linkup as fromDate.',
  },),),
  includeDomains: typeOptional(typeArray(typeString(), {
    description: 'Optional domain allow-list forwarded to Linkup as includeDomains.',
  },),),
  toDate: typeOptional(typeString({
    description: 'Optional ISO date forwarded to Linkup as toDate.',
  },),),
},);

/**
 * Model-facing fetch parameter schema.
 */
const LinkupWebFetchParametersSchema: TObject<{
  url: TString;
}> = typeObject({
  url: typeString({
    description: 'Absolute URL to fetch with Linkup.',
  },),
},);

/** Static search params from TypeBox schema. */
type LinkupWebSearchParams = Static<typeof LinkupWebSearchParametersSchema>;

/** Static fetch params from TypeBox schema. */
type LinkupWebFetchParams = Static<typeof LinkupWebFetchParametersSchema>;

//endregion Schemas

//region Types

/**
 * Minimal client surface used by tool execution.
 */
type LinkupToolClient = Pick<LinkupClient, 'search' | 'fetch'>;

/**
 * Options for creating Linkup tools.
 */
type CreateLinkupToolsOptions = {
  /** Loaded extension config. */
  readonly config: LinkupConfig;
  /** Linkup HTTP client. */
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

/** Module logger. */
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
    label: 'Linkup Web Search',
    description: 'Search the web with Linkup POST /v1/search. Always uses depth="standard", outputType="searchResults", and the configured global blocklist. Output is JSON and may be truncated with a full response temp path.',
    promptSnippet: 'Search the web with Linkup using standard depth, searchResults output, and the global blocklist.',
    promptGuidelines: [
      'Use linkup_web_search to discover sources across the web before fetching a specific page.',
      'linkup_web_search always uses depth="standard" and outputType="searchResults"; do not rely on fast, deep, web-answer, limit, or maxResults controls.',
      'linkup_web_search applies the configured global blocklist to Linkup excludeDomains and locally removes blocked result hosts after Linkup responds.',
    ],
    parameters: LinkupWebSearchParametersSchema,
    async execute(
      _toolCallId: string,
      params: LinkupWebSearchParams,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<LinkupToolDetails> | undefined,
      _ctx: ExtensionContext,
    ) {
      /** Logger tagged for this tool execution. */
      const innerL = tagged({
        tag: LINKUP_WEB_SEARCH_TOOL_NAME,
        l,
      },);
      /** Ignored compatibility keys supplied by the model. */
      const ignoredKeys = collectIgnoredKeys({
        input: params,
        supportedKeys: SEARCH_SUPPORTED_KEYS,
      },);
      /** Sanitized search input that cannot carry unsupported keys to the client. */
      const searchInput = supportedSearchInput(params,);

      onUpdate?.({
        content: [{
          type: 'text',
          text: `Searching Linkup for: ${searchInput.query}`,
        },],
        details: {
          linkupResponse: undefined,
          rawLinkupResponse: undefined,
        },
      },);

      innerL.info(`executing search for query: ${searchInput.query}`,);
      if (ignoredKeys.length > 0)
        innerL.warn(`ignoring search parameters: ${ignoredKeys.join(', ',)}`,);

      /** Untouched upstream Linkup response. */
      const rawLinkupResponse = await options.client.search({
        input: searchInput,
        ...(signal === undefined ? {} : { signal, }),
      },);
      /** Local policy-filtered response. */
      const filtered = filterBlockedSearchResults({
        response: rawLinkupResponse,
        blocklist: options.config.blocklist,
      },);

      return createLinkupToolOutput({
        toolName: LINKUP_WEB_SEARCH_TOOL_NAME,
        linkupResponse: filtered.linkupResponse,
        rawLinkupResponse: filtered.rawLinkupResponse,
        ignoredKeys,
        fixedBehavior: SEARCH_FIXED_BEHAVIOR,
        removedBlockedUrls: filtered.removedBlockedUrls,
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
    label: 'Linkup Web Fetch',
    description: 'Fetch one page with Linkup POST /v1/fetch. Always uses renderJs=true, extractImages=false, and includeRawHtml=false. Blocked hosts throw before Linkup is called. Output is JSON and may be truncated with a full response temp path.',
    promptSnippet: 'Fetch a known URL with Linkup using renderJs=true and the global blocklist preflight.',
    promptGuidelines: [
      'Use linkup_web_fetch when the URL is already known and the goal is to read Linkup-fetched page content.',
      'linkup_web_fetch always sends renderJs=true, extractImages=false, and includeRawHtml=false; unsupported fetch knobs are ignored with a warning.',
      'linkup_web_fetch refuses configured blocked hosts before any Linkup network request is made.',
    ],
    parameters: LinkupWebFetchParametersSchema,
    async execute(
      _toolCallId: string,
      params: LinkupWebFetchParams,
      signal: AbortSignal | undefined,
      onUpdate: AgentToolUpdateCallback<LinkupToolDetails> | undefined,
      _ctx: ExtensionContext,
    ) {
      /** Logger tagged for this tool execution. */
      const innerL = tagged({
        tag: LINKUP_WEB_FETCH_TOOL_NAME,
        l,
      },);
      /** Ignored compatibility keys supplied by the model. */
      const ignoredKeys = collectIgnoredKeys({
        input: params,
        supportedKeys: FETCH_SUPPORTED_KEYS,
      },);
      /** Sanitized fetch input that cannot carry unsupported keys to the client. */
      const fetchInput = supportedFetchInput(params,);
      /** Matching blocklist entry for this fetch URL, when blocked. */
      const blockedEntry = findBlockedUrlMatch({
        url: fetchInput.url,
        blocklist: options.config.blocklist,
      },);

      if (blockedEntry !== undefined)
        throw new Error(`Blocked by pi-linkup blocklist: ${blockedEntry}`,);

      onUpdate?.({
        content: [{
          type: 'text',
          text: `Fetching with Linkup: ${fetchInput.url}`,
        },],
        details: {
          linkupResponse: undefined,
          rawLinkupResponse: undefined,
        },
      },);

      innerL.info(`executing fetch for URL: ${fetchInput.url}`,);
      if (ignoredKeys.length > 0)
        innerL.warn(`ignoring fetch parameters: ${ignoredKeys.join(', ',)}`,);

      /** Untouched upstream Linkup response. */
      const rawLinkupResponse = await options.client.fetch({
        input: fetchInput,
        ...(signal === undefined ? {} : { signal, }),
      },);

      return createLinkupToolOutput({
        toolName: LINKUP_WEB_FETCH_TOOL_NAME,
        linkupResponse: rawLinkupResponse,
        rawLinkupResponse,
        ignoredKeys,
        fixedBehavior: FETCH_FIXED_BEHAVIOR,
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
 */
function collectIgnoredKeys(
  {
    input,
    supportedKeys,
  }: {
    readonly input: object;
    readonly supportedKeys: readonly string[];
  },
): readonly string[] {
  /** Supported key lookup set. */
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
