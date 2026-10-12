/**
 Tests for the page consistency cache: the question a gather answers is named
 by the whole sheet and the bench, and a stored gather resumes only when it is
 a record the persistence rule writes, in the generation that wrote it.

 A stored record is an outside read, like a file on disk: the cases hand the
 cache records with one defect each and read whether the cache resumes them.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { join, } from 'node:path';

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CONSISTENCY_CACHE_VERSION,
  consistencyKey,
  openConsistencyCache,
  type RosterModelId,
} from '../../dist/final/node/index.mjs';
import { warnLinesDuring, } from '../console-warn-lines.test-fixture.ts';
import {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_VISION,
} from '../roster-seats.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

/**
 Generation the cache is opened under, before any case moves it.
 */
const GENERATION = 'sha256-tree-v1:cat';

/**
 Key the records are stored under.
 */
const KEY = 'purr';

/**
 A sheet of one message.
 */
const SHEET: readonly ChatMessage[] = [{ role: 'user', content: 'Which rendering of the cat naps best?', },];

/**
 The bench the sheet is put to.
 */
const BENCH: readonly RosterModelId[] = [SEAT_HYPER_ONLY, SEAT_BEDROCK_ONLY_TEXT, SEAT_HYPER_VISION,];

/**
 One heard ballot with its seat.
 */
