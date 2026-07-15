/**
 * Unit tests for Search Fetch provider routing.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createExaClient,
  createSearchFetchClient,
  exaForwardableBlocklist,
  type FetchLike,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Exa API key fixture.
 */
const EXA_API_KEY = 'exa-secret-key';

/**
 * Linkup API key fixture.
 */
const LINKUP_API_KEY = 'linkup-secret-key';

/**
 * Exa base URL fixture.
 */
const EXA_BASE_URL = 'https://exa.test';

/**
 * Linkup base URL fixture.
 */
const LINKUP_BASE_URL = 'https://linkup.test/v1';

/**
 * Blocklist fixture containing one Exa-incompatible entry.
 */
const BLOCKLIST = [
  'gov',
  'badwikipedia.invalid',
] as const;

/**
 * Exa search response fixture.
 */
const EXA_SEARCH_RESPONSE = { results: [{ title: 'Exa', url: 'https://example.com/exa', },], };

/**
 * Linkup search response fixture.
 */
const LINKUP_SEARCH_RESPONSE = { results: [{ title: 'Linkup', url: 'https://example.com/linkup', },], };

/**
 * Linkup fetch response fixture.
 */
const LINKUP_FETCH_RESPONSE = { markdown: 'Linkup page', };

/**
 * Exa fetch response fixture.
 */
const EXA_FETCH_RESPONSE = { results: [{ url: 'https://example.com', text: 'Exa page', },], };

//endregion Fixtures

await describe({
  name: '',
  children: [
    describe({
      name: createExaClient.name,
      children: [
        it({
          name: 'search sends fast mode and only Exa-compatible excluded domains',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [{ body: EXA_SEARCH_RESPONSE, },],
            },);
            /**
             * Local value for client.
             */
            const client = createExaClient({
              apiKey: EXA_API_KEY,
              blocklist: BLOCKLIST,
              baseUrl: EXA_BASE_URL,
              fetchImpl: mock.fetchImpl,
            },);

            await client.search({
              input: {
                query: 'docs',
                fromDate: '2026-01-01',
                includeDomains: ['example.com',],
                toDate: '2026-12-31',
              },
            },);

            /**
             * Local value for requestBody.
             */
            const requestBody = requestJsonBody(firstCall(mock,),);
            expect(firstCall(mock,).url,).toBe(`${EXA_BASE_URL}/search`,);
            expect(requestBody.query,).toBe('docs',);
            expect(requestBody.type,).toBe('fast',);
            expect(requestBody.numResults,).toBe(10,);
            expect(requestBody.excludeDomains,).toEqual(['badwikipedia.invalid',],);
            expect(requestBody.startPublishedDate,).toBe('2026-01-01',);
            expect(requestBody.includeDomains,).toEqual(['example.com',],);
            expect(requestBody.endPublishedDate,).toBe('2026-12-31',);
          },
        },),
        it({
          name: 'filters Exa-incompatible bare suffixes out of forwarded blocklist',
          fn: async () => {
            expect(exaForwardableBlocklist(BLOCKLIST,),).toEqual(['badwikipedia.invalid',],);
          },
        },),
      ],
    },),
    describe({
      name: createSearchFetchClient.name,
      children: [
        it({
          name: 'search uses Exa when Exa key is configured',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [{ body: EXA_SEARCH_RESPONSE, },],
            },);
            /**
             * Local value for client.
             */
            const client = clientWithMock({ mock, exaApiKey: EXA_API_KEY, linkupApiKey: LINKUP_API_KEY, },);

            /**
             * Local value for result.
             */
            const result = await client.search({ input: { query: 'docs', }, },);

            expect(result.provider,).toBe('exa',);
            expect(result.response,).toEqual(EXA_SEARCH_RESPONSE,);
            expect(mock.calls,).toHaveLength(1,);
            expect(firstCall(mock,).url,).toBe(`${EXA_BASE_URL}/search`,);
          },
        },),
        it({
          name: 'search falls back to Linkup when Exa key is missing',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [{ body: LINKUP_SEARCH_RESPONSE, },],
            },);
            /**
             * Local value for client.
             */
            const client = clientWithMock({ mock, linkupApiKey: LINKUP_API_KEY, },);

            /**
             * Local value for result.
             */
            const result = await client.search({ input: { query: 'docs', }, },);

            expect(result.provider,).toBe('linkup',);
            expect(result.fallback?.reason,).toBe('missing Exa API key',);
            expect(firstCall(mock,).url,).toBe(`${LINKUP_BASE_URL}/search`,);
          },
        },),
        it({
          name: 'search falls back to Linkup when Exa request fails',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [
                { body: { message: 'bad gateway', }, status: 502, statusText: 'Bad Gateway', },
                { body: LINKUP_SEARCH_RESPONSE, },
              ],
            },);
            /**
             * Local value for client.
             */
            const client = clientWithMock({ mock, exaApiKey: EXA_API_KEY, linkupApiKey: LINKUP_API_KEY, },);

            /**
             * Local value for result.
             */
            const result = await client.search({ input: { query: 'docs', }, },);

            expect(result.provider,).toBe('linkup',);
            expect(result.fallback?.from,).toBe('exa',);
            expect(result.fallback?.to,).toBe('linkup',);
            expect(mock.calls.map(function callUrl(call,) {
              return call.url;
            },),).toEqual([
              `${EXA_BASE_URL}/search`,
              `${LINKUP_BASE_URL}/search`,
            ],);
          },
        },),
        it({
          name: 'fetch uses Linkup first when Linkup key is configured',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [{ body: LINKUP_FETCH_RESPONSE, },],
            },);
            /**
             * Local value for client.
             */
            const client = clientWithMock({ mock, exaApiKey: EXA_API_KEY, linkupApiKey: LINKUP_API_KEY, },);

            /**
             * Local value for result.
             */
            const result = await client.fetch({ input: { url: 'https://example.com', }, },);

            expect(result.provider,).toBe('linkup',);
            expect(result.response,).toEqual(LINKUP_FETCH_RESPONSE,);
            expect(mock.calls,).toHaveLength(1,);
            expect(firstCall(mock,).url,).toBe(`${LINKUP_BASE_URL}/fetch`,);
          },
        },),
        it({
          name: 'fetch falls back to Exa contents when Linkup key is missing',
          fn: async () => {
            /**
             * Local value for mock.
             */
            const mock = mockFetch({
              responses: [{ body: EXA_FETCH_RESPONSE, },],
            },);
            /**
             * Local value for client.
             */
            const client = clientWithMock({ mock, exaApiKey: EXA_API_KEY, },);

            /**
             * Local value for result.
             */
            const result = await client.fetch({ input: { url: 'https://example.com', }, },);
            /**
             * Local value for requestBody.
             */
            const requestBody = requestJsonBody(firstCall(mock,),);

            expect(result.provider,).toBe('exa',);
            expect(result.fallback?.reason,).toBe('missing Linkup API key',);
            expect(firstCall(mock,).url,).toBe(`${EXA_BASE_URL}/contents`,);
            expect(requestBody,).toEqual({
              urls: ['https://example.com',],
              text: true,
            },);
          },
        },),
      ],
    },),
  ],
},);

