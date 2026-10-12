/**
 Tests for asking the bench once about one repeated wording, or reading its
 earlier answer: the ballots handed back in roster order beside the seat that
 gave each, the quorum and findings of the gather, what is stored for a resume
 and what is not, what a resume reads back, and what a store that refuses
 costs.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  askConsistencyBench,
  buildConsistencyMessages,
  CONSISTENCY_RESPONSE_FORMAT,
  type ConsistencyRecord,
  consistencyKey,
  consistencyLabels,
  type ConsistencySubject,
  gatherStageVoices,
  type RosterModelId,
  type SliceCache,
  StageRosterRepeatError,
  usableConsistencyBallotFor,
} from '../../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '../capturing-logger.test-fixture.ts';
import { HANG_STOP_MS, } from '../hang-stop.test-fixture.ts';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_ONLY,
  SEAT_HYPER_VISION,
} from '../roster-seats.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '../stage-settings.test-fixture.ts';
import {
  scriptedJudgeClient,
  type SeatBehaviour,
  type SeatScript,
} from './consistency-page.test-fixture.ts';

/**
 The bench asked, in roster order.
 */
const BENCH: readonly RosterModelId[] = [SEAT_HYPER_ONLY, SEAT_BEDROCK_ONLY_TEXT, SEAT_HYPER_VISION,];

/**
 The repeated sentence in two places, each with its English.
 */
const SUBJECT: ConsistencySubject = {
  repeat: { kind: 'maximal', wording: '小猫打盹', },
  occurrences: [
    {
      sliceIndex: 0,
      paragraph: '小猫打盹。',
      markStart: 0,
      markEnd: 4,
      english: { kind: 'present', text: 'The cat naps.', },
    },
    {
      sliceIndex: 1,
      paragraph: '小猫打盹。',
      markStart: 0,
      markEnd: 4,
      english: { kind: 'present', text: 'The kitten naps.', },
    },
  ],
};

/**
 The question the bench is put, as the cache names it.
 */
const KEY = consistencyKey({
  messages: buildConsistencyMessages({ subject: SUBJECT, },),
  modelIds: BENCH,
},);

/**
 What a seat sends, naming itself in its reason so a ballot is told from the others'.

 @param seat - the seat answering

 @returns The seat's reply as text

 @example
 ```ts
 const text = replyOf({ seat: SEAT_HYPER_ONLY, },);
 ```
 */
