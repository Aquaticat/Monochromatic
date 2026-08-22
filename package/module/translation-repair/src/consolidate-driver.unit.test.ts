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
  type ArtifactContestSliceV2,
  consolidateDocument,
  type ConsolidationSettlement,
  type ConsolidationTerminal,
  consolidationWorthResuming,
  createSyntheticClient,
  type ProjectedLanesV2,
  type SliceCache,
  type TranslateDecision,
  type TranslateStageResult,
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
function twoSliceDocument(): ProjectedLanesV2 {
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
  } as unknown as ProjectedLanesV2;
}

/**
 * Builds one contest record, as the contest wrote it for the artifact.
 *
 * @param chunkIndex - slice this answers
 *
 * @param lane - lane the contest backed
 *
 * @returns Record shaped as the contest stage produces one
 *
 * @example
 * ```ts
 * const record = contestSettling({ chunkIndex: 0, lane: 'repair', },);
 * ```
 */
function contestSettling(
  {
    chunkIndex,
    lane,
  }: {
    readonly chunkIndex: number;
    readonly lane: 'repair' | 'translate';
  },
): ArtifactContestSliceV2 {
  return {
    chunkIndex,
    verdict: {
      kind: 'lane-won',
      lane,
    },
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
function settlementReaching(
  { terminal, }: { readonly terminal: ConsolidationTerminal; },
): ConsolidationSettlement {
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
 * const { slices, written, } = await driveWith({ contests: [], },);
 * ```
 */
async function driveWith(
  {
    contests,
    resumed = new Map(),
    projected = twoSliceDocument(),
  }: {
    readonly contests: readonly ArtifactContestSliceV2[];
    readonly resumed?: ReadonlyMap<string, ConsolidationSettlement>;
    readonly projected?: ProjectedLanesV2;
  },
) {
  /**
   * Keys the driver decided were worth resuming later.
   */
  const written: string[] = [];

  /**
   * Cache standing in for the entry store, recording every write.
   */
  const cache: SliceCache<ConsolidationSettlement> = {
    resumed,
    persist: async function recordWrite({ key, }: { readonly key: string; },): Promise<void> {
      written.push(key,);
    },
  };

  const slices = await consolidateDocument({
    client: REFUSING_CLIENT,
    projected,
    contests,
    modelIds: ROSTER,
    cache,
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    l,
  },);

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
        const { slices, written, } = await driveWith({ contests: [], },);

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
            contests: [contestSettling({ chunkIndex: 0, lane: 'repair', },),],
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
            contests: [contestSettling({ chunkIndex: 0, lane: 'repair', },),],
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
          contests: [
            contestSettling({ chunkIndex: 0, lane: 'repair', },),
            contestSettling({ chunkIndex: 1, lane: 'translate', },),
          ],
          resumed: everyKey as unknown as ReadonlyMap<string, ConsolidationSettlement>,
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

/**
 * Builds a judged round that settled the way a resume case needs.
 *
 * WHOLE AND HONEST rather than cast, because the predicate reads a field OFF
 * this object and a fixture narrowed to that field would stop the compiler
 * noticing if the field moved or was renamed. Everything else is the emptiest
 * value its type admits.
 *
 * @param decision - what the judges settled on
 *
 * @returns Round shaped as the judge returns one
 *
 * @example
 * ```ts
 * const decided = judgedAs({ decision: 'judged', },);
 * ```
 */
function judgedAs(
  { decision, }: { readonly decision: TranslateDecision; },
): TranslateStageResult {
  return {
    text: 'The cat naps in the window.',
    origin: 'incumbent',
    producer: {
      kind: 'incumbent',
      matched: [],
    },
    decision,
    voteWeight: 0,
    tally: {
      judgesAvailable: 0,
      ballots: 0,
      abstentions: 0,
      selfVotes: 0,
    },
    ballots: [],
    heardTranslators: 0,
    candidateCount: 1,
    findings: [],
    slate: [],
    selectedIndex: 0,
    shippedIndex: 0,
    perCandidate: [],
  };
}

/**
 * Builds a settlement that left the stage the way a resume case needs.
 *
 * ONLY THE FIELDS THE PREDICATE READS are real here. It looks at the terminal,
 * at how many ballots the gate could read, and at what the judges decided;
 * everything else on a settlement is carried for the record rather than for
 * this decision.
 *
 * @param terminal - how the slice left the stage
 *
 * @param usable - ballots the gate could read, absent where it never ran
 *
 * @param decision - what the judges decided, absent where none were asked
 *
 * @returns Settlement shaped as the stage returns one
 *
 * @example
 * ```ts
 * const settlement = settlementFor({ terminal: 'consolidated', usable: 4, },);
 * ```
 */
function settlementFor(
  {
    terminal,
    usable,
    decision,
  }: {
    readonly terminal: ConsolidationTerminal;
    readonly usable?: number;
    readonly decision?: TranslateDecision;
  },
): ConsolidationSettlement {
  return {
    terminal,
    text: 'The cat naps in the window.',
    floor: {
      kind: 'proposals',
      validModelIds: ['hf:cat/Cat-A',],
    },
    verdicts: [],
    rewrapped: false,
    demoted: false,
    ...((usable === undefined)
      ? {}
      : {
        gate: {
          choice: 'consolidated',
          ships: 'consolidated',
          ballots: [],
          usable,
          findings: [],
        },
      }),
    ...((decision === undefined) ? {} : { decided: judgedAs({ decision, },), }),
  } as ConsolidationSettlement;
}

await describe({
  name: consolidationWorthResuming.name,
  children: [
    it({
      name: 'REFUSES TO CACHE A GATE TOO THIN TO SETTLE, which is the whole reason this predicate '
        + 'exists: a night when one voice of six answered is a fact about a provider, not about the '
        + 'question, and writing it would answer every later resume of the entry with that night. The '
        + 'gate refuses to act below its quorum, so a cache that kept the result would preserve a '
        + 'verdict the gate itself declined to reach',
      fn: async () => {
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'gate-kept-standing', usable: 1, },),
        },),).toBe(false,);
      },
    },),

    it({
      name: 'CACHES A GATE THAT REACHED ITS QUORUM, which is the positive control: a predicate that '
        + 'refused everything would pass the case above while making every run re-buy every slice it '
        + 'had already settled',
      fn: async () => {
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'consolidated', usable: 2, },),
        },),).toBe(true,);
      },
    },),

    it({
      name: 'CACHES A SLICE STOPPED BEFORE THE GATE BY THE SLATE OR THE CONTEST, because neither is a '
        + 'fact about who answered. A floor that refused every proposal read the structural guard, and '
        + 'a contest that named neither lane left nothing to improve on; both hold on any night',
      fn: async () => {
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'incumbent-only', },),
        },),).toBe(true,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'no-standing-text', },),
        },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES TO CACHE JUDGES THAT DECLINED TO SETTLE, and caches judges that decided, which is '
        + 'the same distinction one stage earlier: translate-retry.ts buys a second judging for '
        + 'exactly declined-indecision and declined-rejection and records the settled decline under a '
        + 'different name. A predicate keyed on which text won rather than on whether they settled '
        + 'would freeze an undecided panel',
      fn: async () => {
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-kept-standing', decision: 'declined-indecision', },),
        },),).toBe(false,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-kept-standing', decision: 'declined-rejection', },),
        },),).toBe(false,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-kept-standing', decision: 'judged', },),
        },),).toBe(true,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-kept-standing', decision: 'no-candidate-backed', },),
        },),).toBe(true,);
      },
    },),
  ],
},);
