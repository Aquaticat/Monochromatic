/**
 * Tests the cached web lookup of official English titles.
 *
 * THE TRANSPORT IS A STUB: the real endpoint was exercised once by hand on
 * 2026-09-02 (《活着》 answered "To Live", 《魔法少女小圆》 answered "Puella Magi
 * Madoka Magica", about 1.5 s and $0.007 a query) and these tests cover what
 * the module does around it: which titles are asked, how a record is cached
 * and read back, how hits become lines, and what a failure or a missing key
 * leaves behind.
 *
 * @module
 */

import { mkdtemp, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  EXA_SEARCH_URL,
  isLookupRecord,
  lookupCacheDir,
  lookupLinesOf,
  lookupQueryFor,
  type LookupRecord,
  lookupWorkTitle,
  readCachedLookup,
  searchWorkTitle,
  workTitleLookupLines,
  workTitlesOf,
  WorkTitleLookupError,
  writeCachedLookup,
} from '../dist/final/node/index.mjs';

/**
 * Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 * Fixed clock.
 */
const NOW = new Date('2026-09-02T10:00:00.000Z',);

/**
 * Logger for the lines function.
 */
const l = tagged({ tag: 'work-title-lookup-test', },);

/**
 * One call a stub transport saw.
 */
type SeenCall = {
  readonly url: string;
  readonly init: RequestInit;
};

/**
 * Where a fetch input points, whatever form it takes.
 *
 * @param input - first argument of `fetch`
 *
 * @returns Its url as text
 *
 * @example
 * ```ts
 * urlOf({ input: 'https://x', },);
 * ```
 */
function urlOf({ input, }: { readonly input: string | URL | Request; },): string {
  if ((typeof input) === 'string')
    return input;
  if (input instanceof URL)
    return input.href;
  return input.url;
}

/**
 * Builds a transport answering a fixed body and counting calls.
 *
 * @param status - HTTP status to answer
 *
 * @param body - JSON body to answer
 *
 * @returns Transport plus the calls it saw
 *
 * @example
 * ```ts
 * const { fetchFn, calls, } = stubFetch({ status: 200, body: { results: [], }, },);
 * ```
 */
function stubFetch(
  {
    status,
    body,
  }: {
    readonly status: number;
    readonly body: unknown;
  },
): {
  readonly fetchFn: typeof fetch;
  readonly calls: SeenCall[];
} {
  /**
   * Calls seen.
   */
  const calls: SeenCall[] = [];
  return {
    calls,
    fetchFn: async function fetchFn(input, init,): Promise<Response> {
      calls.push({
        url: urlOf({ input, },),
        init: init ?? {},
      },);
      return Response.json(
        body,
        { status, },
      );
    },
  };
}

/**
 * Fresh cache directory for one case.
 *
 * @returns Directory path
 *
 * @example
 * ```ts
 * const dir = await freshCacheDir();
 * ```
 */
async function freshCacheDir(): Promise<string> {
  return await mkdtemp(join(
    tmpdir(),
    'work-title-lookup-',
  ),);
}

/**
 * One endpoint result as the reference describes it.
 */
const TO_LIVE_RESULT = {
  title: 'To Live (novel) - Wikipedia',
  url: 'https://en.wikipedia.org/wiki/To_Live_(novel)',
  highlights: ['To Live (活着) is a novel\nby Yu Hua.',],
  highlightScores: [0.9,],
};

await describe({
  name: workTitlesOf.name,
  children: [
    it({
      name: 'FINDS every 《…》 span once, in order, marks included, and stops at an unclosed mark',
      fn: async () => {
        expect(workTitlesOf({ text: '她读《活着》，又读《活着》，还读《不安》。《未完', },),)
          .toEqual(['《活着》', '《不安》',],);
        expect(workTitlesOf({ text: '没有书名号。', },),).toEqual([],);
        expect(lookupQueryFor({ title: '《活着》', },),).toBe('《活着》 official English title',);
      },
    },),
  ],
},);

