import type { LookupHit, } from './lookup-cache.ts';

//region Work-title search
// One call to the Exa search endpoint for one title.
//
// NO SDK. The workspace bans `exa-js`; this is one `fetch` against `/search`,
// the request shape read off the reference on 2026-09-02
// (https://exa.ai/docs/reference/search): POST, `x-api-key` header, `query`,
// `type`, `numResults`, `contents.highlights` with its own `query` and
// `maxCharacters`; the response carries `results[]` with `title`, `url` and
// `highlights[]`. Exercised by hand the same day: 《活着》 answered "To Live",
// 《魔法少女小圆》 "Puella Magi Madoka Magica", about 1.5 s and $0.007 a query.

/**
 * Environment variable carrying the Exa API key, injected by mise from the
 * encrypted secrets file. Never logged, never written.
 */
export const EXA_API_KEY_VAR = 'TRANSLATION_REPAIR_EXA_API_KEY';

/**
 * Where the search endpoint lives.
 */
export const EXA_SEARCH_URL = 'https://api.exa.ai/search';

/**
 * Results asked for per title: enough to show an official edition beside a
 * fan rendering, few enough to read.
 */
export const RESULTS_PER_TITLE = 5;

/**
 * Longest highlight carried per result, in characters.
 */
export const HIGHLIGHT_CHARACTERS = 300;

/**
 * Raised when the search endpoint refuses or answers in a shape the reader
 * cannot use.
 *
 * @example
 * ```ts
 * throw new WorkTitleLookupError({ message: 'search responded 401', },);
 * ```
 */
export class WorkTitleLookupError extends Error {
  /**
   * Builds the refusal.
   *
   * @param message - what went wrong, never carrying the key
   *
   * @example
   * ```ts
   * throw new WorkTitleLookupError({ message: 'search responded 401', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'WorkTitleLookupError';
  }
}

/**
 * One search result as the endpoint returns it, the fields read here.
 */
type SearchResultWire = {
  readonly title?: unknown;
  readonly url?: unknown;
  readonly highlights?: unknown;
};

/**
 * Hits one wire result yields: one when it carries a url, none otherwise.
 *
 * @param value - element of the response's results
 *
 * @returns Zero or one hit, so callers flatten instead of filtering absence
 *
 * @example
 * ```ts
 * hitsOf({ value: { title: 'To Live', url: 'https://x', highlights: ['...'], }, },);
 * ```
 */
export function hitsOf(
  { value, }: { readonly value: unknown; },
): readonly LookupHit[] {
  if (((typeof value) !== 'object') || (value === null))
    return [];
  /**
   * Fields read.
   */
  const wire = value as SearchResultWire;
  if ((typeof wire.url) !== 'string')
    return [];
  /**
   * Highlights as unknowns when the endpoint returned any.
   */
  const highlights: readonly unknown[] = Array.isArray(wire.highlights,) ? wire.highlights : [];
  /**
   * First highlight when it is text.
   */
  const [first,] = highlights;
  return [{
    title: ((typeof wire.title) === 'string') ? wire.title : '',
    url: wire.url,
    highlight: ((typeof first) === 'string') ? first : '',
  },];
}

/**
 * Asks the search endpoint about one title.
 *
 * @param apiKey - key sent as `x-api-key`, never logged
 *
 * @param query - search string
 *
 * @param signal - the call's abort
 *
 * @param fetchFn - transport, `fetch` in production and a stub in tests
 *
 * @returns Hits the endpoint returned
 *
 * @throws {@link WorkTitleLookupError} when the endpoint answers anything but
 * 2xx or a body without a results array
 *
 * @example
 * ```ts
 * const hits = await searchWorkTitle({ apiKey, query, signal, fetchFn: fetch, },);
 * ```
 */
export async function searchWorkTitle(
  {
    apiKey,
    query,
    signal,
    fetchFn,
  }: {
    readonly apiKey: string;
    readonly query: string;
    readonly signal: AbortSignal;
    readonly fetchFn: typeof fetch;
  },
): Promise<readonly LookupHit[]> {
  /**
   * Endpoint's answer.
   */
  const response = await fetchFn(
    EXA_SEARCH_URL,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        type: 'auto',
        numResults: RESULTS_PER_TITLE,
        contents: {
          highlights: {
            query,
            maxCharacters: HIGHLIGHT_CHARACTERS,
          },
        },
      },),
      signal,
    },
  );
  if (!response.ok) {
    /**
     * Body text for the error, which never carries the key.
     */
    const body = await response.text();
    throw new WorkTitleLookupError({
      message: `search responded ${String(response.status,)} for ${query}: ${body}`,
    },);
  }
  /**
   * Parsed body.
   */
  const parsed: unknown = await response.json();
  /**
   * Results field when the body is an object.
   */
  const results = (((typeof parsed) === 'object') && (parsed !== null))
    ? (parsed as { readonly results?: unknown; }).results
    : [];
  if (!Array.isArray(results,)) {
    throw new WorkTitleLookupError({
      message: `search answered without a results array for ${query}`,
    },);
  }
  /**
   * Results as unknowns, each narrowed.
   */
  const wires: readonly unknown[] = results;
  return wires.flatMap(function toHits(value,): readonly LookupHit[] {
    return hitsOf({ value, },);
  },);
}

//endregion Work-title search
