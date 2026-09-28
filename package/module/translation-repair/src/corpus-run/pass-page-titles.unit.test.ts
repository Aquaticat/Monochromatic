/**
 Tests for the preparation's page title lexicon (ledger H16): when it asks,
 whom it asks (the roster its hook hands over, ledger X12), what it stores,
 what a resume reads back, and what names the question.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { createHash, } from 'node:crypto';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BenchSeating,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  hashContent,
  keepBench,
  PAGE_TITLE_CACHE_VERSION,
  pageTitleKey,
  type PageTitleLexiconRecord,
  passPageTitles,
  type RosterModelId,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  type SliceCache,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 Logger the round writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-page-titles-test', },);

/**
 Roster the preparation started on.
 */
const ROSTER: readonly RosterModelId[] = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
];

/**
 Roster a hook hands back after a dry-out, none of it the fixture's own.
 */
const RESEATED: readonly RosterModelId[] = [
  SEAT_HYPER_ONLY,
  SEAT_OPENROUTER_ONLY,
];

/**
 Original repeating one title the archive does not pair.
 */
const REPEATING = '## 猫之歌\n\n小猫唱了《猫之歌》。\n';

/**
 Original naming a title once.
 */
const ONCE = '小猫唱了《猫之歌》。\n';

/**
 Archive rendering no heading.
 */
const ARCHIVE = 'The kitten sang all afternoon.\n';

/**
 Builds a client recording the seats asked, every seat rendering the title
 alike, or refusing the sheet when told to.

 @param asked - sink for the seat of every call

 @param usable - whether the replies read, so a round can hear nobody

 @returns Client serving only structured calls

 @example
 ```ts
 const client = titleClient({ asked: [], usable: true, },);
 ```
 */
