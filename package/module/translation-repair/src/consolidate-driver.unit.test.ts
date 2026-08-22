/**
 * Tests for the consolidation over one document.
 *
 * WHAT THESE PIN is the driver's own reasoning, which is the part no stage test
 * reaches: which slices it asks about at all, what it resumes rather than
 * rebuys, what it is willing to write to the cache, and what it refuses to
 * proceed past.
 *
 * EVERY CASE HERE BUYS NOTHING. The client these hand over throws on any call,
 * which is the assertion: a driver that reached the roster on a resumed slice,
 * or on a slice the contest never settled, fails loudly instead of quietly
 * costing a run its budget. The rounds themselves are covered by
 * `consolidate-settle.unit.test.ts`.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  consolidateDocument,
  createSyntheticClient,
} from '../dist/final/node/index.mjs';

/**
 * Logger the driver writes through, whose output is not under test.
 */
const l = tagged({ tag: 'consolidate-driver-test', },);

/**
 * Roster this run seats.
 */
const ROSTER = ['hf:zai-org/GLM-5.2',] as const;

/**
 * Per-call bound, never reached because nothing here buys a call.
 */
const CALL_TIMEOUT_MS = 5_000;

/**
 * A client that refuses to be used, so any call at all is a failure rather
 * than a slow test.
 */
const REFUSING_CLIENT = createSyntheticClient({
  apiKey: 'test-key',
  transport: async function refusingTransport() {
    throw new Error('the driver bought a call it should not have',);
  },
},);

/**
 * Builds both ledgers for a document of two slices.
 *
 * @returns Projection shaped as the lanes leave one
 *
 * @example
 * ```ts
 * const projected = twoSliceDocument();
 * ```
 */
function twoSliceDocument() {
  /**
   * One comparison row per slice, both lanes wording them differently.
   */
  const comparison = [0, 1,].map(function toRow(chunkIndex,) {
    return {
      chunkIndex,
      incumbentKind: 'present',
      incumbentText: `archive wording for slice ${String(chunkIndex,)}`,
      repairText: `repair wording for slice ${String(chunkIndex,)}`,
      translateText: `translate wording for slice ${String(chunkIndex,)}`,
    };
  },);

  return {
    comparison,
    delivery: {
      repair: comparison.map(function toDelivery(row,) {
        return {
          chunkIndex: row.chunkIndex,
          sourceText: `原文${String(row.chunkIndex,)}`,
        };
      },),
      translate: [],
    },
  };
}

/**
 * Builds one contest outcome.
 *
 * @param choice - lane the contest settled on
 *
 * @returns Outcome shaped as the contest stage returns one
 *
 * @example
 * ```ts
 * const outcome = contestSettling({ choice: 'repair', },);
 * ```
 */
function contestSettling({ choice, }: { readonly choice: string; },) {
  return {
    choice,
    ballots: [],
    usable: ROSTER.length,
  };
}

/**
 * Builds a settlement as the stage returns one, for the cache to hand back.
 *
 * @param terminal - how the slice left the stage
 *
 * @returns Settlement shaped as `settleConsolidation` returns one
 *
 * @example
 * ```ts
 * const settled = settlementReaching({ terminal: 'incumbent-only', },);
 * ```
 */
function settlementReaching({ terminal, }: { readonly terminal: string; },) {
  return {
    terminal,
    text: 'whatever this slice keeps',
    floor: {
      kind: 'incumbent-only',
      refusedModelIds: [...ROSTER,],
    },
    verdicts: [],
    rewrapped: false,
    demoted: false,
  };
}

/**
 * Runs the driver over a document, collecting what it tried to persist.
 *
 * @param contests - what the contest settled, keyed by slice
 *
 * @param resumed - settlements an earlier run already bought
 *
 * @param projected - both ledgers, overridable to test a ledger gap
 *
 * @returns Records the driver produced beside the keys it wrote
 *
 * @example
 * ```ts
 * const { slices, written, } = await driveWith({ contests: new Map(), },);
 * ```
 */
