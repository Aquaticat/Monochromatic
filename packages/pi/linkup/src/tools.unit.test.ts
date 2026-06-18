/**
 * Unit tests for Pi Linkup tool definitions.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLinkupTools,
  LINKUP_WEB_FETCH_TOOL_NAME,
  LINKUP_WEB_SEARCH_TOOL_NAME,
  type LinkupConfig,
  type LinkupToolClient,
  type LinkupWebFetchInput,
  type LinkupWebSearchInput,
} from '../dist/final/node/index.mjs';

//region Fixtures

/** Blocked host fixture. */
const BLOCKED_HOST = 'badwikipedia.invalid';

/** Good search result URL fixture. */
const GOOD_RESULT_URL = 'https://example.com/good';

/** Fixed config fixture. */
const CONFIG: LinkupConfig = {
  apiKey: 'key',
  blocklist: [BLOCKED_HOST,],
  source: {
    path: '/home/test/.pi/agent/extensions/pi-linkup.json',
    loaded: true,
  },
};

/** Empty Linkup response fixture. */
const EMPTY_RESPONSE = { results: [], };

//endregion Fixtures

await describe({
  name: createLinkupTools.name,
  children: [
    it({
      name: 'creates only linkup_web_search and linkup_web_fetch tools',
      fn: async () => {
        const mock = mockClient({
          searchResponse: EMPTY_RESPONSE,
          fetchResponse: { markdown: 'ok', },
        },);

        const tools = createLinkupTools({
          config: CONFIG,
          client: mock.client,
        },);

        expect(tools.map(function toolName(tool,) {
          return tool.name;
        },),).toEqual([
          LINKUP_WEB_SEARCH_TOOL_NAME,
          LINKUP_WEB_FETCH_TOOL_NAME,
        ],);
      },
    },),
    it({
      name: 'search ignored params produce model-visible warnings and do not reach client',
      fn: async () => {
        const mock = mockClient({
          searchResponse: EMPTY_RESPONSE,
          fetchResponse: { markdown: 'ok', },
        },);
        const searchTool = searchToolFrom(mock.client,);

        const result = await searchTool.execute(
          'tool-call-search-warning',
          {
            query: 'ignored params',
            depth: 'deep',
            limit: 2,
            maxResults: 5,
          } as never,
          undefined,
          undefined,
          fakeContext(),
        );

        expect(result.content,).toHaveLength(2,);
        const warning = textContentAt({ result, index: 0, },);
        expect(warning,).toContain('depth, limit, maxResults',);
        expect(warning,).toContain('depth="standard"',);
        expect(mock.searchCalls,).toHaveLength(1,);
        expect('depth' in mock.searchCalls[0]?.input as object,).toBe(false,);
        expect('maxResults' in mock.searchCalls[0]?.input as object,).toBe(false,);
      },
    },),
    it({
      name: 'search removes blocked result URLs from model-visible output and preserves raw response in details',
      fn: async () => {
        const rawResponse = {
          results: [
            {
              name: 'blocked exact',
              url: `https://${BLOCKED_HOST}/a`,
            },
            {
              name: 'allowed',
              url: GOOD_RESULT_URL,
            },
            {
              name: 'blocked subdomain',
              url: `https://www.${BLOCKED_HOST}/b`,
            },
          ],
        };
        const mock = mockClient({
          searchResponse: rawResponse,
          fetchResponse: { markdown: 'ok', },
        },);
        const searchTool = searchToolFrom(mock.client,);

        const result = await searchTool.execute(
          'tool-call-search-filter',
          { query: 'filter', },
          undefined,
          undefined,
          fakeContext(),
        );

        const visible = parseVisibleJson({ result, index: 0, },);
        const visibleResults = resultsArray(visible,);
        expect(visibleResults,).toHaveLength(1,);
        expect(resultUrl(visibleResults[0],),).toBe(GOOD_RESULT_URL,);
        expect(resultsArray(result.details.rawLinkupResponse,),).toHaveLength(3,);
        expect(result.details.removedBlockedUrls,).toEqual([
          `https://${BLOCKED_HOST}/a`,
          `https://www.${BLOCKED_HOST}/b`,
        ],);
      },
    },),
    it({
      name: 'fetch ignored params produce model-visible warnings',
      fn: async () => {
        const mock = mockClient({
          searchResponse: EMPTY_RESPONSE,
          fetchResponse: { markdown: 'ok', },
        },);
        const fetchTool = fetchToolFrom(mock.client,);

        const result = await fetchTool.execute(
          'tool-call-fetch-warning',
          {
            url: 'https://example.com',
            renderJs: false,
            includeRawHtml: true,
          } as never,
          undefined,
          undefined,
          fakeContext(),
        );

        expect(result.content,).toHaveLength(2,);
        expect(textContentAt({ result, index: 0, },),).toContain('renderJs, includeRawHtml',);
        expect(mock.fetchCalls,).toHaveLength(1,);
        expect('renderJs' in mock.fetchCalls[0]?.input as object,).toBe(false,);
      },
    },),
    it({
      name: 'blocked fetch throws before mocked client fetch is called',
      fn: async () => {
        const mock = mockClient({
          searchResponse: EMPTY_RESPONSE,
          fetchResponse: { markdown: 'ok', },
        },);
        const fetchTool = fetchToolFrom(mock.client,);

        let caught: unknown;
        try {
          await fetchTool.execute(
            'tool-call-blocked-fetch',
            { url: `https://www.${BLOCKED_HOST}/page`, },
            undefined,
            undefined,
            fakeContext(),
          );
        }
        catch (error: unknown) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(`Blocked by pi-linkup blocklist: ${BLOCKED_HOST}`,);
        expect(mock.fetchCalls,).toHaveLength(0,);
      },
    },),
    it({
      name: 'fetch stores model-visible response in details and visible output is JSON',
      fn: async () => {
        const fetchResponse = { markdown: 'Fetched page', };
        const mock = mockClient({
          searchResponse: EMPTY_RESPONSE,
          fetchResponse,
        },);
        const fetchTool = fetchToolFrom(mock.client,);

        const result = await fetchTool.execute(
          'tool-call-fetch-json',
          { url: 'https://example.com', },
          undefined,
          undefined,
          fakeContext(),
        );

        expect(result.details.linkupResponse,).toBe(fetchResponse,);
        expect(parseVisibleJson({ result, index: 0, },),).toEqual(fetchResponse,);
      },
    },),
  ],
},);

