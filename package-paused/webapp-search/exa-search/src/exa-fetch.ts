/**
 * Direct `fetch` client against the Exa AI search API.
 *
 * Replaces the deprecated `exa-js` SDK; the `.pnpmfile.mjs` throwing-stub
 * policy at the workspace root bans the SDK from `node_modules`.
 *
 * @see https://docs.exa.ai/reference/search
 */

import * as v from 'valibot';

/**
 * Per-result content-retrieval flags sent in the `contents` field.
 */
export type ExaContentsOptions = {
  text?: boolean;
  highlights?: boolean;
  summary?: boolean;
  subpages?: number;
  extras?: {
    links?: number;
    imageLinks?: number;
  };
};

/**
 * Search options sent alongside `query` in the request body.
 */
export type ExaSearchOptions = {
  type?: 'auto' | 'neural' | 'keyword';
  numResults?: number;
  contents?: ExaContentsOptions;
};

/**
 * Single result entry in an Exa `/search` response.
 */
export type ExaSearchResult = {
  title: string | null;
  url: string;
  publishedDate?: string | undefined;
  author?: string | undefined;
  text: string;
  summary: string;
  highlights: string[];
  favicon?: string | undefined;
  image?: string | undefined;
};

/**
 * Top-level shape of an Exa `/search` response.
 */
export type ExaSearchResponse = {
  results: ExaSearchResult[];
  costDollars?: { total?: number | undefined; } | undefined;
};

/**
 * Runtime schema for one Exa search result, used to narrow fetched JSON.
 */
const ExaSearchResultSchema: v.GenericSchema<ExaSearchResult> = v.object({
  title: v.nullable(v.string(),),
  url: v.string(),
  publishedDate: v.optional(v.string(),),
  author: v.optional(v.string(),),
  text: v.string(),
  summary: v.string(),
  highlights: v.array(v.string(),),
  favicon: v.optional(v.string(),),
  image: v.optional(v.string(),),
},);

/**
 * Runtime schema for Exa `/search` responses, used to narrow fetched JSON.
 */
const ExaSearchResponseSchema: v.GenericSchema<ExaSearchResponse> = v.object({
  results: v.array(ExaSearchResultSchema,),
  costDollars: v.optional(
    v.object({
      total: v.optional(v.number(),),
    },),
  ),
},);

/**
 * POSTs the query merged with options to the `/search` endpoint of `baseUrl`
 * and returns the parsed JSON response.
 *
 * `baseUrl` matches the legacy SDK's positional argument: the origin (and
 * optional path prefix) of the Exa API or its proxy; the hardcoded `/search`
 * suffix is appended internally to mirror the SDK's URL shape.
 *
 * @param apiKey - Exa API key sent as the `x-api-key` header
 *
 * @param baseUrl - Origin (and optional path prefix) for the Exa API; `/search` is appended
 *
 * @param query - User-supplied search query
 *
 * @param options - Optional search parameters merged into the request body
 *
 * @returns Parsed `/search` JSON response
 *
 * @throws when the response status is not 2xx; message embeds status, statusText, and the response body
 *
 * @example
 * ```ts
 * const response = await searchExa(
 *   { apiKey: 'uuid', baseUrl: 'https://api.exa.ai', query: 'foo' },
 * );
 * ```
 */
export async function searchExa({
  apiKey,
  baseUrl,
  query,
  options,
}: {
  apiKey: string;
  baseUrl: string;
  query: string;
  options?: ExaSearchOptions;
},): Promise<ExaSearchResponse> {
  /**
   * HTTP `Response` retained so the success and error branches share one instance.
   */
  const response = await fetch(
    `${baseUrl}/search`,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        ...options,
      },),
    },
  );

  if (!response.ok) {
    /**
     * Response body text embedded in the thrown error for diagnostic context.
     */
    const errorBody = await response.text();
    throw new Error(
      `Exa /search responded ${response.status} ${response.statusText}: ${errorBody}`,
    );
  }

  /**
   * Parsed body typed as `unknown` before Valibot narrows it to the response schema.
   */
  const data: unknown = await response.json();
  return v.parse(
    ExaSearchResponseSchema,
    data,
  );
}