const VOICE = {
  seat: 'hyper-cat',
  reason: 'The first place words it best.',
  quotes: [
    { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
    { label: 'OCCURRENCE 2', quote: 'The kitten naps', },
  ],
  choice: 'OCCURRENCE 1',
  keep: ['OCCURRENCE 2',],
};

/**
 A gather as the persistence rule writes it: one voice heard against a quorum of one.
 */
const RECORD = {
  quorum: 1,
  voices: [VOICE,],
  findings: ['page-consistency 1/1',],
};

/**
 The warning the cache logs for a stored record it will not resume.
 */
const REFUSED_LINE = `[translation-repair] [loadNamespacedSlices] consistency-generation.txt: consistency.${KEY}.json is not a resumable value for this lane; `
  + 'it will be recomputed';

/**
 What storing a value and opening the cache again resumes, with the warnings written meanwhile.

 @param stored - the value the first cache is handed to store

 @returns Whether the second cache resumed it, and the warnings the second open wrote

 @example
 ```ts
 const reopened = await reopenedWith({ stored: RECORD, },);
 ```
 */
async function reopenedWith(
  { stored, }: { readonly stored: unknown; },
): Promise<{ readonly resumed: boolean; readonly warned: readonly string[]; }> {
  await using dir = await scratchDir({ prefix: 'pass-consistency-cache-', },);
  const first = await openConsistencyCache({
    dir: dir.path,
    generation: GENERATION,
  },);
  await first.persist({
    key: KEY,
    serialized: JSON.stringify(stored,),
  },);
  const { result: second, warned, } = await warnLinesDuring({
    run: async function reopens() {
      return await openConsistencyCache({
        dir: dir.path,
        generation: GENERATION,
      },);
    },
  },);
  return {
    resumed: second.resumed.has(KEY,),
    warned,
  };
}

/**
 Whether each stored value was resumed, and how many warnings the opens wrote.

 @param stored - the values to store, one cache each

 @returns The resumed flags in order and the warnings of all the opens

 @example
 ```ts
 const { resumed, warned, } = await reopenedAll({ stored: [RECORD,], },);
 ```
 */
async function reopenedAll(
  { stored, }: { readonly stored: readonly unknown[]; },
): Promise<{ readonly resumed: readonly boolean[]; readonly warned: readonly string[]; }> {
  /**
   One reopening per stored value, run in turn since each diverts the console.
   */
  const reopenings = [];
  for (const each of stored) {
    // The opens divert `console.warn` one at a time.
    // oxlint-disable-next-line no-await-in-loop
    reopenings.push(await reopenedWith({ stored: each, },),);
  }
  return {
    resumed: reopenings.map(function resumedOf({ resumed, },): boolean {
      return resumed;
    },),
    warned: reopenings.flatMap(function warnedOf({ warned, },): readonly string[] {
      return warned;
    },),
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: consistencyKey.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE SAME QUESTION BY THE SAME KEY EVERY TIME',
          fn: async () => {
            expect(consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, },),).toBe(
              consistencyKey({ stage: 'ballots', messages: [...SHEET,], modelIds: [...BENCH,], },),
            );
          },
        },),
        it({
          name: 'NAMES ANOTHER QUESTION BY ANOTHER KEY WHEN THE SHEET, THE BENCH OR THE ORDER OF THE BENCH CHANGES',
          fn: async () => {
            const keys = [
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, },),
              consistencyKey({
                stage: 'ballots',
                messages: [{ role: 'user', content: 'Which rendering of the kitten naps best?', },],
                modelIds: BENCH,
              },),
              consistencyKey({
                stage: 'ballots',
                messages: [...SHEET, { role: 'user', content: 'Mittens is the cat.', },],
                modelIds: BENCH,
              },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH.slice(0, 2,), },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH.toReversed(), },),
            ];
            expect(new Set(keys,).size,).toBe(keys.length,);
          },
        },),
        it({
          name: 'NAMES ANOTHER QUESTION BY ANOTHER KEY FOR EACH STAGE, so a run-off, the writers and a choice among candidates '
            + 'never read the first round\'s answer for the same sheet',
          fn: async () => {
            const keys = (['ballots', 'run-off', 'writers', 'choice',] as const).map(function keyOf(stage,): string {
              return consistencyKey({ stage, messages: SHEET, modelIds: BENCH, },);
            },);
            expect(new Set(keys,).size,).toBe(4,);
          },
        },),
        it({
          name: 'FOLDS A RECORDED DEATH AND THE NAMES ITS TENSE CANDIDATES READ into the key, and a living entry keys as '
            + 'without them',
          fn: async () => {
            const keys = [
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, lifeEnded: false, subjectNames: ['Mittens',], },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, lifeEnded: true, subjectNames: ['Mittens',], },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, lifeEnded: true, subjectNames: ['Tom',], },),
              consistencyKey({ stage: 'ballots', messages: SHEET, modelIds: BENCH, lifeEnded: true, },),
            ];
            expect([keys[0] === keys[1], new Set(keys.slice(2,),).size,],).toEqual([true, 3,],);
          },
        },),
        it({
          name: 'MOVES THE KEY WITH THE CACHE VERSION: the version is part of what the key digests, and version two names a '
            + 'run that stores run-off, writer and choice records beside the ballots',
          fn: async () => {
            expect(CONSISTENCY_CACHE_VERSION,).toBe(2,);
          },
        },),
      ],
    },),
    describe({
      name: openConsistencyCache.name,
      concurrency: 1,
      children: [
        it({
          name: 'OPENS AN EMPTY CACHE IN A DIRECTORY THAT DOES NOT EXIST YET',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-cache-', },);
            const cache = await openConsistencyCache({
              dir: join(dir.path, 'nested', 'cat',),
              generation: GENERATION,
            },);
            expect([...cache.resumed.keys(),],).toEqual([],);
          },
        },),
        it({
          name: 'RESUMES A STORED GATHER WHOLE IN THE GENERATION THAT STORED IT, and discards it in another',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-cache-', },);
            const first = await openConsistencyCache({ dir: dir.path, generation: GENERATION, },);
            await first.persist({ key: KEY, serialized: JSON.stringify(RECORD,), },);
            const same = await openConsistencyCache({ dir: dir.path, generation: GENERATION, },);
            const other = await openConsistencyCache({ dir: dir.path, generation: 'sha256-tree-v1:dog', },);
            expect([same.resumed.get(KEY,), other.resumed.has(KEY,),],).toEqual([RECORD, false,],);
          },
        },),
        it({
          name: 'RESUMES A GATHER OF SEVERAL VOICES WITH A SLOT, NO SLOT AND NO FINDINGS, as stored',
          fn: async () => {
            const wide = {
              quorum: 2,
              voices: [VOICE, { ...VOICE, seat: 'bedrock-cat', quotes: [], keep: [], },],
              findings: [],
            };
            expect(await reopenedAll({ stored: [wide,], },),).toEqual({ resumed: [true,], warned: [], },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A STORED VALUE THAT IS NOT A RECORD, saying so and leaving the gather to be asked again',
          fn: async () => {
            expect(await reopenedAll({ stored: [[], 'naps', null, 4,], },),).toEqual({
              resumed: [false, false, false, false,],
              warned: [REFUSED_LINE, REFUSED_LINE, REFUSED_LINE, REFUSED_LINE,],
            },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A RECORD WHOSE QUORUM IS ABSENT, TEXT OR FRACTIONAL',
          fn: async () => {
            const { quorum: _quorum, ...withoutQuorum } = RECORD;
            expect(await reopenedAll({
              stored: [withoutQuorum, { ...RECORD, quorum: '1', }, { ...RECORD, quorum: 1.5, voices: [VOICE, VOICE,], },],
            },),).toEqual({
              resumed: [false, false, false,],
              warned: [REFUSED_LINE, REFUSED_LINE, REFUSED_LINE,],
            },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A RECORD WHOSE QUORUM IS NOT A COUNT A GATHER CLOSES ON: zero, negative or beyond what JSON '
            + 'carries exactly',
          fn: async () => {
            expect(await reopenedAll({
              stored: [{ ...RECORD, quorum: 0, }, { ...RECORD, quorum: -1, }, { ...RECORD, quorum: 2 ** 60, },],
            },),).toEqual({
              resumed: [false, false, false,],
              warned: [REFUSED_LINE, REFUSED_LINE, REFUSED_LINE,],
            },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A RECORD OF FEWER VOICES THAN ITS QUORUM, which the persistence rule never writes',
          fn: async () => {
            expect(await reopenedAll({
              stored: [{ ...RECORD, quorum: 2, }, { ...RECORD, voices: [], },],
            },),).toEqual({
              resumed: [false, false,],
              warned: [REFUSED_LINE, REFUSED_LINE,],
            },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A RECORD WHOSE VOICES ARE ABSENT, NOT A LIST, OR NOT BALLOTS WITH A SEAT',
          fn: async () => {
            const { voices: _voices, ...withoutVoices } = RECORD;
            const { seat: _seat, ...withoutSeat } = VOICE;
            expect(await reopenedAll({
              stored: [
                withoutVoices,
                { ...RECORD, voices: 'naps', },
                { ...RECORD, voices: [4,], },
                { ...RECORD, voices: [withoutSeat,], },
                { ...RECORD, voices: [{ ...VOICE, seat: 4, },], },
                { ...RECORD, voices: [{ ...VOICE, reason: 4, },], },
                { ...RECORD, voices: [{ ...VOICE, quotes: 'naps', },], },
                { ...RECORD, voices: [{ ...VOICE, quotes: [{ label: 'OCCURRENCE 1', },], },], },
                { ...RECORD, voices: [{ ...VOICE, keep: [3,], },], },
              ],
            },),).toEqual({
              resumed: [false, false, false, false, false, false, false, false, false,],
              warned: Array.from({ length: 9, }, function refused(): string {
                return REFUSED_LINE;
              },),
            },);
          },
        },),
        it({
          name: 'RESUMES A STORED RUN-OFF OR CHOICE RECORD AND A STORED WRITERS RECORD WHOLE, each as its kind',
          fn: async () => {
            const choice = {
              kind: 'choice',
              quorum: 2,
              voices: [
                { seat: 'hyper-cat', reason: 'It reads best.', choice: 'CANDIDATE 2', },
                { seat: 'bedrock-cat', reason: 'It reads best.', choice: 'CANDIDATE 2', },
              ],
              findings: [],
            };
            const writers = {
              kind: 'writers',
              quorum: 1,
              voices: [{ seat: 'hyper-cat', translation: 'The kitten naps in the sun.', },],
              findings: ['page-consistency-writers 1/1',],
            };
            expect(await reopenedAll({ stored: [choice, writers,], },),).toEqual({ resumed: [true, true,], warned: [], },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A CHOICE OR WRITERS RECORD WITH A DEFECT: an unknown kind, a choice without its seat or '
            + 'with a number for its label, a paragraph that is not text, a ballot in place of a paragraph',
          fn: async () => {
            const choice = {
              kind: 'choice',
              quorum: 1,
              voices: [{ seat: 'hyper-cat', reason: 'It reads best.', choice: 'CANDIDATE 2', },],
              findings: [],
            };
            const writers = {
              kind: 'writers',
              quorum: 1,
              voices: [{ seat: 'hyper-cat', translation: 'The kitten naps in the sun.', },],
              findings: [],
            };
            expect(await reopenedAll({
              stored: [
                { ...choice, kind: 'ballots', },
                { ...choice, voices: [{ reason: 'It reads best.', choice: 'CANDIDATE 2', },], },
                { ...choice, voices: [{ seat: 'hyper-cat', reason: 'It reads best.', choice: 2, },], },
                { ...writers, voices: [{ seat: 'hyper-cat', translation: 4, },], },
                { ...writers, voices: [{ translation: 'The kitten naps in the sun.', },], },
                { ...writers, voices: [VOICE,], },
              ],
            },),).toEqual({
              resumed: [false, false, false, false, false, false,],
              warned: Array.from({ length: 6, }, function refused(): string {
                return REFUSED_LINE;
              },),
            },);
          },
        },),
        it({
          name: 'DOES NOT RESUME A RECORD WHOSE FINDINGS ARE ABSENT, NOT A LIST, OR NOT TEXT',
          fn: async () => {
            const { findings: _findings, ...withoutFindings } = RECORD;
            expect(await reopenedAll({
              stored: [withoutFindings, { ...RECORD, findings: 'short', }, { ...RECORD, findings: [4,], },],
            },),).toEqual({
              resumed: [false, false, false,],
              warned: [REFUSED_LINE, REFUSED_LINE, REFUSED_LINE,],
            },);
          },
        },),
      ],
    },),
  ],
},);