//region Helpers

/** Search call record. */
type SearchCall = {
  /** Search input passed to client. */
  readonly input: LinkupWebSearchInput;
};

/** Fetch call record. */
type FetchCall = {
  /** Fetch input passed to client. */
  readonly input: LinkupWebFetchInput;
};

/** Mock client harness. */
type MockClient = {
  /** Client implementation. */
  readonly client: LinkupToolClient;
  /** Recorded search calls. */
  readonly searchCalls: SearchCall[];
  /** Recorded fetch calls. */
  readonly fetchCalls: FetchCall[];
};

/**
 * Build mock Linkup client.
 *
 * @param searchResponse - response returned by search
 *
 * @param fetchResponse - response returned by fetch
 *
 * @returns mock client harness
 */
function mockClient(
  {
    searchResponse,
    fetchResponse,
  }: {
    readonly searchResponse: unknown;
    readonly fetchResponse: unknown;
  },
): MockClient {
  const searchCalls: SearchCall[] = [];
  const fetchCalls: FetchCall[] = [];
  return {
    client: {
      async search(options,) {
        searchCalls.push({ input: options.input, },);
        return searchResponse;
      },
      async fetch(options,) {
        fetchCalls.push({ input: options.input, },);
        return fetchResponse;
      },
    },
    searchCalls,
    fetchCalls,
  };
}

/**
 * Return search tool from a fresh tool set.
 *
 * @param client - mock client
 *
 * @returns search tool
 */
function searchToolFrom(client: LinkupToolClient,) {
  const tool = createLinkupTools({
    config: CONFIG,
    client,
  },).find(function isSearchTool(candidate,) {
    return candidate.name === LINKUP_WEB_SEARCH_TOOL_NAME;
  },);
  if (tool === undefined)
    throw new Error('missing search tool',);
  return tool;
}

/**
 * Return fetch tool from a fresh tool set.
 *
 * @param client - mock client
 *
 * @returns fetch tool
 */
function fetchToolFrom(client: LinkupToolClient,) {
  const tool = createLinkupTools({
    config: CONFIG,
    client,
  },).find(function isFetchTool(candidate,) {
    return candidate.name === LINKUP_WEB_FETCH_TOOL_NAME;
  },);
  if (tool === undefined)
    throw new Error('missing fetch tool',);
  return tool;
}

/**
 * Build unused extension context stand-in.
 *
 * @returns fake extension context
 */
function fakeContext(): ExtensionContext {
  return {} as unknown as ExtensionContext;
}

/**
 * Return text content at index from a tool result.
 *
 * @param result - tool result
 *
 * @param index - content item index
 *
 * @returns text content
 */
function textContentAt(
  {
    result,
    index,
  }: {
    readonly result: { readonly content: readonly unknown[]; };
    readonly index: number;
  },
): string {
  const item = result.content[index];
  if (!isRecord(item,) || item.type !== 'text' || typeof item.text !== 'string')
    throw new Error(`content item ${String(index,)} was not text`,);
  return item.text;
}

/**
 * Parse visible JSON content at index.
 *
 * @param result - tool result
 *
 * @param index - content item index
 *
 * @returns parsed JSON
 */
function parseVisibleJson(
  {
    result,
    index,
  }: {
    readonly result: { readonly content: readonly unknown[]; };
    readonly index: number;
  },
): unknown {
  return JSON.parse(textContentAt({ result, index, },),) as unknown;
}

/**
 * Extract Linkup results array from a response.
 *
 * @param value - Linkup response value
 *
 * @returns results array
 */
function resultsArray(value: unknown,): readonly unknown[] {
  if (!isRecord(value,) || !Array.isArray(value.results,))
    throw new Error('response did not contain results array',);
  return value.results;
}

/**
 * Extract result URL from a result object.
 *
 * @param value - result value
 *
 * @returns URL string
 */
function resultUrl(value: unknown,): string {
  if (!isRecord(value,) || typeof value.url !== 'string')
    throw new Error('result did not contain url',);
  return value.url;
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

//endregion Helpers
