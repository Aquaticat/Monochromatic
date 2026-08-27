/**
 * Tests for the contest driver: which slices it asks about, what it resumes,
 * and what it refuses to write down.
 *
 * WHAT IS UNDER TEST IS SPENDING. Every case here is about a call that must or
 * must not be made, which is the one property a driver has that its stage does
 * not: the stage answers whatever it is handed, and the driver decides what it
 * is worth handing over.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactComparisonRow,
  type ArtifactDeliveryRow,
  contestDocumentLanes,
  createSyntheticClient,
  type LaneContestOutcome,
  type ProjectedLanes,
  type SliceCache,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Roster of three, the smallest that can produce a two-to-one split.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
] as const;

/**
 * Logger for the driver under test.
 */
const l = tagged({ tag: 'lane-contest-driver-test', },);

/**
 * Per-call bound, generous because the transport answers instantly.
 */
const PER_CALL_TIMEOUT_MS = 5_000;

/**
 * Successful contest calls in flight and peak observed by fixture.
 */
type ContestConcurrency = {
  now: number;
  peak: number;
  started: number;
};

/**
 * Original of the slice the two lanes disagree about.
 */
const SOURCE_NAP = '猫猫在书店的阁楼里睡觉。';

/**
 * Archive`s own English for it.
 */
const ARCHIVE_NAP = 'The cat sleeps in the bookshop attic.';

/**
 * Wording the repair lane left.
 */
const REPAIR_NAP = 'The cat naps in the bookshop attic.';

/**
 * Wording the translate lane left.
 */
const TRANSLATE_NAP = 'The cat dozes in the attic of the bookshop.';

/**
 * Builds one ledger row, which is where the driver reads the original.
 *
 * @param sliceIndex - slice this row names
 *
 * @param shippedText - wording this lane`s document carries
 *
 * @returns Version 2 delivery row
 *
 * @example
 * ```ts
 * const row = catLedgerRow({ sliceIndex: 0, shippedText: REPAIR_NAP, },);
 * ```
 */
function catLedgerRow(
  {
    sliceIndex,
    shippedText,
  }: {
    readonly sliceIndex: number;
    readonly shippedText: string;
  },
): ArtifactDeliveryRow {
  return {
    sliceIndex,
    sourceText: SOURCE_NAP,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    outcome: {
      kind: 'decided',
      acceptedText: shippedText,
    },
    shippedText,
    delivery: { kind: 'replacement-shipped', },
  };
}

/**
 * Builds one comparison row carrying the two lane wordings.
 *
 * @param sliceIndex - slice this row names
 *
 * @param repairText - wording the repair document carries
 *
 * @param translateText - wording the translate document carries
 *
 * @returns Version 2 comparison row
 *
 * @example
 * ```ts
 * const row = catComparisonRow({ sliceIndex: 0, repairText: REPAIR_NAP, translateText: TRANSLATE_NAP, },);
 * ```
 */
function catComparisonRow(
  {
    sliceIndex,
    repairText,
    translateText,
  }: {
    readonly sliceIndex: number;
    readonly repairText: string;
    readonly translateText: string;
  },
): ArtifactComparisonRow {
  return {
    sliceIndex,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    repairText,
    translateText,
    laneRelation: (repairText === translateText) ? 'both-agree' : 'both-differ',
    repairOutcome: {
      kind: 'decided',
      acceptedText: repairText,
    },
    translateOutcome: {
      kind: 'decided',
      acceptedText: translateText,
    },
    decisionComparison: {
      kind: 'comparable',
      verdict: (repairText === translateText) ? 'same' : 'different',
    },
    repairDelivery: { kind: 'replacement-shipped', },
    translateDelivery: { kind: 'replacement-shipped', },
  };
}

/**
 * Builds both lanes as version 2 rows over a list of wording pairs.
 *
 * @param pairs - wording each lane left, slice by slice
 *
 * @returns Projection the driver reads
 *
 * @example
 * ```ts
 * const projected = catProjection({ pairs: [[REPAIR_NAP, TRANSLATE_NAP,],], },);
 * ```
 */
function catProjection(
  {
    pairs,
  }: {
    readonly pairs: readonly (readonly [
      string,
      string,
    ])[];
  },
): ProjectedLanes {
  return {
    delivery: {
      repair: pairs.map(function toRepairRow(
        pair,
        sliceIndex,
      ): ArtifactDeliveryRow {
        return catLedgerRow({
          sliceIndex,
          shippedText: pair[0],
        },);
      },),
      translate: pairs.map(function toTranslateRow(
        pair,
        sliceIndex,
      ): ArtifactDeliveryRow {
        return catLedgerRow({
          sliceIndex,
          shippedText: pair[1],
        },);
      },),
    },
    comparison: pairs.map(function toComparisonRow(
      pair,
      sliceIndex,
    ): ArtifactComparisonRow {
      return catComparisonRow({
        sliceIndex,
        repairText: pair[0],
        translateText: pair[1],
      },);
    },),
  };
}