await describe({
  name: lookupCacheDir.name,
  children: [
    it({
      name: 'PREFERS the override, then XDG_CACHE_HOME, then the home cache directory',
      fn: async () => {
        expect(lookupCacheDir({
          env: {
            TRANSLATION_REPAIR_LOOKUP_CACHE_DIR: '/tmp/x',
            XDG_CACHE_HOME: '/tmp/y',
          },
        },),).toBe('/tmp/x',);
        expect(lookupCacheDir({ env: { XDG_CACHE_HOME: '/tmp/y', }, },),).toBe('/tmp/y/translation-repair/lookup',);
        expect(lookupCacheDir({ env: {}, },),).toContain('/.cache/translation-repair/lookup',);
      },
    },),
  ],
},);

await describe({
  name: lookupWorkTitle.name,
  children: [
    it({
      name: 'BUYS a title once and READS IT BACK from the cache on every later ask, so a resumed run '
        + 'sees the same lines',
      fn: async () => {
        /**
         * Empty cache.
         */
        const dir = await freshCacheDir();
        /**
         * Transport answering one hit.
         */
        const { fetchFn, calls, } = stubFetch({
          status: 200,
          body: { results: [TO_LIVE_RESULT,], },
        },);
        /**
         * Shared arguments.
         */
        const ask = {
          title: '《活着》',
          apiKey: 'test-key',
          dir,
          signal: SIGNAL,
          fetchFn,
          now: () => NOW,
        };
        /**
         * First ask, bought.
         */
        const first = await lookupWorkTitle(ask,);
        /**
         * Second ask, read back.
         */
        const second = await lookupWorkTitle(ask,);
        expect(calls.length,).toBe(1,);
        expect(first,).toEqual({
          query: '《活着》 official English title',
          fetchedAt: NOW.toISOString(),
          hits: [{
            title: TO_LIVE_RESULT.title,
            url: TO_LIVE_RESULT.url,
            highlight: 'To Live (活着) is a novel\nby Yu Hua.',
          },],
        },);
        expect(second,).toEqual(first,);
        expect(await readCachedLookup({
          dir,
          query: first.query,
        },),).toEqual({
          kind: 'hit',
          record: first,
        },);
        expect(isLookupRecord(first,),).toBe(true,);
        expect(isLookupRecord({ query: 1, },),).toBe(false,);

        /**
         * What the transport was sent.
         */
        const [call,] = calls;
        if (call === undefined)
          throw new Error('the transport saw no call',);
        /**
         * Headers as sent.
         */
        const headers = call.init.headers as Record<string, string>;
        /**
         * Body as sent.
         */
        const { body, } = call.init;
        if ((typeof body) !== 'string')
          throw new Error('the request body was not text',);
        expect(call.url,).toBe(EXA_SEARCH_URL,);
        expect(headers['x-api-key'],).toBe('test-key',);
        expect(JSON.parse(body,),).toEqual({
          query: '《活着》 official English title',
          type: 'auto',
          numResults: 5,
          contents: {
            highlights: {
              query: '《活着》 official English title',
              maxCharacters: 300,
            },
          },
        },);
      },
    },),

    it({
      name: 'REFUSES a non-2xx answer and a body without results, naming the query and never the key',
      fn: async () => {
        /**
         * Refusing transport.
         */
        const refused = stubFetch({
          status: 401,
          body: { error: 'bad key', },
        },);
        /**
         * What the refusal threw.
         */
        let thrown: unknown;
        try {
          await searchWorkTitle({
            apiKey: 'secret-key',
            query: '《活着》 official English title',
            signal: SIGNAL,
            fetchFn: refused.fetchFn,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown instanceof WorkTitleLookupError,).toBe(true,);
        expect((thrown as Error).message,).toContain('401',);
        expect((thrown as Error).message,).not.toContain('secret-key',);

        /**
         * Shapeless transport.
         */
        const shapeless = stubFetch({
          status: 200,
          body: { nothing: true, },
        },);
        /**
         * What the shapeless answer threw.
         */
        let thrownShapeless: unknown;
        try {
          await searchWorkTitle({
            apiKey: 'secret-key',
            query: '《活着》 official English title',
            signal: SIGNAL,
            fetchFn: shapeless.fetchFn,
          },);
        } catch (error) {
          thrownShapeless = error;
        }
        expect(thrownShapeless instanceof WorkTitleLookupError,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: workTitleLookupLines.name,
  children: [
    it({
      name: 'RENDERS one line per hit with the highlight folded, WARNS on a result that never names the '
        + 'work and lists it after the ones that do (the Toka_ls rerun of 2026-09-02 renamed 《奇妙漂流》 '
        + '"Flow" off five neighbour results), says so when nothing was found, and contributes NO LINE '
        + 'for a failed lookup while still rendering the others',
      fn: async () => {
        /**
         * Empty cache.
         */
        const dir = await freshCacheDir();
        /**
         * Record already cached for one title, with no hits.
         */
        const empty: LookupRecord = {
          query: lookupQueryFor({ title: '《不安》', },),
          fetchedAt: NOW.toISOString(),
          hits: [],
        };
        await writeCachedLookup({
          dir,
          record: empty,
        },);
        /**
         * Transport answering the other title.
         */
        const { fetchFn, calls, } = stubFetch({
          status: 200,
          body: {
            results: [
              {
                title: '喵的奇幻漂流',
                url: 'https://example.invalid/neighbour',
                highlights: ['A 2024 Latvian animated film.',],
              },
              TO_LIVE_RESULT,
              { url: 'https://example.invalid/none', },
            ],
          },
        },);
        expect(await workTitleLookupLines({
          sourceText: '读《活着》和《不安》。',
          apiKey: 'test-key',
          dir,
          signal: SIGNAL,
          fetchFn,
          now: () => NOW,
          logger: l,
        },),).toEqual([
          '- web lookup for 《活着》: "To Live (novel) - Wikipedia" https://en.wikipedia.org/wiki/To_Live_(novel): To Live (活着) is a novel by Yu Hua.',
          '- web lookup for 《活着》 (this result does NOT name the work asked about; it is a neighbour, not its title): "喵的奇幻漂流" https://example.invalid/neighbour: A 2024 Latvian animated film.',
          '- web lookup for 《活着》 (this result does NOT name the work asked about; it is a neighbour, not its title): "" https://example.invalid/none',
          '- web lookup for 《不安》: nothing found',
        ],);
        expect(calls.length,).toBe(1,);
        expect(lookupLinesOf({
          title: '《不安》',
          record: empty,
        },),).toEqual(['- web lookup for 《不安》: nothing found',],);

        /**
         * Refusing transport over a fresh cache.
         */
        const refused = stubFetch({
          status: 500,
          body: {},
        },);
        expect(await workTitleLookupLines({
          sourceText: '读《活着》。',
          apiKey: 'test-key',
          dir: await freshCacheDir(),
          signal: SIGNAL,
          fetchFn: refused.fetchFn,
          now: () => NOW,
          logger: l,
        },),).toEqual([],);
      },
    },),

    it({
      name: 'ASKS NOTHING without a key or without a title, so a run without the secret changes nothing '
        + 'but a log line',
      fn: async () => {
        /**
         * Transport that must not be called.
         */
        const { fetchFn, calls, } = stubFetch({
          status: 200,
          body: { results: [], },
        },);
        expect(await workTitleLookupLines({
          sourceText: '读《活着》。',
          apiKey: '',
          dir: await freshCacheDir(),
          signal: SIGNAL,
          fetchFn,
          now: () => NOW,
          logger: l,
        },),).toEqual([],);
        expect(await workTitleLookupLines({
          sourceText: '没有书名号。',
          apiKey: 'test-key',
          dir: await freshCacheDir(),
          signal: SIGNAL,
          fetchFn,
          now: () => NOW,
          logger: l,
        },),).toEqual([],);
        expect(calls.length,).toBe(0,);
      },
    },),
  ],
},);
