/**
 Tests the cited-reference channel (class thirty-five, 2026-09-16): which
 pages an original links, how one page is bought off the contents endpoint,
 how it is cached and read back, and the lines and block the critic and
 panel sheets carry.

 THE TRANSPORT IS A STUB: the real endpoint was exercised once by hand on
 2026-09-16 (the Mio blog's archived copy answered its text) and these tests
 cover what the module does around it.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CITED_REFERENCE_CANDIDATE_RULE,
  CITED_REFERENCE_RULE,
  citedReferenceBlock,
  citedReferenceBlockText,
  citedReferenceCandidateLines,
  citedReferenceEvidence,
  CitedReferenceFetchError,
  citedReferenceUrlsOf,
  EXA_CONTENTS_URL,
  fetchCitedReference,
  fetchedOf,
  isReferenceRecord,
  LOOKUP_CACHE_DIR_VAR,
  lookupCitedReference,
  MAX_CITED_REFERENCES,
  readCachedReference,
  REFERENCE_TEXT_CHARACTERS,
  referenceCacheDir,
  referenceCachePath,
  referenceLineOf,
  type ReferenceRecord,
  writeCachedReference,
} from '../dist/final/node/index.mjs';

/**
 Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 Fixed clock.
 */
const NOW = new Date('2026-09-16T16:00:00.000Z',);

/**
 Logger for the block function.
 */
const l = tagged({ tag: 'cited-reference-test', },);

/**
 Page the invented original cites.
 */
const POST_URL = 'https://cats.example/posts/in-memory-of-mittens';

/**
 Archived copy of that page, cited beside it.
 */
const ARCHIVE_URL = 'https://web.archive.org/web/20260101000000/https://cats.example/posts/in-memory-of-mittens';

/**
 Invented original citing a page, its archive, a bare link ending a sentence,
 the corpus's own site and a photo path.
 */
const SOURCE_TEXT = `喵喵有一个姐姐。参考链接：[博客・怀念喵喵](${POST_URL})（[存档](${ARCHIVE_URL})）

另见 https://cats.example/posts/in-memory-of-mittens 和 https://one-among.us/people/mittens。

<PhotoScroll photos={['\${path}/photos/photo1.webp',]} />
`;

/**
 One call a stub transport saw.
 */
type SeenCall = {
  readonly url: string;
  readonly body: string;
  readonly key: string;
};

/**
 Stub transport answering one fixed body and recording every call.

 @param status - HTTP status to answer

 @param body - JSON body to answer

 @returns Transport and the calls it saw

 @example
 ```ts
 const { fetchFn, seen, } = stubTransport({ status: 200, body: {}, },);
 ```
 */
function stubTransport(
  {
    status,
    body,
  }: {
    readonly status: number;
    readonly body: unknown;
  },
): {
  readonly fetchFn: typeof fetch;
  readonly seen: SeenCall[];
} {
  /**
   Calls seen so far.
   */
  const seen: SeenCall[] = [];
  /**
   Transport under test.

   @param input - what production would hand the transport

   @param init - request as production builds it

   @returns The fixed answer
   */
  async function stubbed(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    /**
     Headers as sent.
     */
    const headers = new Headers(init?.headers,);
    /**
     Body as sent, text or nothing.
     */
    const sent = init?.body;
    seen.push({
      url: ((typeof input) === 'string') ? input : ((input instanceof URL) ? input.href : input.url),
      body: ((typeof sent) === 'string') ? sent : '',
      key: headers.get('x-api-key',) ?? '',
    },);
    return Response.json(
      body,
      { status, },
    );
  }
  return {
    fetchFn: stubbed,
    seen,
  };
}

/**
 Body the endpoint answers for a readable page.
 */
const READABLE_BODY = {
  results: [{
    url: POST_URL,
    title: 'In memory of Mittens',
    text: 'Mittens had an older sister.\nThe sister was also a tabby.',
  },],
  statuses: [{
    id: POST_URL,
    status: 'success',
  },],
};

