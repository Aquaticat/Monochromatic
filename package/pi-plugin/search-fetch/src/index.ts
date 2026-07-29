/**
 * Pi Search Fetch extension entry point.
 *
 * Registers provider-neutral search and fetch tools with global host blocklist enforcement
 * and no web-answer or account-management surfaces.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  loadLinkupConfig,
  type LinkupConfig,
} from './config.ts';
import {
  createSearchFetchClient,
} from './search-fetch-client.ts';
import {
  createLinkupTools,
  type LinkupToolClient,
} from './tools.ts';

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
  tag: 'index',
  l: searchFetchLogger,
},);

//region Types

/**
 * Options for registering Pi Search Fetch with injected dependencies.
 */
type RegisterPiLinkupOptions = {
  /**
   * Pi extension API.
   */
  readonly pi: ExtensionAPI;
  /**
   * Loaded Search Fetch config.
   */
  readonly config: LinkupConfig;
  /**
   * Provider-routing client used by tools.
   */
  readonly client: LinkupToolClient;
};

//endregion Types

//region Extension entry point

/**
 * Pi Search Fetch extension factory.
 *
 * @param pi - Pi extension API
 *
 * @example
 * ```ts
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi-plugin/search-fetch"] }
 * ```
 */
export default async function piLinkup(pi: ExtensionAPI,): Promise<void> {
  /**
   * Logger tagged for extension startup.
   */
  const innerL = tagged({
    tag: piLinkup.name,
    l,
  },);
  /**
   * Runtime config loaded from the global Pi extension config file.
   */
  const config = await loadLinkupConfig();
  /**
   * Provider-routing client shared by registered tools.
   */
  const client = createSearchFetchClient({
    ...(config.exaApiKey === undefined ? {} : { exaApiKey: config.exaApiKey, }),
    ...(config.linkupApiKey === undefined ? {} : { linkupApiKey: config.linkupApiKey, }),
    blocklist: config.blocklist,
  },);

  registerPiLinkup({
    pi,
    config,
    client,
  },);
  innerL.debug(`pi-search-fetch extension loaded; blocklist entries=${String(
    config
      .blocklist
      .length,
  )}`,);
}

/**
 * Register Pi Search Fetch tools using already-created dependencies.
 *
 * @param options - Pi API, config, and client
 *
 * @example
 * ```ts
 * registerPiLinkup({ pi, config, client });
 * ```
 */
function registerPiLinkup(options: RegisterPiLinkupOptions,): void {
  /**
   * Logger tagged for registration.
   */
  const innerL = tagged({
    tag: registerPiLinkup.name,
    l,
  },);
  /**
   * Public Search Fetch tools.
   */
  const tools = createLinkupTools({
    config: options.config,
    client: options.client,
  },);

  tools.forEach(function registerTool(tool,) {
    options.pi
      .registerTool(tool,);
    innerL.debug(`registered Search Fetch tool: ${tool.name}`,);
  },);
}

//endregion Extension entry point

export { createLinkupClient, } from './client.ts';
export {
  loadLinkupConfig,
} from './config.ts';
export {
  configPathForHome,
  legacyConfigPathForHome,
} from './config-paths.ts';
export {
  filterBlockedSearchResults,
  findBlockedHostMatch,
  findBlockedUrlMatch,
  isBlockedHost,
  isBlockedUrl,
  normalizeBlocklist,
  normalizeBlocklistEntry,
  normalizeHostForPolicy,
} from './domain-policy.ts';
export {
  createExaClient,
  exaForwardableBlocklist,
} from './exa-client.ts';
export {
  filterFetchResponseDataImages,
  filterMarkdownDataImages,
} from './markdown-data-image-filter.ts';
export {
  createSearchFetchClient,
} from './search-fetch-client.ts';
export {
  createJsonContent,
  createLinkupToolOutput,
  createWarningContent,
  LINKUP_VISIBLE_JSON_MAX_BYTES,
} from './tool-output.ts';
export {
  FETCH_FIXED_BEHAVIOR,
  LINKUP_WEB_FETCH_TOOL_NAME,
  LINKUP_WEB_SEARCH_TOOL_NAME,
  LinkupWebFetchParametersSchema,
  LinkupWebSearchParametersSchema,
  SEARCH_FIXED_BEHAVIOR,
  collectIgnoredKeys,
  createLinkupTools,
} from './tools.ts';
export { registerPiLinkup, };
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
} from './client.ts';
export type {
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
} from './config.ts';
export type {
  BlocklistMatch,
  SearchResultFilterResult,
} from './domain-policy.ts';
export type {
  ExaClient,
  ExaClientOptions,
  ExaContentsRequestBody,
  ExaSearchRequestBody,
} from './exa-client.ts';
export type {
  FetchResponseDataImageFilterResult,
  MarkdownDataImageFilterResult,
} from './markdown-data-image-filter.ts';
export type {
  ProviderFallback,
  ProviderResponse,
  SearchFetchClient,
  SearchFetchClientOptions,
  SearchFetchProvider,
} from './search-fetch-client.ts';
export type {
  JsonContentResult,
  LinkupToolDetails,
  LinkupToolOutputOptions,
  TextContentItem,
  WarningContentOptions,
} from './tool-output.ts';
export type {
  CreateLinkupToolsOptions,
  LinkupToolClient,
  LinkupToolDefinition,
  LinkupWebFetchParams,
  LinkupWebSearchParams,
} from './tools.ts';
export type { RegisterPiLinkupOptions, };