function replyOf({ seat, }: { readonly seat: RosterModelId; },): string {
  return JSON.stringify({
    reason: `${seat} words the first place best.`,
    quotes: [
      { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
      { label: 'OCCURRENCE 2', quote: 'The kitten naps.', },
    ],
    choice: 'OCCURRENCE 1',
    keep: [],
  },);
}

/**
 The ballot a seat's reply comes to, as the record keeps it.

 @param seat - the seat that answered

 @returns The seat and its ballot

 @example
 ```ts
 const voice = voiceOf({ seat: SEAT_HYPER_ONLY, },);
 ```
 */
function voiceOf({ seat, }: { readonly seat: RosterModelId; },): ConsistencyRecord['voices'][number] {
  return {
    seat,
    reason: `${seat} words the first place best.`,
    quotes: [
      { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
      { label: 'OCCURRENCE 2', quote: 'The kitten naps.', },
    ],
    choice: 'OCCURRENCE 1',
    keep: [],
  };
}

/**
 What a seat does when every seat answers with a usable ballot.

 @param seat - the seat asked

 @returns The seat's reply

 @example
 ```ts
 const behave: SeatScript = everySeatAnswers;
 ```
 */
function everySeatAnswers({ seat, }: { readonly seat: RosterModelId; },): SeatBehaviour {
  return { kind: 'answers', text: replyOf({ seat, },), };
}

/**
 A cache that keeps what it is handed, and refuses to store when told.

 @param resumed - what an earlier run settled

 @param persisted - sink for every question and answer handed to the store

 @param refusal - what storing fails with, absent when it works

 @returns The cache

 @example
 ```ts
 const cache = recordingCache({ resumed: new Map(), persisted: [], },);
 ```
 */
function recordingCache(
  {
    resumed,
    persisted,
    refusal,
  }: {
    readonly resumed: ReadonlyMap<string, ConsistencyRecord>;
    readonly persisted: { readonly key: string; readonly serialized: string; }[];
    readonly refusal?: Error;
  },
): SliceCache<ConsistencyRecord> {
  return {
    resumed,
    persist: async function persist(entry,): Promise<void> {
      if (refusal !== undefined)
        throw refusal;
      persisted.push(entry,);
    },
  };
}

/**
 Asks the bench about the repeated sentence.

 @param behave - what each seat does

 @param cache - the store

 @param modelIds - the bench, the roster by default

 @param lines - sink for the level and text of every line logged

 @param asked - sink for the seat of every call

 @returns What asking came to

 @example
 ```ts
 const result = await askBench({ behave: everySeatAnswers, cache, lines: [], asked: [], },);
 ```
 */
async function askBench(
  {
    behave,
    cache,
    modelIds = BENCH,
    lines,
    asked,
  }: {
    readonly behave: SeatScript;
    readonly cache: SliceCache<ConsistencyRecord>;
    readonly modelIds?: readonly RosterModelId[];
    readonly lines: string[];
    readonly asked: RosterModelId[];
  },
): ReturnType<typeof askConsistencyBench> {
  return await askConsistencyBench({
    client: scriptedJudgeClient({ behave, asked, sheets: [], },),
    modelIds,
    subject: SUBJECT,
    cache,
    signal: AbortSignal.timeout(HANG_STOP_MS,),
    exchangeTimeoutMs: HANG_STOP_MS,
    l: levelCapturingLogger({ lines, },),
    stageSettings: SCRIPTED_STAGE_SETTINGS,
  },);
}

/**
 What a seat does when one seat answers with a ballot and the others with a reply the sheet cannot count.

 @param seat - the seat asked

 @returns The seat's reply

 @example
 ```ts
 const behave: SeatScript = oneSeatAnswers;
 ```
 */
function oneSeatAnswers({ seat, }: { readonly seat: RosterModelId; },): SeatBehaviour {
  return (seat === SEAT_HYPER_ONLY)
    ? { kind: 'answers', text: replyOf({ seat, },), }
    : {
      kind: 'answers',
      text: JSON.stringify({ reason: 'A place that is not on the sheet.', quotes: [], choice: 'OCCURRENCE 9', keep: [], },),
    };
}

/**
 What the gather alone makes of the bench, to read beside what asking makes of it.

 @param behave - what each seat does

 @returns The gather over the same sheet and bench

 @example
 ```ts
 const gathered = await gatheredBy({ behave: everySeatAnswers, },);
 ```
 */
async function gatheredBy(
  { behave, }: { readonly behave: SeatScript; },
): ReturnType<typeof gatherStageVoices<unknown>> {
  return await gatherStageVoices({
    client: scriptedJudgeClient({ behave, asked: [], sheets: [], },),
    modelIds: BENCH,
    messages: buildConsistencyMessages({ subject: SUBJECT, },),
    signal: AbortSignal.timeout(HANG_STOP_MS,),
    exchangeTimeoutMs: HANG_STOP_MS,
    responseFormat: CONSISTENCY_RESPONSE_FORMAT,
    validate: usableConsistencyBallotFor({ labels: consistencyLabels({ count: 2, },), },),
    stage: 'page-consistency',
    l: levelCapturingLogger({ lines: [], },),
    graceMs: HANG_STOP_MS,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: askConsistencyBench.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS EVERY SEAT AND HANDS BACK THE BALLOTS IN ROSTER ORDER, each beside the seat that gave it, and stores the '
            + 'gather whole under the question\'s key',
          fn: async () => {
            const persisted: { key: string; serialized: string; }[] = [];
            const asked: RosterModelId[] = [];
            const result = await askBench({
              behave: everySeatAnswers,
              cache: recordingCache({ resumed: new Map(), persisted, },),
              lines: [],
              asked,
            },);
            // Control: the gather itself hands its voices back in the order the bench is rotated to, not the roster's.
            const gathered = await gatheredBy({ behave: everySeatAnswers, },);
            expect(gathered.voices.map(function seatOf(voice,): string {
              return voice.modelId;
            },),).not.toEqual(BENCH,);
            expect(result,).toEqual({
              quorum: 2,
              voices: BENCH.map(function voiceFor(seat,) {
                return voiceOf({ seat, },);
              },),
              findings: [],
              resumed: false,
            },);
            expect([...asked,].toSorted(),).toEqual([...BENCH,].toSorted(),);
            expect(persisted.map(function keyOf(entry,): string {
              return entry.key;
            },),).toEqual([KEY,],);
            expect(JSON.parse(persisted[0]?.serialized ?? 'null',),).toEqual({
              quorum: 2,
              voices: result.voices,
              findings: [],
            },);
          },
        },),
        it({
          name: 'STORES NOTHING FOR A GATHER THAT MISSED ITS QUORUM, handing back the ballot it did hear with the quorum '
            + 'it needed and the gather\'s findings, so a resume asks again',
          fn: async () => {
            const persisted: { key: string; serialized: string; }[] = [];
            const result = await askBench({
              behave: oneSeatAnswers,
              cache: recordingCache({ resumed: new Map(), persisted, },),
              lines: [],
              asked: [],
            },);
            const gathered = await gatheredBy({ behave: oneSeatAnswers, },);
            expect(gathered.quorumMet,).toBe(false,);
            expect(result,).toEqual({
              quorum: 2,
              voices: [voiceOf({ seat: SEAT_HYPER_ONLY, },),],
              findings: gathered.findings,
              resumed: false,
            },);
            expect(persisted,).toEqual([],);
          },
        },),
        it({
          name: 'READS BACK A STORED ANSWER INSTEAD OF ASKING, marking it resumed and saying how many ballots it read',
          fn: async () => {
            const stored: ConsistencyRecord = {
              quorum: 2,
              voices: [voiceOf({ seat: SEAT_HYPER_ONLY, },), voiceOf({ seat: SEAT_BEDROCK_ONLY_TEXT, },),],
              findings: ['stage-voice-lost (page-consistency minimax-m3)',],
            };
            const lines: string[] = [];
            const asked: RosterModelId[] = [];
            const result = await askBench({
              behave: everySeatAnswers,
              cache: recordingCache({ resumed: new Map([[KEY, stored,],],), persisted: [], },),
              lines,
              asked,
            },);
            expect(result,).toEqual({ ...stored, resumed: true, },);
            expect(asked,).toEqual([],);
            expect(lines,).toEqual(['info [askConsistencyBench] resumed 2 ballots',],);
          },
        },),
        it({
          name: 'SAYS ONE BALLOT, NOT ONE BALLOTS, WHEN IT READS BACK A GATHER OF ONE VOICE',
          fn: async () => {
            const stored: ConsistencyRecord = {
              quorum: 1,
              voices: [voiceOf({ seat: SEAT_HYPER_ONLY, },),],
              findings: [],
            };
            const lines: string[] = [];
            await askBench({
              behave: everySeatAnswers,
              cache: recordingCache({ resumed: new Map([[KEY, stored,],],), persisted: [], },),
              lines,
              asked: [],
            },);
            expect(lines,).toEqual(['info [askConsistencyBench] resumed 1 ballot',],);
          },
        },),
        it({
          name: 'ASKS AGAIN WHEN THE STORED ANSWER IS FOR ANOTHER BENCH, since the key names the bench as well as the sheet',
          fn: async () => {
            const otherKey = consistencyKey({
              messages: buildConsistencyMessages({ subject: SUBJECT, },),
              modelIds: BENCH.slice(0, 2,),
            },);
            const asked: RosterModelId[] = [];
            const result = await askBench({
              behave: everySeatAnswers,
              cache: recordingCache({
                resumed: new Map([[otherKey, { quorum: 1, voices: [voiceOf({ seat: SEAT_HYPER_ONLY, },),], findings: [], },],],),
                persisted: [],
              },),
              lines: [],
              asked,
            },);
            expect(result.resumed,).toBe(false,);
            expect(asked.length,).toBe(BENCH.length,);
          },
        },),
        it({
          name: 'COUNTS THE BALLOTS IN HAND WHEN THE STORE REFUSES THEM, warning that they are counted all the same',
          fn: async () => {
            const lines: string[] = [];
            const result = await askBench({
              behave: everySeatAnswers,
              cache: recordingCache({
                resumed: new Map(),
                persisted: [],
                refusal: new Error('the cat sat on the disk',),
              },),
              lines,
              asked: [],
            },);
            expect(result.voices.length,).toBe(BENCH.length,);
            expect(result.resumed,).toBe(false,);
            expect(lines.filter(function namesTheStore(line,): boolean {
              return line.includes('could not be stored',);
            },),).toEqual([
              'warn [askConsistencyBench] the ballots could not be stored (refused by Error); they are counted all the same',
            ],);
          },
        },),
        it({
          name: 'REFUSES A BENCH THAT SEATS ONE MODEL TWICE before any seat is asked',
          fn: async () => {
            const asked: RosterModelId[] = [];
            const refusal = await rejectionOf(async function asksTwiceSeated(): Promise<unknown> {
              return await askBench({
                behave: everySeatAnswers,
                cache: recordingCache({ resumed: new Map(), persisted: [], },),
                modelIds: [SEAT_HYPER_ONLY, SEAT_HYPER_ONLY,],
                lines: [],
                asked,
              },);
            },);
            expect(refusal,).toBeInstanceOf(StageRosterRepeatError,);
            expect(asked,).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