/**
 * Client and cache a case drives the driver with, plus what each recorded.
 */
type CatRig = {
  /**
   * Calls the transport served, one label per model call.
   */
  readonly calls: readonly string[];

  /**
   * Keys the driver asked to persist.
   */
  readonly persisted: readonly string[];

  /**
   * Records the driver produced.
   */
  readonly slices: readonly {
    readonly sliceIndex: number;
    readonly verdict: { readonly kind: string; };
  }[];
};

/**
 * Drives the contest over one projection, counting what it spent.
 *
 * @param pairs - wording each lane left, slice by slice
 *
 * @param answering - whether the transport serves ballots or fails every call
 *
 * @param resumed - ballots an earlier run already bought
 *
 * @param overlap - most contested slices in flight
 *
 * @param activity - optional successful-call overlap instrument
 *
 * @returns What the driver called, persisted and recorded
 *
 * @example
 * ```ts
 * const rig = await drive({ pairs, answering: true, },);
 * ```
 */
async function drive(
  {
    pairs,
    answering,
    resumed = new Map<string, LaneContestOutcome>(),
    overlap = 1,
    activity,
  }: {
    readonly pairs: readonly (readonly [
      string,
      string,
    ])[];
    readonly answering: boolean;
    readonly resumed?: ReadonlyMap<string, LaneContestOutcome>;
    readonly overlap?: number;
    readonly activity?: ContestConcurrency;
  },
): Promise<CatRig> {
  /**
   * Calls the transport served.
   */
  const calls: string[] = [];

  /**
   * Keys the driver asked to persist.
   */
  const persisted: string[] = [];

  /**
   * Cache recording what it was asked to keep.
   */
  const cache: SliceCache<LaneContestOutcome> = {
    resumed,
    persist: async function record({ key, },): Promise<void> {
      persisted.push(key,);
    },
  };

  /**
   * Client answering every judge the same way, or failing every call.
   */
  const inner = createSyntheticClient({
    apiKey: 'test-key',
    transport: async function cannedTransport(exchange,) {
      calls.push(exchange.label,);
      if (!answering) {
        return {
          status: 500,
          bodyText: 'the bookshop is closed',
        };
      }
      return {
        status: 200,
        bodyText: `data: ${
          JSON.stringify({
            choices: [
              {
                index: 0,
                delta: {
                  content: JSON.stringify({
                    choice: 'translate',
                    unsupported: [],
                    dropped: [],
                    reason: 'the original supports it',
                  },),
                },
              },
            ],
          },)
        }\n\ndata: [DONE]\n\n`,
      };
    },
  },);

  /**
   * Client-level activity instrument, outside provider slot limiting so it
   * measures slices admitted by the driver rather than transport concurrency.
   */
  const client: SyntheticClient = (activity === undefined)
    ? inner
    : {
      chatText: inner.chatText,
      chatJson: async (request) => {
        /**
         * Start position making second slice finish before first under overlap.
         */
        const startPosition = activity.started;
        activity.started += 1;
        activity.now += 1;
        activity.peak = Math.max(
          activity.peak,
          activity.now,
        );
        await wait(startPosition < ROSTER.length ? 20 : 5,);
        activity.now -= 1;
        return await inner.chatJson(request,);
      },
      quotas: inner.quotas,
    };

  /**
   * Records the driver produced.
   */
  const slices = await contestDocumentLanes({
    client,
    projected: catProjection({ pairs, },),
    modelIds: ROSTER,
    cache,
    signal: AbortSignal.timeout(30_000,),
    perCallTimeoutMs: PER_CALL_TIMEOUT_MS,
    overlap,
    l,
  },);
  return {
    calls,
    persisted,
    slices,
  };
}

