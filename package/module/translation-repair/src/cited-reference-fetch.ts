//region Cited-reference fetch
// One page's text off the Exa contents endpoint, the same key and transport
// shape as `work-title-search.ts`. Raw `fetch`, no SDK (the owner's rule).
// The endpoint (read on 2026-09-16 at exa.ai/docs/reference/get-contents):
// POST https://api.exa.ai/contents with `urls` and `text.maxCharacters`
// (1 to 10,000), answering `results[]` with `url`, `title`, `text` and
// `statuses[]` with `status` success or error and an `error.tag`.

import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

/**
 Where the contents endpoint lives.
 */
export const EXA_CONTENTS_URL = 'https://api.exa.ai/contents';

/**
 Longest page text carried per reference, in characters. Four thousand holds
 the whole of the Mio blog's passages about the sister and the accident and
 keeps eight references under a third of a sheet.
 */
export const REFERENCE_TEXT_CHARACTERS = 4_000;

/**
 Raised when the endpoint refuses or answers in a shape the reader cannot
 use.

 @example
 ```ts
 throw new CitedReferenceFetchError({ message: 'contents responded 401', },);
 ```
 */
export class CitedReferenceFetchError extends Error {
  /**
   Builds the refusal.

   @param message - what went wrong, never carrying the key

   @example
   ```ts
   throw new CitedReferenceFetchError({ message: 'contents responded 401', },);
   ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'CitedReferenceFetchError';
  }
}

/**
 What one fetch yields: the page's title and text on success, the endpoint's
 error tag on failure. `failure` is present exactly when `status` is error.

 @example
 ```ts
 const fetched: FetchedReference = { status: 'success', title: 'In Memory', text: '...', };
 ```
 */
export type FetchedReference = {
  /**
   Whether the endpoint could read the page.
   */
  readonly status: 'success' | 'error';
  /**
   Page title, empty when the endpoint gave none.
   */
  readonly title: string;
  /**
   Page text up to `REFERENCE_TEXT_CHARACTERS`, empty on failure.
   */
  readonly text: string;
  /**
   Endpoint's error tag, present only on failure.
   */
  readonly failure?: string;
};

/**
 String field of a record, empty when absent or not text.

 @param record - parsed object

 @param key - field to read

 @returns Field text or empty

 @example
 ```ts
 stringField({ record: { title: 'x', }, key: 'title', },);
 // => 'x'
 ```
 */
function stringField(
  {
    record,
    key,
  }: {
    readonly record: Readonly<Record<string, unknown>>;
    readonly key: string;
  },
): string {
  /**
   Raw field.
   */
  const value = record[key];
  return ((typeof value) === 'string') ? value : '';
}

/**
 Failure tag of the first status when it reports an error, empty otherwise.

 @param statuses - endpoint's `statuses`, unknown until read

 @returns Error tag, or empty for success or a missing status

 @example
 ```ts
 failureOf({ statuses: [{ status: 'error', error: { tag: 'CRAWL_NOT_FOUND', }, },], },);
 // => 'CRAWL_NOT_FOUND'
 ```
 */
function failureOf({ statuses, }: { readonly statuses: unknown; },): string {
  if (!isJsonArray(statuses,))
    return '';
  /**
   First status, the only one for a one-url ask.
   */
  const [first,] = statuses;
  if (!isJsonRecord(first,))
    return '';
  if (first.status !== 'error')
    return '';
  /**
   Error detail when the endpoint gave one.
   */
  const detail = isJsonRecord(first.error,) ? first.error : {};
  /**
   Tag naming the failure, or the bare word when there is none.
   */
  const tag = stringField({
    record: detail,
    key: 'tag',
  },);
  return (tag === '') ? 'error' : tag;
}

/**
 Reads the endpoint's answer for one url into a fetched reference.

 @param parsed - response body

 @returns What the body says about the page

 @throws When the body carries no results array

 @example
 ```ts
 const fetched = fetchedOf({ parsed: { results: [{ title: 't', text: 'x', },], statuses: [], }, },);
 ```
 */
export function fetchedOf({ parsed, }: { readonly parsed: unknown; },): FetchedReference {
  if (!isJsonRecord(parsed,))
    throw new CitedReferenceFetchError({ message: 'contents answered with a body that is not an object', },);
  if (!isJsonArray(parsed.results,))
    throw new CitedReferenceFetchError({ message: 'contents answered without a results array', },);
  /**
   Failure tag, empty on success.
   */
  const failure = failureOf({ statuses: parsed.statuses, },);
  /**
   First result, the only one for a one-url ask.
   */
  const [first,] = parsed.results;
  /**
   Result as a record, empty when the endpoint returned none.
   */
  const result = isJsonRecord(first,) ? first : {};
  /**
   Page text the endpoint read.
   */
  const text = stringField({
    record: result,
    key: 'text',
  },);
  /**
   Whether the endpoint returned no result at all.
   */
  const resultless = (text === '') && (first === undefined);
  if ((failure !== '') || resultless) {
    return {
      status: 'error',
      title: stringField({
        record: result,
        key: 'title',
      },),
      text: '',
      failure: (failure === '') ? 'no result' : failure,
    };
  }
  return {
    status: 'success',
    title: stringField({
      record: result,
      key: 'title',
    },),
    text,
  };
}

/**
 Asks the contents endpoint for one page's text.

 @param apiKey - key sent as `x-api-key`, never logged

 @param url - page to read

 @param signal - the call's abort

 @param fetchFn - transport, `fetch` in production and a stub in tests

 @returns What the endpoint read

 @throws When the endpoint answers anything but 2xx or a body without
 results

 @example
 ```ts
 const fetched = await fetchCitedReference({ apiKey, url, signal, fetchFn: fetch, },);
 ```
 */
export async function fetchCitedReference(
  {
    apiKey,
    url,
    signal,
    fetchFn,
  }: {
    readonly apiKey: string;
    readonly url: string;
    readonly signal: AbortSignal;
    readonly fetchFn: typeof fetch;
  },
): Promise<FetchedReference> {
  /**
   Endpoint's answer.
   */
  const response = await fetchFn(
    EXA_CONTENTS_URL,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        urls: [url,],
        text: { maxCharacters: REFERENCE_TEXT_CHARACTERS, },
      },),
      signal,
    },
  );
  if (!response.ok) {
    /**
     Body text for the error, which never carries the key.
     */
    const body = await response.text();
    throw new CitedReferenceFetchError({
      message: `contents responded ${String(response.status,)} for ${url}: ${body}`,
    },);
  }
  /**
   Parsed body.
   */
  const parsed: unknown = await response.json();
  return fetchedOf({ parsed, },);
}

//endregion Cited-reference fetch
