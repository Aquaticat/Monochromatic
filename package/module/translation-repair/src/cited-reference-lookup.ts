//region Cited-reference lookup
// The pages an original links, bought once each through the Exa contents
// endpoint and kept in the reference cache, rendered as the lines the
// critic and panel sheets read (class thirty-five, the owner's decision of
// 2026-09-16: "3, and we have Exa. Such Exa fetched results need to be
// cached too to avoid hitting reference links too much").

import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import { fetchCitedReference, } from './cited-reference-fetch.ts';
import { citedReferenceUrlsOf, } from './cited-reference-scan.ts';
import { foldedLine, } from './entry-notes.ts';
import {
  type CachedReference,
  readCachedReference,
  type ReferenceRecord,
  writeCachedReference,
} from './reference-cache.ts';
import { EXA_API_KEY_VAR, } from './work-title-search.ts';

/**
 Logger root for the lookup.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 Record for one url, from the cache or bought and cached.

 @param url - page as the original links it

 @param apiKey - key for the endpoint

 @param dir - cache directory

 @param signal - the call's abort

 @param fetchFn - transport

 @param now - clock, for the record's time

 @returns Record, cached from now on

 @example
 ```ts
 const record = await lookupCitedReference({ url, apiKey, dir, signal, fetchFn: fetch, now: () => new Date(), },);
 ```
 */
export async function lookupCitedReference(
  {
    url,
    apiKey,
    dir,
    signal,
    fetchFn,
    now,
  }: {
    readonly url: string;
    readonly apiKey: string;
    readonly dir: string;
    readonly signal: AbortSignal;
    readonly fetchFn: typeof fetch;
    readonly now: () => Date;
  },
): Promise<ReferenceRecord> {
  /**
   What the cache holds for it.
   */
  const cached = await readCachedReference({
    dir,
    url,
  },);
  if (cached.kind === 'hit')
    return cached.record;
  /**
   When this record was bought.
   */
  const bought = now();
  /**
   What the endpoint read.
   */
  const fetched = await fetchCitedReference({
    apiKey,
    url,
    signal,
    fetchFn,
  },);
  /**
   Fresh record.
   */
  const record: ReferenceRecord = {
    url,
    fetchedAt: bought.toISOString(),
    ...fetched,
  };
  await writeCachedReference({
    dir,
    record,
  },);
  return record;
}

/**
 Line a record contributes to the sheets: the page's text on one line, or
 why there is none.

 @param index - position among the entry's references, from one

 @param record - record for the page

 @returns One line

 @example
 ```ts
 referenceLineOf({ index: 1, record, },);
 // => '- reference 1 https://a.example/post ("Post"): the page text...'
 ```
 */
export function referenceLineOf(
  {
    index,
    record,
  }: {
    readonly index: number;
    readonly record: ReferenceRecord;
  },
): string {
  /**
   Line head naming the page.
   */
  const head = `- reference ${String(index,)} ${record.url}`;
  if (record.status === 'error')
    return `${head}: could not be fetched (${record.failure ?? 'error'})`;
  /**
   Text on one line.
   */
  const text = foldedLine({ text: record.text, },);
  if (text === '')
    return `${head}: nothing readable on the page`;
  /**
   Title part, absent when the page has none.
   */
  const title = (record.title === '') ? '' : ` ("${foldedLine({ text: record.title, },)}")`;
  return `${head}${title}: ${text}`;
}

/**
 Block of reference lines for one original: what every page it links says,
 bought once and cached, one line per page in order of citation. Empty when
 the original links nowhere or no key is set.

 @param sourceText - original document

 @param apiKey - key for the endpoint; empty means no references at all

 @param dir - cache directory

 @param signal - the entry's abort

 @param fetchFn - transport

 @param now - clock

 @param logger - entry logger

 @returns Lines joined by newlines, or an empty string

 @example
 ```ts
 const referenceContext = await citedReferenceBlock({ sourceText, apiKey, dir, signal, fetchFn: fetch, now: () => new Date(), logger: l, },);
 ```
 */
export async function citedReferenceBlock(
  {
    sourceText,
    apiKey,
    dir,
    signal,
    fetchFn,
    now,
    logger,
  }: {
    readonly sourceText: string;
    readonly apiKey: string;
    readonly dir: string;
    readonly signal: AbortSignal;
    readonly fetchFn: typeof fetch;
    readonly now: () => Date;
    readonly logger: Logger;
  },
): Promise<string> {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: citedReferenceBlock.name,
    l: logger,
  },);
  /**
   Pages the original links.
   */
  const urls = citedReferenceUrlsOf({ text: sourceText, },);
  if (urls.length === 0)
    return '';
  if (apiKey === '') {
    rl.warn(`${EXA_API_KEY_VAR} is not set; ${String(urls.length,)} cited references go unread`,);
    return '';
  }
  /**
   What the cache held for each page before the ask, so the log can say
   what was bought and what was read back.
   */
  const held = await Promise.all(urls.map(function heldFor(url,): Promise<CachedReference> {
    return readCachedReference({
      dir,
      url,
    },);
  },),);
  /**
   Answers that were hits.
   */
  const hits = held.filter(function isHit(answer,): boolean {
    return answer.kind === 'hit';
  },);
  /**
   How many that is.
   */
  const cachedCount = hits.length;
  /**
   Line per url, bought together; a failure is logged and yields a line
   saying so, so the sheet still names the page.
   */
  const lines = await Promise.all(urls.map(async function lineFor(
    url,
    at,
  ): Promise<string> {
    /**
     Position among the references, from one.
     */
    const index = at + 1;
    /**
     What the cache answered for this page before the ask.
     */
    const answer = held[at];
    /**
     Whether that answer was a hit.
     */
    const wasHeld = answer?.kind === 'hit';
    try {
      /**
       Record for this page, cached or fresh.
       */
      const record = await lookupCitedReference({
        url,
        apiKey,
        dir,
        signal,
        fetchFn,
        now,
      },);
      /**
       Page text, for its length.
       */
      const { text, } = record;
      rl.info(
        `REFERENCE ${String(index,)} ${url}: ${record.status}, ${String(text.length,)} chars${
          wasHeld ? ', cached' : ', bought'
        }`,
      );
      return referenceLineOf({
        index,
        record,
      },);
    } catch (error) {
      rl.warn(`reference ${String(index,)} ${url} could not be fetched: ${String(error,)}`,);
      return `- reference ${String(index,)} ${url}: could not be fetched`;
    }
  },),);
  rl.info(
    `REFERENCES cited=${String(urls.length,)} cached=${String(cachedCount,)} bought=${
      String(urls.length - cachedCount,)
    }`,
  );
  return lines.join('\n',);
}

//endregion Cited-reference lookup