await describe({
  name: citedReferenceUrlsOf.name,
  children: [
    it({
      name: 'FINDS every link once, in order, trailing punctuation removed, the corpus\'s own site and photo paths left out',
      fn: async () => {
        expect(citedReferenceUrlsOf({ text: SOURCE_TEXT, },),).toEqual([
          POST_URL,
          ARCHIVE_URL,
        ],);
        expect(citedReferenceUrlsOf({ text: '没有链接。', },),).toEqual([],);
      },
    },),
    it({
      name: 'LEAVES OUT profile pages (a GitHub user, a twitter handle, a bilibili space, a zhihu person) and keeps pages under them',
      fn: async () => {
        expect(citedReferenceUrlsOf({
          text: [
            'https://github.com/whiskers',
            'https://twitter.com/whiskers',
            'https://x.com/whiskers/',
            'https://space.bilibili.com/123456',
            'https://www.zhihu.com/people/whiskers',
            'https://t.me/whiskers',
            'https://github.com/whiskers/naps',
            'https://twitter.com/whiskers/status/1',
            'https://www.zhihu.com/question/1',
          ].join(' ',),
        },),).toEqual([
          'https://github.com/whiskers/naps',
          'https://twitter.com/whiskers/status/1',
          'https://www.zhihu.com/question/1',
        ],);
      },
    },),
    it({
      name: 'STOPS at the reference cap, in order of citation',
      fn: async () => {
        /**
         Original citing more pages than the cap.
         */
        const many = Array.from(
          { length: MAX_CITED_REFERENCES + 2, },
          function link(_,
            at,): string {
            return `https://cats.example/p/${String(at,)}`;
          },
        )
          .join(' ',);
        expect(citedReferenceUrlsOf({ text: many, },).length,).toBe(MAX_CITED_REFERENCES,);
        expect(citedReferenceUrlsOf({ text: many, },).at(0,),).toBe('https://cats.example/p/0',);
      },
    },),
  ],
},);

await describe({
  name: fetchedOf.name,
  children: [
    it({
      name: 'READS a readable page, an endpoint error tag, and an empty answer, and REFUSES a body without results',
      fn: async () => {
        expect(fetchedOf({ parsed: READABLE_BODY, },),).toEqual({
          status: 'success',
          title: 'In memory of Mittens',
          text: 'Mittens had an older sister.\nThe sister was also a tabby.',
        },);
        expect(fetchedOf({
          parsed: {
            results: [],
            statuses: [{
              id: POST_URL,
              status: 'error',
              error: { tag: 'CRAWL_NOT_FOUND', httpStatusCode: 404, },
            },],
          },
        },),).toEqual({
          status: 'error',
          title: '',
          text: '',
          failure: 'CRAWL_NOT_FOUND',
        },);
        expect(fetchedOf({ parsed: { results: [], }, },),).toEqual({
          status: 'error',
          title: '',
          text: '',
          failure: 'no result',
        },);
        expect(function refuses(): void {
          fetchedOf({ parsed: { data: [], }, },);
        },).toThrow(CitedReferenceFetchError,);
      },
    },),
  ],
},);

await describe({
  name: fetchCitedReference.name,
  children: [
    it({
      name: 'ASKS the contents endpoint for one url with the key in the header and the character cap in the body',
      fn: async () => {
        const {
          fetchFn,
          seen,
        } = stubTransport({
          status: 200,
          body: READABLE_BODY,
        },);
        /**
         What the fetch read.
         */
        const fetched = await fetchCitedReference({
          apiKey: 'whisker-key',
          url: POST_URL,
          signal: SIGNAL,
          fetchFn,
        },);
        expect(fetched.status,).toBe('success',);
        expect(seen.at(0,)?.url,).toBe(EXA_CONTENTS_URL,);
        expect(seen.at(0,)?.key,).toBe('whisker-key',);
        expect(JSON.parse(seen.at(0,)?.body ?? '{}',),).toEqual({
          urls: [POST_URL,],
          text: { maxCharacters: REFERENCE_TEXT_CHARACTERS, },
        },);
      },
    },),
    it({
      name: 'REFUSES a non-2xx answer naming the url and never the key',
      fn: async () => {
        const { fetchFn, } = stubTransport({
          status: 401,
          body: { error: 'no', },
        },);
        try {
          await fetchCitedReference({
            apiKey: 'whisker-key',
            url: POST_URL,
            signal: SIGNAL,
            fetchFn,
          },);
          throw new Error('the fetch did not refuse',);
        } catch (error) {
          expect(error,).toBeInstanceOf(CitedReferenceFetchError,);
          expect(String(error,),).toContain(POST_URL,);
          expect(String(error,),).not
            .toContain('whisker-key',);
        }
      },
    },),
  ],
},);

