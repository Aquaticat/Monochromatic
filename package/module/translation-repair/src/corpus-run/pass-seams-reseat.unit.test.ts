/**
 Guards ledger X14: the pass seams wire each phase's re-seat hook into its
 driver. The hooks and the drivers each have their own cases, but no case drove
 a seam, so a seam that dropped its hook survived every guard. Each case here
 runs a seam against a client whose dryness view changes after the phase's own
 reading, under a hold: only a wired hook seats the bench the second view
 seats. A control whose view never changes shows the seat the change removes
 would otherwise have been asked.

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
  admitPassInsertions,
  type ArtifactComparisonRow,
  type ArtifactContestSlice,
  type ArtifactDeliveryRow,
  type BudgetView,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type DocumentLanesResult,
  judgeSeatsFor,
  makeInsertionChunk,
  type PreparedDocumentPair,
  type PipelineDigest,
  prepareDocumentPair,
  type ProjectedLanes,
  type RosterModelId,
  type RunClient,
  runPassConsolidation,
  runPassContest,
} from '../../dist/final/node/index.mjs';

/**
 Logger the seams write to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-seams-reseat-test', },);

/**
 Every provider wet: the view each phase reads at its start.
 */
const ALL_WET: BudgetView = {
  synthetic: false,
  bedrock: false,
  hyper: false,
  openrouter: false,
};

/**
 Synthetic dry: the view a hook reads once the hold began, under which no
 phase finds a bench short, so no reading waits (measured 2026-09-28).
 */
const SYNTHETIC_DRY: BudgetView = {
  ...ALL_WET,
  synthetic: true,
};

/**
 Hold Synthetic's refusal registers, which is what makes a hook read again.
 */
const HOLD_MS = 40;

/**
 Original of the one contested slice.
 */
const SOURCE = '猫在窗边睡着了。';

/**
 Archive wording of it.
 */
const ARCHIVE = 'The cat slept by the window.';

/**
 Repair lane wording of it.
 */
const REPAIR = 'The cat fell asleep by the window.';

/**
 Translate lane wording of it.
 */
const TRANSLATE = 'The cat had fallen asleep beside the window.';

/**
 The one seat both benches under test lose when Synthetic goes dry: first of
 the late judges and of the slate judges, and among the writers, while every
 provider is wet.
 */
const LOST_SEAT = (function lostSeat(): RosterModelId {
  /**
   Late judges while every provider is wet.
   */
  const wet = judgeSeatsFor({ dry: ALL_WET, },).lateJudges;
  /**
   Late judges while Synthetic is dry.
   */
  const dry = new Set(judgeSeatsFor({ dry: SYNTHETIC_DRY, },).lateJudges,);
  /**
   Seats the dry-out takes.
   */
  const lost = wet.filter(function gone(seat,): boolean {
    return !dry.has(seat,);
  },);
  if (lost.length === 0)
    throw new Error('the fixture views seat the same late judges, so no case here can tell a wired hook apart',);
  return lost[0] as RosterModelId;
})();

/**
 Builds a run client whose view is every provider wet on the first reading
 and the given view on every later one, with Synthetic held, recording every
 seat a structured call asked.

 @param later - view every reading after the first answers

 @param asked - sink for the seat of every call

 @param answer - reply every call is given, which the sheet may refuse

 @returns Client to drive a seam with

 @example
 ```ts
 const client = viewChangingClient({ later: SYNTHETIC_DRY, asked: [], answer: '{}', },);
 ```
 */
