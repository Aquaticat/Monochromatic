/**
 Guards ledger X12 at the preparation's attestation round: the round is asked
 of the roster its hook hands over, so a roster re-read under a hold attests
 on the bench as it stands, and an original linking nowhere reads no hook and
 asks nobody.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  attestPassReferences,
  type BenchSeating,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  keepBench,
  type PipelineDigest,
  preparePassEntry,
  REFERENCE_ATTEST_RESPONSE_FORMAT,
  type RosterModelId,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';
import {
  SEAT_HYPER_ONLY,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
} from '../roster-seats.test-fixture.ts';

import { NO_OUTSIDE_READS, } from './pass-outside-reads.test-fixture.ts';

/**
 Logger the round writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-attest-references-test', },);

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
 What the one page the original links says.
 */
const REFERENCE_LINES = '- reference 1 https://cats.example/posts/mittens ("Mittens"): Mittens had a brother who sat by the stove.';

/**
 Builds a client recording which seat every call asked, every reply one the
 sheet refuses, so the round attests nothing and only the seats matter.

 @param asked - sink for the seat of every call

 @param attested - sink for the seat of every call on the attestation sheet,
 for a case that must tell the attestation apart from the other rounds

 @returns Client serving only structured calls

 @example
 ```ts
 const client = seatRecordingClient({ asked: [], },);
 ```
 */