await describe({
  name: 'reference cache',
  children: [
    it({
      name: 'SITS under the lookup cache, WRITES a record its url reads back, and MISSES on absence or a foreign file',
      fn: async () => {
        /**
         Throwaway cache home.
         */
        const dir = await mkdtemp(join(
          tmpdir(),
          'reference-cache-',
        ),);
        expect(referenceCacheDir({ env: { [LOOKUP_CACHE_DIR_VAR]: dir, }, },),).toBe(join(
          dir,
          'reference',
        ),);
        /**
         Record to keep.
         */
        const record: ReferenceRecord = {
          url: POST_URL,
          fetchedAt: NOW.toISOString(),
          status: 'success',
          title: 'In memory of Mittens',
          text: 'Mittens had an older sister.',
        };
        expect(isReferenceRecord(record,),).toBe(true,);
        expect(isReferenceRecord({ url: POST_URL, },),).toBe(false,);
        await writeCachedReference({
          dir,
          record,
        },);
        expect(await readCachedReference({
          dir,
          url: POST_URL,
        },),).toEqual({
          kind: 'hit',
          record,
        },);
        expect(await readCachedReference({
          dir,
          url: ARCHIVE_URL,
        },),).toEqual({ kind: 'miss', },);
        await writeFile(
          referenceCachePath({
            dir,
            url: ARCHIVE_URL,
          },),
          '{"not":"a record"}\n',
          'utf8',
        );
        expect(await readCachedReference({
          dir,
          url: ARCHIVE_URL,
        },),).toEqual({ kind: 'miss', },);
      },
    },),
    it({
      name: 'BUYS a page once and READS IT BACK on every later ask, so a resumed run never hits the page again',
      fn: async () => {
        const dir = await mkdtemp(join(
          tmpdir(),
          'reference-lookup-',
        ),);
        const {
          fetchFn,
          seen,
        } = stubTransport({
          status: 200,
          body: READABLE_BODY,
        },);
        /**
         Asks the same page.

         @returns Record for the page
         */
        async function ask(): Promise<ReferenceRecord> {
          return lookupCitedReference({
            url: POST_URL,
            apiKey: 'whisker-key',
            dir,
            signal: SIGNAL,
            fetchFn,
            now: () => NOW,
          },);
        }
        /**
         First answer, bought.
         */
        const first = await ask();
        /**
         Second answer, read back.
         */
        const second = await ask();
        expect(first,).toEqual(second,);
        expect(first.fetchedAt,).toBe(NOW.toISOString(),);
        expect(seen.length,).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: referenceLineOf.name,
  children: [
    it({
      name: 'RENDERS the page on one line with its title, says when nothing was readable, and names the failure',
      fn: async () => {
        expect(referenceLineOf({
          index: 1,
          record: {
            url: POST_URL,
            fetchedAt: NOW.toISOString(),
            status: 'success',
            title: 'In memory\nof Mittens',
            text: 'Mittens had an older sister.\n\nThe sister was also a tabby.',
          },
        },),).toBe(`- reference 1 ${POST_URL} ("In memory of Mittens"): Mittens had an older sister. The sister was also a tabby.`,);
        expect(referenceLineOf({
          index: 2,
          record: {
            url: ARCHIVE_URL,
            fetchedAt: NOW.toISOString(),
            status: 'success',
            title: '',
            text: ' \n ',
          },
        },),).toBe(`- reference 2 ${ARCHIVE_URL}: nothing readable on the page`,);
        expect(referenceLineOf({
          index: 3,
          record: {
            url: ARCHIVE_URL,
            fetchedAt: NOW.toISOString(),
            status: 'error',
            title: '',
            text: '',
            failure: 'CRAWL_NOT_FOUND',
          },
        },),).toBe(`- reference 3 ${ARCHIVE_URL}: could not be fetched (CRAWL_NOT_FOUND)`,);
      },
    },),
  ],
},);

await describe({
  name: citedReferenceBlock.name,
  children: [
    it({
      name: 'ASKS NOTHING without a link or without a key, and otherwise CARRIES one line per cited page in order',
      fn: async () => {
        const dir = await mkdtemp(join(
          tmpdir(),
          'reference-block-',
        ),);
        const {
          fetchFn,
          seen,
        } = stubTransport({
          status: 200,
          body: READABLE_BODY,
        },);
        /**
         Asks for the block over one original with one key.

         @param sourceText - original

         @param apiKey - key, empty for none

         @returns The block
         */
        async function block(
          {
            sourceText,
            apiKey,
          }: {
            readonly sourceText: string;
            readonly apiKey: string;
          },
        ): Promise<string> {
          return citedReferenceBlock({
            sourceText,
            apiKey,
            dir,
            signal: SIGNAL,
            fetchFn,
            now: () => NOW,
            logger: l,
          },);
        }
        expect(await block({
          sourceText: '没有链接。',
          apiKey: 'whisker-key',
        },),).toBe('',);
        expect(await block({
          sourceText: SOURCE_TEXT,
          apiKey: '',
        },),).toBe('',);
        expect(seen.length,).toBe(0,);
        /**
         Block over the citing original.
         */
        const lines = await block({
          sourceText: SOURCE_TEXT,
          apiKey: 'whisker-key',
        },);
        expect(lines.split('\n',),).toEqual([
          `- reference 1 ${POST_URL} ("In memory of Mittens"): Mittens had an older sister. The sister was also a tabby.`,
          `- reference 2 ${ARCHIVE_URL} ("In memory of Mittens"): Mittens had an older sister. The sister was also a tabby.`,
        ],);
        expect(seen.length,).toBe(2,);
      },
    },),
    it({
      name: 'NAMES a page the transport could not read instead of dropping the line',
      fn: async () => {
        const dir = await mkdtemp(join(
          tmpdir(),
          'reference-block-fail-',
        ),);
        /**
         Transport that refuses everything.

         @returns A closed door
         */
        async function failing(): Promise<Response> {
          return new Response(
            'closed',
            { status: 503, },
          );
        }
        expect(await citedReferenceBlock({
          sourceText: `见 ${POST_URL}`,
          apiKey: 'whisker-key',
          dir,
          signal: SIGNAL,
          fetchFn: failing,
          now: () => NOW,
          logger: l,
        },),).toBe(`- reference 1 ${POST_URL}: could not be fetched`,);
      },
    },),
  ],
},);

await describe({
  name: citedReferenceBlockText.name,
  children: [
    it({
      name: 'CARRIES the lines between fences with the rule, and nothing at all when the original links nowhere',
      fn: async () => {
        expect(citedReferenceBlockText({ fence: '=====', },),).toBe('',);
        expect(citedReferenceBlockText({
          fence: '=====',
          referenceContext: '',
        },),).toBe('',);
        /**
         Block over one line.
         */
        const block = citedReferenceBlockText({
          fence: '=====',
          referenceContext: `- reference 1 ${POST_URL}: Mittens had an older sister.`,
        },);
        expect(block,).toContain('===== CITED REFERENCES, EVIDENCE ONLY =====\n- reference 1',);
        expect(block,).toContain(`===== ${CITED_REFERENCE_RULE} =====\n`,);
        expect(CITED_REFERENCE_RULE,).toContain('never report or support it as accuracy/addition',);
        expect(CITED_REFERENCE_RULE,).toContain('never license adding to the TRANSLATION',);
      },
    },),
  ],
},);

await describe({
  name: citedReferenceCandidateLines.name,
  children: [
    it({
      name: 'CARRIES the lines between fences with the candidate rule, and no lines when the original links nowhere',
      fn: async () => {
        expect(citedReferenceCandidateLines({ fence: '=====', },),).toEqual([],);
        expect(citedReferenceCandidateLines({
          fence: '=====',
          referenceContext: '',
        },),).toEqual([],);
        /**
         Lines over one reference.
         */
        const lines = citedReferenceCandidateLines({
          fence: '=====',
          referenceContext: `- reference 1 ${POST_URL}: Mittens had an older sister.`,
        },);
        expect(lines.at(0,),).toBe('===== CITED REFERENCES, EVIDENCE ONLY =====',);
        expect(lines.at(1,),).toContain('- reference 1',);
        expect(lines.at(2,),).toBe(`===== ${CITED_REFERENCE_CANDIDATE_RULE} =====`,);
        expect(lines.at(-1,),).toBe('',);
        expect(CITED_REFERENCE_CANDIDATE_RULE,).toContain('never count it unsupported',);
        expect(CITED_REFERENCE_CANDIDATE_RULE,).toContain('never license adding to a rendering',);
      },
    },),
  ],
},);

await describe({
  name: citedReferenceEvidence.name,
  children: [
    it({
      name: 'RENDERS one labelled entry carrying the candidate rule, and none when the original links nowhere',
      fn: async () => {
        expect(citedReferenceEvidence({},),).toEqual([],);
        expect(citedReferenceEvidence({ referenceContext: '', },),).toEqual([],);
        /**
         Entries over one reference.
         */
        const entries = citedReferenceEvidence({
          referenceContext: `- reference 1 ${POST_URL}: Mittens had an older sister.`,
        },);
        expect(entries.length,).toBe(1,);
        expect(entries.at(0,)?.label,).toContain('CITED REFERENCES, EVIDENCE ONLY.',);
        expect(entries.at(0,)?.label,).toContain(CITED_REFERENCE_CANDIDATE_RULE,);
        expect(entries.at(0,)?.text,).toContain('- reference 1',);
      },
    },),
  ],
},);