//region Helpers

/**
 * Mock response fixture.
 */
type MockResponse = {
  /**
   * Response body object.
   */
  readonly body: unknown;
  /**
   * HTTP status.
   */
  readonly status?: number;
  /**
   * HTTP status text.
   */
  readonly statusText?: string;
};

/**
 * Recorded fetch call.
 */
type FetchCall = {
  /**
   * Request URL.
   */
  readonly url: string;
  /**
   * Request init.
   */
  readonly init: RequestInit;
};

/**
 * Mock fetch harness.
 */
type FetchMock = {
  /**
   * Fetch implementation passed to client.
   */
  readonly fetchImpl: FetchLike;
  /**
   * Recorded fetch calls.
   */
  readonly calls: FetchCall[];
};

/**
 * Client mock options.
 */
type ClientWithMockOptions = {
  /**
   * Fetch mock.
   */
  readonly mock: FetchMock;
  /**
   * Optional Exa API key.
   */
  readonly exaApiKey?: string;
  /**
   * Optional Linkup API key.
   */
  readonly linkupApiKey?: string;
};

/**
 * Create provider-routing client with common fixtures.
 *
 * @param mock - fetch mock harness
 *
 * @param exaApiKey - optional Exa API key
 *
 * @param linkupApiKey - optional Linkup API key
 *
 * @returns provider-routing client
 */
function clientWithMock(
  {
    mock,
    exaApiKey,
    linkupApiKey,
  }: ClientWithMockOptions,
) {
  return createSearchFetchClient({
    ...(exaApiKey === undefined ? {} : { exaApiKey, }),
    ...(linkupApiKey === undefined ? {} : { linkupApiKey, }),
    blocklist: BLOCKLIST,
    exaBaseUrl: EXA_BASE_URL,
    linkupBaseUrl: LINKUP_BASE_URL,
    fetchImpl: mock.fetchImpl,
  },);
}

/**
 * Create ordered JSON response fetch mock.
 *
 * @param responses - responses returned in call order
 *
 * @returns mock fetch harness
 */
function mockFetch({ responses, }: { readonly responses: readonly MockResponse[]; }): FetchMock {
  /**
   * Recorded calls.
   */
  const calls: FetchCall[] = [];
  /**
   * Fetch implementation.
   */
  async function fetchImpl(input: RequestInfo | URL, init?: RequestInit,): Promise<Response> {
    calls.push({
      url: fetchInputUrl(input,),
      init: init ?? {},
    },);
    /**
     * Local value for response.
     */
    const response = responses[calls.length - 1];
    if (response === undefined)
      throw new Error('unexpected fetch call',);
    return Response.json(
      response.body,
      {
        status: response.status ?? 200,
        statusText: response.statusText ?? 'OK',
      },
    );
  }
  return {
    fetchImpl,
    calls,
  };
}

/**
 * Return URL text for fetch input.
 *
 * @param input - fetch input
 *
 * @returns URL text
 */
function fetchInputUrl(input: RequestInfo | URL,): string {
  if ((typeof input) === 'string')
    return input;
  if (input instanceof URL)
    return input.href;
  return input.url;
}

/**
 * Return first recorded fetch call.
 *
 * @param mock - mock fetch harness
 *
 * @returns first fetch call
 */
function firstCall(mock: FetchMock,): FetchCall {
  /**
   * First recorded call.
   */
  const [call,] = mock.calls;
  if (call === undefined)
    throw new Error('missing fetch call',);
  return call;
}

/**
 * Parse recorded JSON request body.
 *
 * @param call - fetch call
 *
 * @returns parsed JSON object
 */
function requestJsonBody(call: FetchCall,): Record<string, unknown> {
  if ((typeof call.init.body) !== 'string')
    throw new Error('request body was not a string',);
  return JSON.parse(call.init.body,) as Record<string, unknown>;
}

//endregion Helpers