function seatRecordingClient(
  {
    asked,
    attested,
  }: {
    readonly asked: RosterModelId[];
    readonly attested?: RosterModelId[];
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      if (request.responseFormat?.json_schema.name === REFERENCE_ATTEST_RESPONSE_FORMAT.json_schema.name)
        attested?.push(request.modelId,);
      return { kind: 'schema-mismatch', rawText: '{}', detail: 'fixture attests nothing', };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/**
 Runs the round, recording the seats asked and how often the hook was read.

 @param referenceLines - what the linked pages say, empty for an original
 linking nowhere

 @param beforeItem - hook handing the round its roster, `keepBench` for a
 caller that re-seats nothing

 @returns Seats the round asked, beside the hook's reads

 @example
 ```ts
 const { asked, hookReads, } = await attestationAsked({ referenceLines: REFERENCE_LINES, beforeItem: keepBench, },);
 ```
 */
async function attestationAsked(
  {
    referenceLines,
    beforeItem,
  }: {
    readonly referenceLines: string;
    readonly beforeItem: () => Promise<BenchSeating>;
  },
): Promise<{
  readonly asked: readonly RosterModelId[];
  readonly hookReads: number;
}> {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  /**
   Reads the hook took.
   */
  const reads = { count: 0, };
  await attestPassReferences({
    client: seatRecordingClient({ asked, },),
    modelIds: ROSTER,
    beforeItem: async (): Promise<BenchSeating> => {
      reads.count += 1;
      return await beforeItem();
    },
    sourceText: '猫在炉边坐着。',
    archiveText: 'The cat sat by the stove.',
    referenceLines,
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l,
  },);
  return {
    asked,
    hookReads: reads.count,
  };
}

/**
 Hook re-seating the round elsewhere.

 @returns Seating on the re-seated roster

 @example
 ```ts
 const seating = await reseatElsewhere();
 ```
 */
function reseatElsewhere(): Promise<BenchSeating> {
  return Promise.resolve({ modelIds: RESEATED, },);
}

/**
 Seats in a run outside a roster.

 @param asked - seats the run asked

 @param roster - roster every seat should sit on

 @returns Seats off that roster

 @example
 ```ts
 const strays = offRoster({ asked, roster: RESEATED, },);
 ```
 */
function offRoster(
  {
    asked,
    roster,
  }: {
    readonly asked: readonly RosterModelId[];
    readonly roster: readonly RosterModelId[];
  },
): readonly RosterModelId[] {
  return asked.filter(function outside(seat,): boolean {
    return !roster.includes(seat,);
  },);
}

await describe({
  name: `${attestPassReferences.name} re-seated under a hold (ledger X12)`,
  children: [
    it({
      name: 'ASKS THE ROUND OF THE ROSTER ITS HOOK HANDS OVER, so a roster re-read after a provider dry-out '
        + 'attests on the bench as it stands, where a hook that re-seats nothing asks the roster it started on',
      fn: async () => {
        /**
         Seats asked when the hook re-seats nothing.
         */
        const control = await attestationAsked({ referenceLines: REFERENCE_LINES, beforeItem: keepBench, },);
        /**
         Seats asked when the hook re-seats the round elsewhere.
         */
        const moved = await attestationAsked({ referenceLines: REFERENCE_LINES, beforeItem: reseatElsewhere, },);
        expect({
          controlAskedAny: control.asked.length > 0,
          controlOffRoster: offRoster({ asked: control.asked, roster: ROSTER, },),
          movedAskedAny: moved.asked.length > 0,
          movedOffReseated: offRoster({ asked: moved.asked, roster: RESEATED, },),
          movedHookReads: moved.hookReads,
        },).toEqual({
          controlAskedAny: true,
          controlOffRoster: [],
          movedAskedAny: true,
          movedOffReseated: [],
          movedHookReads: 1,
        },);
      },
    },),
    it({
      name: 'ASKS NOBODY AND READS NO HOOK when the original links nowhere, since that round has no bench to re-seat',
      fn: async () => {
        /**
         Round over an original linking nowhere.
         */
        const unlinked = await attestationAsked({ referenceLines: '', beforeItem: reseatElsewhere, },);
        expect({
          asked: unlinked.asked,
          hookReads: unlinked.hookReads,
        },).toEqual({
          asked: [],
          hookReads: 0,
        },);
      },
    },),
  ],
},);

/**
 Cache generation the preparation's caches are stamped with.
 */
const DIGEST = 'pass-attest-references-test' as PipelineDigest;

/**
 Directory one case owns for its entry caches, removed when the case ends.

 @returns Directory beside how to remove it

 @example
 ```ts
 await using cacheDir = await throwawayCacheDir();
 ```
 */
async function throwawayCacheDir(): Promise<{ readonly dir: string; } & AsyncDisposable> {
  /**
   Directory this case owns.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'pass-attest-references-',
  ),);
  return {
    dir,
    [Symbol.asyncDispose]: async () => {
      await rm(
        dir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 Runs a whole preparation whose original links one page, over an archive
 carrying a paragraph the original lacks, so the pairing, the attestation and
 the archive review are each asked.

 @param beforeItem - hook the preparation hands every round

 @returns Seats every call asked, beside the seats of the attestation calls

 @example
 ```ts
 const { asked, attested, } = await preparationAsked({ beforeItem: keepBench, },);
 ```
 */
async function preparationAsked(
  { beforeItem, }: { readonly beforeItem: () => Promise<BenchSeating>; },
): Promise<{
  readonly asked: readonly RosterModelId[];
  readonly attested: readonly RosterModelId[];
}> {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  /**
   Seat of every attestation call.
   */
  const attested: RosterModelId[] = [];
  await using cacheDir = await throwawayCacheDir();
  await preparePassEntry({
    client: seatRecordingClient({ asked, attested, },),
    entryId: 'CatEntry',
    entryCacheDir: cacheDir.dir,
    pipelineDigest: DIGEST,
    modelIds: ROSTER,
    sourceText: '猫在炉边坐着。\n\n它睡着了。',
    targetText: 'The cat sat by the stove.\n\nShe fell asleep.\n\nThe cat won an award.',
    signal: new AbortController().signal,
    exchangeTimeoutMs: 5_000,
    l,
    beforeItem,
    outsideReads: {
      ...NO_OUTSIDE_READS,
      references: async () => REFERENCE_LINES,
    },
  },);
  return {
    asked,
    attested,
  };
}

await describe({
  name: 'preparePassEntry hands its hook to the attestation (ledger X12)',
  children: [
    it({
      name: 'EVERY ROUND OF A PREPARATION ASKS THE ROSTER ITS HOOK HANDS OVER, the attestation among them, '
        + 'where a hook that re-seats nothing leaves every round on the roster the preparation started on',
      fn: async () => {
        /**
         Seats asked when the hook re-seats nothing.
         */
        const control = await preparationAsked({ beforeItem: keepBench, },);
        /**
         Seats asked when the hook re-seats every round elsewhere.
         */
        const moved = await preparationAsked({ beforeItem: reseatElsewhere, },);
        expect({
          controlAttested: control.attested.length > 0,
          controlOffRoster: offRoster({ asked: control.asked, roster: ROSTER, },),
          movedAttested: moved.attested.length > 0,
          movedOffReseated: offRoster({ asked: moved.asked, roster: RESEATED, },),
        },).toEqual({
          controlAttested: true,
          controlOffRoster: [],
          movedAttested: true,
          movedOffReseated: [],
        },);
      },
    },),
  ],
},);
