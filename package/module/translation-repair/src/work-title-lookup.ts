import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';

import {
  type LookupRecord,
  readCachedLookup,
  writeCachedLookup,
} from './lookup-cache.ts';
import {
  lookupQueryFor,
  workTitlesOf,
} from './work-title-scan.ts';
import {
  EXA_API_KEY_VAR,
  searchWorkTitle,
} from './work-title-search.ts';

//region Work-title lookup
// Official English titles of the works an original names, looked up on the
// web once and carried to every sheet as evidence lines.
//
// WHY. The owner's rule of 2026-09-02 (`doc/decision/translation-repair-work-titles-established-vocabulary.md`):
// "If something has an official English translation, use that." A translator
// working one slice cannot know whether 《活着》 has an English edition (it
// does: "To Live"), and the Toka_ls reading found the archive's "Life of Aiden"
// re-rendered by a judge that missed the play on "Life of Pi". The owner then
// added `TRANSLATION_REPAIR_EXA_API_KEY` and said: "Looking up official
// translations and the like can and should be cached."
//
// EVIDENCE, NOT AUTHORITY. A search result can be wrong; the lines say what
// the web returned and the house rule says what an official title is. The
// sheets read a "web lookup" line as evidence to weigh.

/**
 * Logger root for the lookup.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Record for one title, from the cache or bought and cached.
 *
 * @param title - title with its marks
 *
 * @param apiKey - key for the endpoint
 *
 * @param dir - cache directory
 *
 * @param signal - the call's abort
 *
 * @param fetchFn - transport
 *
 * @param now - clock, for the record's time
 *
 * @returns Record, cached from now on
 *
 * @example
 * ```ts
 * const record = await lookupWorkTitle({ title: '《活着》', apiKey, dir, signal, fetchFn: fetch, now: () => new Date(), },);
 * ```
 */
export async function lookupWorkTitle(
  {
    title,
    apiKey,
    dir,
    signal,
    fetchFn,
    now,
  }: {
    readonly title: string;
    readonly apiKey: string;
    readonly dir: string;
    readonly signal: AbortSignal;
    readonly fetchFn: typeof fetch;
    readonly now: () => Date;
  },
): Promise<LookupRecord> {
  /**
   * Query the cache and the endpoint are keyed on.
   */
  const query = lookupQueryFor({ title, },);
  /**
   * What the cache holds for it.
   */
  const cached = await readCachedLookup({
    dir,
    query,
  },);
  if (cached.kind === 'hit')
    return cached.record;
  /**
   * When this record was bought.
   */
  const bought = now();
  /**
   * Fresh record.
   */
  const record: LookupRecord = {
    query,
    fetchedAt: bought.toISOString(),
    hits: await searchWorkTitle({
      apiKey,
      query,
      signal,
      fetchFn,
    },),
  };
  await writeCachedLookup({
    dir,
    record,
  },);
  return record;
}

/**
 * Lines a record contributes to the identity context.
 *
 * @param title - title with its marks
 *
 * @param record - record for it
 *
 * @returns One line per hit, or one line saying the web returned nothing
 *
 * @example
 * ```ts
 * lookupLinesOf({ title: '《活着》', record, },);
 * // => ['- web lookup for 《活着》: "To Live (novel) - Wikipedia" https://en.wikipedia.org/wiki/To_Live_(novel): To Live is a novel by Yu Hua...']
 * ```
 */
export function lookupLinesOf(
  {
    title,
    record,
  }: {
    readonly title: string;
    readonly record: LookupRecord;
  },
): readonly string[] {
  /**
   * Hits to render.
   */
  const { hits, } = record;
  if (hits.length === 0)
    return [`- web lookup for ${title}: nothing found`,];
  return hits.map(function toLine(hit,): string {
    /**
     * Highlight on one line, or nothing.
     */
    const highlight = hit.highlight
      .split('\n',)
      .join(' ',)
      .trim();
    /**
     * Highlight part of the line, absent when there is none.
     */
    const tail = (highlight === '') ? '' : `: ${highlight}`;
    return `- web lookup for ${title}: "${hit.title}" ${hit.url}${tail}`;
  },);
}

/**
 * Evidence lines for every work an original names, each title looked up once
 * and cached; a failed lookup is logged and contributes no line.
 *
 * @param sourceText - original document
 *
 * @param apiKey - key for the endpoint; empty means no lookups at all
 *
 * @param dir - cache directory
 *
 * @param signal - the entry's abort
 *
 * @param fetchFn - transport
 *
 * @param now - clock
 *
 * @param logger - entry logger
 *
 * @returns Lines in title order, empty when the original names no work or no
 * key is set
 *
 * @example
 * ```ts
 * const lines = await workTitleLookupLines({ sourceText, apiKey, dir, signal, fetchFn: fetch, now: () => new Date(), logger: l, },);
 * ```
 */
export async function workTitleLookupLines(
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
): Promise<readonly string[]> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const wl = tagged({
    tag: workTitleLookupLines.name,
    l: logger,
  },);
  /**
   * Works the original names.
   */
  const titles = workTitlesOf({ text: sourceText, },);
  if (titles.length === 0)
    return [];
  if (apiKey === '') {
    wl.warn(`${EXA_API_KEY_VAR} is not set; ${String(titles.length,)} work titles go unlooked-up`,);
    return [];
  }
  /**
   * Lines per title, bought together; a failure is logged and yields none.
   */
  const perTitle = await Promise.all(titles.map(async function linesFor(title,): Promise<readonly string[]> {
    try {
      /**
       * Record for this title, cached or fresh.
       */
      const record = await lookupWorkTitle({
        title,
        apiKey,
        dir,
        signal,
        fetchFn,
        now,
      },);
      return lookupLinesOf({
        title,
        record,
      },);
    } catch (error) {
      wl.warn(`lookup for ${title} failed and contributes no line: ${String(error,)}`,);
      return [];
    }
  },),);
  /**
   * Every line, in title order.
   */
  const lines = perTitle.flat();
  wl.info(`${String(titles.length,)} work titles looked up, ${String(lines.length,)} lines`,);
  return lines;
}

//endregion Work-title lookup
