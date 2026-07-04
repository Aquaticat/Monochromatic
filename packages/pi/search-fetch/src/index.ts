/**
 * Pi Linkup extension entry point.
 *
 * Registers narrow Linkup search and fetch tools with global host blocklist
 * enforcement and no web-answer or account-management surfaces.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { createLinkupClient, } from './client.ts';
import {
  loadLinkupConfig,
  type LinkupConfig,
} from './config.ts';
import {
  createLinkupTools,
  type LinkupToolClient,
} from './tools.ts';

/**
 * Logger root for pi-linkup after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 * ```
 */
const linkupLogger = tagged({ tag: 'pi-linkup', },);

/**
 * Module logger.
 */
const l = tagged({
  tag: 'index',
  l: linkupLogger,
},);

//region Types

/**
 * Options for registering Pi Linkup with injected dependencies.
 */
type RegisterPiLinkupOptions = {
  /**
   * Pi extension API.
   */
  readonly pi: ExtensionAPI;
  /**
   * Loaded Linkup config.
   */
  readonly config: LinkupConfig;
  /**
   * Linkup client used by tools.
   */
  readonly client: LinkupToolClient;
};

//endregion Types

//region Extension entry point

/**
 * Pi Linkup extension factory.
 *
 * @param pi - Pi extension API
 *
 * @example
 * ```ts
 * // In ~/.pi/agent/settings.json:
 * { "packages": ["./packages/pi/linkup"] }
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
   * Linkup HTTP client shared by the registered tools.
   */
  const client = createLinkupClient({
    ...(config.apiKey === undefined ? {} : { apiKey: config.apiKey, }),
    blocklist: config.blocklist,
  },);

  registerPiLinkup({
    pi,
    config,
    client,
  },);
  innerL.debug(`pi-linkup extension loaded; blocklist entries=${String(
    config
      .blocklist
      .length,
  )}`,);
}

/**
 * Register Pi Linkup tools using already-created dependencies.
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
   * Public Linkup tools.
   */
  const tools = createLinkupTools({
    config: options.config,
    client: options.client,
  },);

  tools.forEach(function registerTool(tool,) {
    options.pi
      .registerTool(tool,);
    innerL.debug(`registered Linkup tool: ${tool.name}`,);
  },);
}

//endregion Extension entry point

export { createLinkupClient, } from './client.ts';
export {
  configPathForHome,
  loadLinkupConfig,
} from './config.ts';
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