function viewChangingClient(
  {
    later,
    asked,
    answer,
  }: {
    readonly later: BudgetView;
    readonly asked: RosterModelId[];
    readonly answer: string;
  },
): RunClient {
  /**
   Readings taken so far.
   */
  const counter = { reads: 0, };
  return {
    providerDryness: async (): Promise<BudgetView> => {
      counter.reads += 1;
      return (counter.reads === 1) ? ALL_WET : later;
    },
    providerHolds: () => ({
      synthetic: HOLD_MS,
      bedrock: 0,
      hyper: 0,
      openrouter: 0,
    }),
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      /**
       That reply as the sheet parses it.
       */
      const value: unknown = JSON.parse(answer,);
      return request.validate(value,)
        ? { kind: 'ok', value, rawText: answer, }
        : { kind: 'schema-mismatch', rawText: answer, detail: 'fixture answers another sheet', };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

/**
 Both lanes over the one slice, worded differently.
 */
const PROJECTED: ProjectedLanes = (function projected(): ProjectedLanes {
  /**
   Delivery row a lane ships with its wording.
   */
  function deliveryOf({ shippedText, }: { readonly shippedText: string; },): ArtifactDeliveryRow {
    return {
      sliceIndex: 0,
      sourceText: SOURCE,
      incumbentKind: 'present',
      incumbentText: ARCHIVE,
      outcome: {
        kind: 'decided',
        acceptedText: shippedText,
      },
      shippedText,
      delivery: { kind: 'replacement-shipped', },
    };
  }
  /**
   Comparison row carrying the two wordings.
   */
  const comparison: ArtifactComparisonRow = {
    sliceIndex: 0,
    incumbentKind: 'present',
    incumbentText: ARCHIVE,
    repairText: REPAIR,
    translateText: TRANSLATE,
    laneRelation: 'both-differ',
    repairOutcome: {
      kind: 'decided',
      acceptedText: REPAIR,
    },
    translateOutcome: {
      kind: 'decided',
      acceptedText: TRANSLATE,
    },
    decisionComparison: {
      kind: 'comparable',
      verdict: 'different',
    },
    repairDelivery: { kind: 'replacement-shipped', },
    translateDelivery: { kind: 'replacement-shipped', },
  };
  return {
    delivery: {
      repair: [deliveryOf({ shippedText: REPAIR, },),],
      translate: [deliveryOf({ shippedText: TRANSLATE, },),],
    },
    comparison: [comparison,],
  };
})();

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
    'pass-seams-reseat-',
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
 Generation stamp the caches are opened under.
 */
const DIGEST = 'pass-seams-reseat-test' as PipelineDigest;

/**
 Runs the contest seam over the one slice, every judge voting for the repair
 lane.

 @param later - view every reading after the phase's own answers

 @returns Seats the judges' calls asked

 @example
 ```ts
 const asked = await contestAsked({ later: SYNTHETIC_DRY, },);
 ```
 */
async function contestAsked({ later, }: { readonly later: BudgetView; },): Promise<readonly RosterModelId[]> {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  await using cacheDir = await throwawayCacheDir();
  await runPassContest({
    client: viewChangingClient({
      later,
      asked,
      answer: JSON.stringify({
        choice: 'repair',
        unsupported: [],
        dropped: [],
        reason: 'the original supports it',
      },),
    },),
    // Only the repair lane's chunks are read, for damage claims and dispute
    // notes, and a lane with none carries neither.
    lanes: { repair: { chunks: [], }, } as unknown as DocumentLanesResult,
    projected: PROJECTED,
    frontMatterSlices: new Set(),
    lineStructuredSlices: new Set(),
    entryCacheDir: cacheDir.dir,
    pipelineDigest: DIGEST,
    signal: AbortSignal.timeout(30_000,),
    overlap: 1,
    l,
  },);
  return asked;
}

/**
 Runs the consolidation seam over the one slice, which the contest gave the
 repair lane, every call answered with nothing a sheet can read.

 @param later - view every reading after the phase's own answers

 @returns Seats the consolidation's calls asked

 @example
 ```ts
 const asked = await consolidationAsked({ later: SYNTHETIC_DRY, },);
 ```
 */
async function consolidationAsked({ later, }: { readonly later: BudgetView; },): Promise<readonly RosterModelId[]> {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  /**
   The contest's record for the slice.
   */
  const contest: ArtifactContestSlice = {
    sliceIndex: 0,
    verdict: {
      kind: 'lane-won',
      lane: 'repair',
    },
    ballots: [],
    usable: 3,
  };
  await using cacheDir = await throwawayCacheDir();
  await runPassConsolidation({
    client: viewChangingClient({
      later,
      asked,
      answer: '"no sheet can read this"',
    },),
    prepared: prepareDocumentPair({
      sourceText: SOURCE,
      targetText: ARCHIVE,
    },),
    projected: PROJECTED,
    contests: [contest,],
    frontMatterSlices: new Set(),
    pictureReadings: new Map(),
    entryCacheDir: cacheDir.dir,
    pipelineDigest: DIGEST,
    signal: AbortSignal.timeout(30_000,),
    overlap: 1,
    l,
  },);
  return asked;
}

await describe({
  name: 'pass seams re-seat under a hold (ledger X14)',
  children: [
    it({
      name: 'THE CONTEST SEAM WIRES ITS HOOK: a slice after a dry-out asks the judges the hook re-read, never '
        + 'the seat the dry-out took, which a contest whose view never changes does ask',
      fn: async () => {
        /**
         Seats asked while every provider stays wet.
         */
        const control = await contestAsked({ later: ALL_WET, },);
        /**
         Seats asked once Synthetic reads dry after the phase's own reading.
         */
        const moved = await contestAsked({ later: SYNTHETIC_DRY, },);
        expect({
          controlAskedLost: control.includes(LOST_SEAT,),
          movedAskedAny: moved.length > 0,
          movedAskedLost: moved.includes(LOST_SEAT,),
        },).toEqual({
          controlAskedLost: true,
          movedAskedAny: true,
          movedAskedLost: false,
        },);
      },
    },),
    it({
      name: 'THE CONSOLIDATION SEAM WIRES ITS HOOK: a slice after a dry-out asks the writers, judges and '
        + 'naturalness roles the hook re-read, never the seat the dry-out took, which a consolidation whose '
        + 'view never changes does ask',
      fn: async () => {
        /**
         Seats asked while every provider stays wet.
         */
        const control = await consolidationAsked({ later: ALL_WET, },);
        /**
         Seats asked once Synthetic reads dry after the phase's own reading.
         */
        const moved = await consolidationAsked({ later: SYNTHETIC_DRY, },);
        expect({
          controlAskedLost: control.includes(LOST_SEAT,),
          movedAskedAny: moved.length > 0,
          movedAskedLost: moved.includes(LOST_SEAT,),
        },).toEqual({
          controlAskedLost: true,
          movedAskedAny: true,
          movedAskedLost: false,
        },);
      },
    },),
  ],
},);

/**
 The one seat the roster loses when Synthetic goes dry.
 */
const LOST_ROSTER_SEAT = (function lostRosterSeat(): RosterModelId {
  /**
   Roster while Synthetic is dry.
   */
  const dry = new Set(judgeSeatsFor({ dry: SYNTHETIC_DRY, },).roster,);
  /**
   Seats the dry-out takes from the roster.
   */
  const lost = judgeSeatsFor({ dry: ALL_WET, },).roster.filter(function gone(seat,): boolean {
    return !dry.has(seat,);
  },);
  if (lost.length === 0)
    throw new Error('the fixture views seat the same roster, so the admission case cannot tell a wired hook apart',);
  return lost[0] as RosterModelId;
})();

/**
 A page whose one slice is a source-only passage, over an archive long enough
 that page shortfall corroborates nothing.
 */
const GAP: PreparedDocumentPair = {
  sourceText: `${SOURCE}\n${'猫在窗台晒太阳。'.repeat(20,)}`,
  targetText: `## Cats\n\n${'The cat sleeps in warm sunlight. '.repeat(20,)}`,
  slices: [{
    source: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: SOURCE.length,
      text: SOURCE,
    },
    target: makeInsertionChunk({
      sliceIndex: 0,
      offset: 0,
    },),
  },],
  lineStructuredSliceIndices: new Set(),
  declaredNames: [],
  alignmentFindings: [],
  unclaimedTargetBlocks: [],
  alignmentPairCount: 1,
};

/**
 Runs the insertion admission seam over the one gap, every seat answering that
 the archive carries none of it.

 @param later - view every reading after the lanes' own answers

 @returns Seats the coverage calls asked

 @example
 ```ts
 const asked = await admissionAsked({ later: SYNTHETIC_DRY, },);
 ```
 */
async function admissionAsked({ later, }: { readonly later: BudgetView; },): Promise<readonly RosterModelId[]> {
  /**
   Seat of every call.
   */
  const asked: RosterModelId[] = [];
  /**
   Client whose first reading stands for the lanes' own, which seated the
   roster the admission starts on.
   */
  const client = viewChangingClient({
    later,
    asked,
    answer: JSON.stringify({
      coverage: 'none',
      quote: '',
      reason: 'the archive carries none of it',
    },),
  },);
  // THE LANES' READING, taken before the admission as `runPassEntry` takes it.
  await client.providerDryness({ signal: new AbortController().signal, },);
  await admitPassInsertions({
    client,
    prepared: GAP,
    modelIds: judgeSeatsFor({ dry: ALL_WET, },).roster,
    overlap: 1,
    signal: AbortSignal.timeout(30_000,),
    entryId: 'CatEntry',
  },);
  return asked;
}

await describe({
  name: 'insertion admission seam re-seats under a hold (ledger X14)',
  children: [
    it({
      name: 'THE INSERTION SEAM WIRES ITS HOOK: a candidate after a dry-out is asked of the roster the hook '
        + 're-read, never the seat the dry-out took, which an admission whose view never changes does ask',
      fn: async () => {
        /**
         Seats asked while every provider stays wet.
         */
        const control = await admissionAsked({ later: ALL_WET, },);
        /**
         Seats asked once Synthetic reads dry after the lanes' reading.
         */
        const moved = await admissionAsked({ later: SYNTHETIC_DRY, },);
        expect({
          controlAskedLost: control.includes(LOST_ROSTER_SEAT,),
          movedAskedAny: moved.length > 0,
          movedAskedLost: moved.includes(LOST_ROSTER_SEAT,),
        },).toEqual({
          controlAskedLost: true,
          movedAskedAny: true,
          movedAskedLost: false,
        },);
      },
    },),
  ],
},);