await describe({
  name: contestDocumentLanes.name,
  children: [
    it({
      name:
        'BUYS NOTHING where the two lanes left the same wording, which is most of most documents: a '
        + 'contest between two identical candidates has no question to put',
      fn: async () => {
        /**
         * Two slices both lanes agree on.
         */
        const rig = await drive({
          pairs: [
            [
              ARCHIVE_NAP,
              ARCHIVE_NAP,
            ],
            [
              REPAIR_NAP,
              REPAIR_NAP,
            ],
          ],
          answering: true,
        },);
        expect(rig.calls,).toEqual([],);
        expect(rig.slices,).toEqual([],);
      },
    },),
    it({
      name: 'ASKS ONLY the slices that differ, leaving the agreed ones out of the record entirely',
      fn: async () => {
        /**
         * Three slices, of which the middle one differs.
         */
        const rig = await drive({
          pairs: [
            [
              ARCHIVE_NAP,
              ARCHIVE_NAP,
            ],
            [
              REPAIR_NAP,
              TRANSLATE_NAP,
            ],
            [
              ARCHIVE_NAP,
              ARCHIVE_NAP,
            ],
          ],
          answering: true,
        },);
        expect(rig.calls
          .length,).toBe(ROSTER.length,);
        expect(rig.slices
          .map(function nameSlice(slice,): number {
            return slice.sliceIndex;
          },),).toEqual([1,],);
        expect(rig.slices
          .at(0,)
          ?.verdict,).toEqual({
          kind: 'lane-won',
          lane: 'translate',
        },);
      },
    },),
    it({
      name: 'runs two contested slices at once at overlap 2, after a serial positive '
        + 'control proves the successful-call instrument distinguishes one from two, '
        + 'and returns records in comparison order when the second slice finishes first',
      fn: async () => {
        /**
         * Distinct questions preventing cache-key aliasing from affecting order.
         */
        const pairs = [
          [
            REPAIR_NAP,
            TRANSLATE_NAP,
          ],
          [
            `${REPAIR_NAP} Again.`,
            `${TRANSLATE_NAP} Again.`,
          ],
        ] as const;

        /**
         * Serial positive-control activity.
         */
        const serial: ContestConcurrency = {
          now: 0,
          peak: 0,
          started: 0,
        };
        await drive({
          pairs,
          answering: true,
          overlap: 1,
          activity: serial,
        },);

        /**
         * Two-slice activity.
         */
        const overlapped: ContestConcurrency = {
          now: 0,
          peak: 0,
          started: 0,
        };
        const rig = await drive({
          pairs,
          answering: true,
          overlap: 2,
          activity: overlapped,
        },);
        expect(serial.peak,).toBe(ROSTER.length,);
        expect(overlapped.peak,).toBe(ROSTER.length * 2,);
        expect(rig.slices.map(function toIndex(slice,) {
          return slice.sliceIndex;
        },),).toEqual([
          0,
          1,
        ],);
      },
    },),

    it({
      name: 'PERSISTS a settled verdict, since ballots are the purchased thing and the next resume must not re-buy them',
      fn: async () => {
        /**
         * One contested slice, answered.
         */
        const rig = await drive({
          pairs: [
            [
              REPAIR_NAP,
              TRANSLATE_NAP,
            ],
          ],
          answering: true,
        },);
        expect(rig.persisted
          .length,).toBe(1,);
      },
    },),
    it({
      name:
        'REFUSES TO PERSIST an unheard roster, because a provider down for one night is not a property '
        + 'of the question and caching it would freeze that night into every later resume',
      fn: async () => {
        /**
         * One contested slice nobody answered.
         */
        const rig = await drive({
          pairs: [
            [
              REPAIR_NAP,
              TRANSLATE_NAP,
            ],
          ],
          answering: false,
        },);
        expect(rig.persisted,).toEqual([],);
        expect(rig.slices
          .at(0,)
          ?.verdict,).toEqual({ kind: 'quorum-not-met', },);
      },
    },),
    it({
      name:
        'RESUMES a slice off the cache without calling anything, and does not write back what it just '
        + 'read: a re-persisted resume is a write per slice per run for nothing',
      fn: async () => {
        /**
         * Ballots an earlier run bought, under the key this run derives.
         */
        const bought: LaneContestOutcome = {
          choice: 'repair',
          ballots: [
            {
              choice: 'repair',
              unsupported: [],
              unsupportedRaw: [],
              dropped: [],
              droppedRaw: [],
              reason: 'bought earlier',
            },
            {
              choice: 'repair',
              unsupported: [],
              unsupportedRaw: [],
              dropped: [],
              droppedRaw: [],
              reason: 'bought earlier',
            },
          ],
          usable: 2,
          findings: [],
        };

        // THROUGH A FRESH RUN FIRST, to learn the key rather than to spell it
        // out here: a fixture that wrote the key itself would keep passing after
        // the two derivations diverged, which is the defect the pinned key test
        // exists for and the one a resumption test must not repeat.
        const learned = await drive({
          pairs: [
            [
              REPAIR_NAP,
              TRANSLATE_NAP,
            ],
          ],
          answering: true,
        },);

        /**
         * Same slice, with those ballots already on disk.
         */
        const rig = await drive({
          pairs: [
            [
              REPAIR_NAP,
              TRANSLATE_NAP,
            ],
          ],
          answering: true,
          resumed: new Map([
            [
              learned.persisted
                .at(0,) ?? '',
              bought,
            ],
          ],),
        },);
        expect(rig.calls,).toEqual([],);
        expect(rig.persisted,).toEqual([],);
        expect(rig.slices
          .at(0,)
          ?.verdict,).toEqual({
          kind: 'lane-won',
          lane: 'repair',
        },);
      },
    },),
  ],
},);