function titleClient(
  {
    asked,
    usable,
  }: {
    readonly asked: RosterModelId[];
    readonly usable: boolean;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      /**
       Every seat's reply.
       */
      const value: unknown = { titles: [{ title: 1, rendering: 'Song of the Cat', },], };
      return (usable && request.validate(value,))
        ? { kind: 'ok', value, rawText: JSON.stringify(value,), }
        : { kind: 'schema-mismatch', rawText: '{}', detail: 'fixture refuses the sheet', };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/**
 A store resuming from one map and persisting into another.

 @param resumed - records an earlier run stored

 @param persisted - sink for what this run stores

 @returns Cache over the two maps

 @example
 ```ts
 const cache = memoryCache({ resumed: new Map(), persisted: new Map(), },);
 ```
 */
function memoryCache(
  {
    resumed,
    persisted,
  }: {
    readonly resumed: ReadonlyMap<string, PageTitleLexiconRecord>;
    readonly persisted: Map<string, string>;
  },
): SliceCache<PageTitleLexiconRecord> {
  return {
    resumed,
    persist: async ({ key, serialized, },) => {
      persisted.set(key, serialized,);
    },
  };
}

/**
 Runs the lexicon over an original, recording seats, hook reads and what it stored.

 @param sourceText - original page

 @param usable - whether the bench's replies read

 @param resumed - records an earlier run stored

 @param reseat - whether the hook re-seats the round elsewhere

 @returns Lines, seats asked, hook reads and records stored

 @example
 ```ts
 const run = await lexiconRun({ sourceText: REPEATING, usable: true, resumed: new Map(), reseat: true, },);
 ```
 */
async function lexiconRun(
  {
    sourceText,
    usable,
    resumed,
    reseat,
  }: {
    readonly sourceText: string;
    readonly usable: boolean;
    readonly resumed: ReadonlyMap<string, PageTitleLexiconRecord>;
    readonly reseat: boolean;
  },
) {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  /**
   Records this run stored.
   */
  const persisted = new Map<string, string>();
  /**
   Reads the hook took.
   */
  const hook = { reads: 0, };
  /**
   What the lexicon added.
   */
  const added = await passPageTitles({
    client: titleClient({ asked, usable, },),
    modelIds: ROSTER,
    beforeItem: async (): Promise<BenchSeating> => {
      hook.reads += 1;
      return reseat ? { modelIds: RESEATED, } : await keepBench();
    },
    sourceText,
    targetText: ARCHIVE,
    cache: memoryCache({ resumed, persisted, },),
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l,
  },);
  return {
    added,
    asked,
    hookReads: hook.reads,
    persisted,
  };
}

/**
 Stored records read back as the cache would hand them over.

 @param persisted - records a run stored

 @returns Them, parsed

 @example
 ```ts
 const resumed = readBack({ persisted, },);
 ```
 */
function readBack(
  { persisted, }: { readonly persisted: ReadonlyMap<string, string>; },
): ReadonlyMap<string, PageTitleLexiconRecord> {
  return new Map([...persisted.entries(),].map(function parsed([key, serialized,],): readonly [
    string,
    PageTitleLexiconRecord,
  ] {
    return [key, JSON.parse(serialized,) as PageTitleLexiconRecord,];
  },),);
}

await describe({
  name: `${passPageTitles.name} (ledger H16)`,
  children: [
    it({
      name: 'READS NO HOOK AND ASKS NOBODY for a page that repeats no unpaired title',
      fn: async () => {
        /**
         Round over a title written once.
         */
        const once = await lexiconRun({ sourceText: ONCE, usable: true, resumed: new Map(), reseat: true, },);
        expect({
          asked: once.asked,
          hookReads: once.hookReads,
          lines: once.added.lines,
          stored: once.persisted.size,
        },).toEqual({
          asked: [],
          hookReads: 0,
          lines: [],
          stored: 0,
        },);
      },
    },),
    it({
      name: 'ASKS THE ROSTER ITS HOOK HANDS OVER, carries the settled title and stores the round once',
      fn: async () => {
        /**
         Round re-seated elsewhere.
         */
        const moved = await lexiconRun({ sourceText: REPEATING, usable: true, resumed: new Map(), reseat: true, },);
        expect({
          askedAny: moved.asked.length > 0,
          offReseated: moved.asked.filter(function outside(seat,): boolean {
            return !RESEATED.includes(seat,);
          },),
          hookReads: moved.hookReads,
          carries: moved.added.lines.some(function names(line,): boolean {
            return line.startsWith('- 猫之歌',) && line.includes('"Song of the Cat"',);
          },),
          stored: moved.persisted.size,
          // Stored under the roster that answered, so a resume on another
          // bench asks again rather than reading this bench's answer.
          storedUnderAnswering: moved.persisted.has(pageTitleKey({
            sourceText: REPEATING,
            spans: [{ source: '猫之歌', occurrences: 2, },],
            modelIds: RESEATED,
          },),),
        },).toEqual({
          askedAny: true,
          offReseated: [],
          hookReads: 1,
          carries: true,
          stored: 1,
          storedUnderAnswering: true,
        },);
      },
    },),
    it({
      name: 'RESUMES A STORED ROUND without asking, so the lines, and every slice key they reach, stay put',
      fn: async () => {
        /**
         First round, which stores its answer.
         */
        const first = await lexiconRun({ sourceText: REPEATING, usable: true, resumed: new Map(), reseat: false, },);
        /**
         Second round over the stored answer.
         */
        const second = await lexiconRun({
          sourceText: REPEATING,
          usable: true,
          resumed: readBack({ persisted: first.persisted, },),
          reseat: false,
        },);
        expect({
          asked: second.asked,
          sameLines: JSON.stringify(second.added.lines,) === JSON.stringify(first.added.lines,),
          sameFindings: JSON.stringify(second.added.findings,) === JSON.stringify(first.added.findings,),
        },).toEqual({
          asked: [],
          sameLines: true,
          sameFindings: true,
        },);
      },
    },),
    it({
      name: 'STORES NOTHING when nobody answered usably, since an unreachable bench is not an answer',
      fn: async () => {
        /**
         Round the bench never answered usably.
         */
        const silent = await lexiconRun({ sourceText: REPEATING, usable: false, resumed: new Map(), reseat: false, },);
        expect({
          askedAny: silent.asked.length > 0,
          lines: silent.added.lines,
          stored: silent.persisted.size,
        },).toEqual({
          askedAny: true,
          lines: [],
          stored: 0,
        },);
      },
    },),
  ],
},);

await describe({
  name: `${pageTitleKey.name} (ledger H16)`,
  children: [
    it({
      name: 'NAMES THE QUESTION BY THE ORIGINAL, THE TITLES AND THE ROSTER, and by nothing else',
      fn: async () => {
        /**
         The titles asked.
         */
        const spans = [{ source: '猫之歌', occurrences: 2, },];
        /**
         Key of the fixture question.
         */
        const key = pageTitleKey({ sourceText: REPEATING, spans, modelIds: ROSTER, },);
        expect({
          same: pageTitleKey({ sourceText: REPEATING, spans: [...spans,], modelIds: [...ROSTER,], },) === key,
          roster: pageTitleKey({ sourceText: REPEATING, spans, modelIds: RESEATED, },) === key,
          titles: pageTitleKey({ sourceText: REPEATING, spans: [{ source: '猫之歌', occurrences: 3, },], modelIds: ROSTER, },) === key,
          original: pageTitleKey({ sourceText: `${REPEATING}喵。\n`, spans, modelIds: ROSTER, },) === key,
        },).toEqual({
          same: true,
          roster: false,
          titles: false,
          original: false,
        },);
      },
    },),
    it({
      name: 'IS THE SHA-256 OF ONE JSON VALUE carrying the cache version, so moving the version moves every key '
        + '(ledger M25) and no two questions share bytes (ledger X15)',
      fn: async () => {
        /**
         The titles asked.
         */
        const spans = [{ source: '猫之歌', occurrences: 2, },];
        expect(pageTitleKey({ sourceText: REPEATING, spans, modelIds: ROSTER, },),).toBe(
          createHash('sha256',)
            .update(
              JSON.stringify({
                version: PAGE_TITLE_CACHE_VERSION,
                source: hashContent({ content: REPEATING, },),
                titles: spans,
                roster: ROSTER,
              },),
              'utf8',
            )
            .digest('hex',),
        );
      },
    },),
  ],
},);