async function driveWith(
  {
    contests,
    resumed = new Map(),
    projected = twoSliceDocument(),
  }: {
    readonly contests: ReadonlyMap<number, unknown>;
    readonly resumed?: ReadonlyMap<string, unknown>;
    readonly projected?: unknown;
  },
) {
  /**
   * Keys the driver decided were worth resuming later.
   */
  const written: string[] = [];

  const slices = await consolidateDocument({
    client: REFUSING_CLIENT,
    projected,
    contests,
    modelIds: ROSTER,
    cache: {
      resumed,
      persist: async function recordWrite({ key, }: { readonly key: string; },) {
        written.push(key,);
      },
    },
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    l,
  } as never,);

  return {
    slices,
    written,
  };
}

await describe({
  name: consolidateDocument.name,
  children: [
    it({
      name: 'ASKS NOTHING WHERE THE CONTEST NEVER RAN, which is the majority of most documents: a '
        + 'slice both lanes worded identically has nothing to consolidate, because a third rendering '
        + 'would be competing against their agreement rather than resolving a difference',
      fn: async () => {
        const { slices, written, } = await driveWith({ contests: new Map(), },);

        expect(slices.length,).toBe(0,);
        expect(written.length,).toBe(0,);
      },
    },),

    it({
      name: 'REACHES THE ROSTER FOR A SLICE NOTHING HAS SETTLED, which is the positive control for '
        + 'the resumption case below. A cache test that never proves the uncached path buys anything '
        + 'would pass just as well against a driver that had stopped calling the roster at all',
      fn: async () => {
        /**
         * What the driver did when handed an empty cache.
         */
        let raised: unknown;
        try {
          await driveWith({
            contests: new Map([[0, contestSettling({ choice: 'repair', },),],],),
          },);
        } catch (error: unknown) {
          raised = error;
        }

        expect(raised,).toBeInstanceOf(Error,);
        expect(String(raised,).includes('bought a call it should not have',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES A CONTESTED SLICE MISSING FROM THE REPAIR LEDGER rather than consolidating '
        + 'against no original, because the comparison and the ledger disagreeing about which slices '
        + 'exist is a defect upstream and settling one of them anyway would hide it',
      fn: async () => {
        /**
         * A document whose comparison names a slice the ledger does not.
         */
        const gapped = {
          ...twoSliceDocument(),
          delivery: {
            repair: [],
            translate: [],
          },
        };

        /**
         * What the driver did instead of returning.
         */
        let raised: unknown;
        try {
          await driveWith({
            contests: new Map([[0, contestSettling({ choice: 'repair', },),],],),
            projected: gapped,
          },);
        } catch (error: unknown) {
          raised = error;
        }

        expect(raised,).toBeInstanceOf(Error,);
        expect(String(raised,).includes('does not appear in the repair ledger',),).toBe(true,);
      },
    },),

    it({
      name: 'RETURNS ONE RECORD PER CONSOLIDATED SLICE IN COMPARISON ORDER, resuming both without '
        + 'buying, so a reader of the artifact can line records up against the comparison rows they '
        + 'answer rather than re-deriving the order',
      fn: async () => {
        /**
         * Both slices settled by an earlier run, keyed by whatever the driver
         * asks for: the cache here answers every key.
         */
        const everyKey = {
          get: function answerAnyKey() {
            return settlementReaching({ terminal: 'incumbent-only', },);
          },
        };

        const { slices, written, } = await driveWith({
          contests: new Map([
            [0, contestSettling({ choice: 'repair', },),],
            [1, contestSettling({ choice: 'translate', },),],
          ],),
          resumed: everyKey as never,
        },);

        expect(slices.length,).toBe(2,);
        expect(slices[0]?.chunkIndex,).toBe(0,);
        expect(slices[1]?.chunkIndex,).toBe(1,);
        expect(slices[0]?.terminal,).toBe('incumbent-only',);
        expect(slices[0]?.gate.kind,).toBe('not-asked',);
        expect(written.length,).toBe(0,);
      },
    },),
  ],
},);
