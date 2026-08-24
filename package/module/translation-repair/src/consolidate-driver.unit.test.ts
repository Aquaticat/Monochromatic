/**
 * Tests for the consolidation over one document.
 *
 * WHAT THESE PIN is the driver's own reasoning, which is the part no stage test
 * reaches: which slices it asks about at all, what it resumes rather than
 * rebuys, what it is willing to write to the cache, and what it refuses to
 * proceed past.
 *
 * ALMOST EVERY CASE HERE BUYS NOTHING. The client those hand over throws on any
 * call, which is the assertion: a driver that reached the roster on a resumed
 * slice, or on a slice the contest never settled, fails loudly instead of
 * quietly costing a run its budget. The rounds themselves are covered by
 * `consolidate-settle.unit.test.ts`.
 *
 * THE TWO SHEET CASES ARE THE EXCEPTION, and deliberately so. They let the calls
 * through to a client that records what it was sent and answers each with content
 * no sheet can parse, because what they ask is what the driver SENT rather than
 * what a roster would say back. Every voice is lost, which the validity floor
 * already handles, so the driver settles on the standing text having bought
 * nothing usable.
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
  type SliceNeighbourContext,
  type SyntheticClient,
  TRANSLATE_LINE_STRUCTURE_RULE,
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
 * Builds a client that records every request body and answers none of them.
 *
 * ANSWERS WITH UNREADABLE CONTENT rather than throwing, which matters more than
 * it looks. A thrown transport error is retried five times and then propagates
 * out of the driver, so a case built that way spends seconds failing on the
 * refusal instead of reading the sheet. A well-formed reply carrying content no
 * sheet can parse loses the voice instead, which is an outcome the validity floor
 * is already built for.
 *
 * @returns Client to drive with, beside the bodies it recorded
 *
 * @example
 * ```ts
 * const { client, bodies, } = recordingClient();
 * ```
 */
function recordingClient(): {
  readonly client: SyntheticClient;
  readonly bodies: readonly string[];
} {
  /**
   * Every request body the driver sent, in order.
   */
  const bodies: string[] = [];

  return {
    client: createSyntheticClient({
      apiKey: 'test-key',
      transport: async function recordThenSayNothingUsable(exchange,) {
        bodies.push(exchange.bodyJson ?? '',);
        return {
          status: 200,
          bodyText: `data: ${
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: { content: 'no sheet can read this', },
                },
              ],
            },)
          }\n\ndata: [DONE]\n\n`,
        };
      },
    },),
    bodies,
  };
}

/**
 * Marker the gate's own sheet carries and no other round does.
 *
 * READ OFF `consolidate-gate-wire.ts`. The gate and the slate judges share the
 * ballot schema, so the schema name alone cannot tell them apart and a case
 * reading `the judges' sheet` would otherwise be reading the gate's half the time.
 */
const GATE_MARKER = 'Return JSON: choice one of "consolidated", "standing"';

/**
 * Builds a client that records every request and answers each role usefully.
 *
 * WHY NOT {@link recordingClient}. That one answers content no sheet can parse,
 * so every voice is lost and the driver settles on the standing text having
 * bought nothing. That is exactly right for reading what a PRODUCER was sent,
 * since the producer round happens before anything can be lost, and useless for
 * reading a judge's sheet, because no judging round ever runs.
 *
 * @returns Client to drive with, beside the judge requests it recorded
 *
 * @example
 * ```ts
 * const { client, judgeSheets, } = answeringClient();
 * ```
 */
function answeringClient(): {
  readonly client: SyntheticClient;
  readonly judgeSheets: readonly string[];
} {
  /**
   * Requests the SLATE judges received, gate rounds excluded.
   */
  const judgeSheets: string[] = [];

  return {
    client: createSyntheticClient({
      apiKey: 'test-key',
      transport: async function answerByRole(exchange,) {
        /**
         * Everything this call is sending, which is where the sheet lives.
         */
        const sent = exchange.bodyJson ?? '';

        /**
         * Which of the three rounds this call is, decided once so the answer and
         * the recording cannot disagree about it.
         *
         * THE GATE IS CHECKED BEFORE THE BALLOT, because both ask for the same
         * schema and only the gate's own wording separates them.
         */
        const role = sent.includes('translation_report',)
          ? 'produce'
          : (sent.includes(GATE_MARKER,) ? 'gate' : 'judge');

        /**
         * Reply each round is given.
         */
        const answers: Record<string, string> = {
          produce: JSON.stringify({ translation: 'A cat asleep in the sun.', },),
          gate: JSON.stringify({
            choice: 'standing',
            unsupported: [],
            dropped: [],
            reason: 'the original supports it',
          },),
          judge: JSON.stringify({
            best: 1,
            reason: 'it says what the original says',
          },),
        };

        /**
         * Reply body for whichever role asked.
         */
        const answer = answers[role] ?? '';

        if (role === 'judge')
          judgeSheets.push(sent,);

        return {
          status: 200,
          bodyText: `data: ${
            JSON.stringify({
              choices: [
                {
                  index: 0,
                  delta: { content: answer, },
                },
              ],
            },)
          }\n\ndata: [DONE]\n\n`,
        };
      },
    },),
    judgeSheets,
  };
}

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
  const comparison = [0, 1,].map(function toRow(sliceIndex,) {
    return {
      sliceIndex,
      incumbentKind: 'present',
      incumbentText: `archive wording for slice ${String(sliceIndex,)}`,
      repairText: `repair wording for slice ${String(sliceIndex,)}`,
      translateText: `translate wording for slice ${String(sliceIndex,)}`,
    };
  },);

  return {
    comparison,
    delivery: {
      repair: comparison.map(function toDelivery(row,) {
        return {
          sliceIndex: row.sliceIndex,
          sourceText: `原文${String(row.sliceIndex,)}`,
        };
      },),
      translate: [],
    },
  } as unknown as ProjectedLanesV2;
}

/**
 * Builds one contest record, as the contest wrote it for the artifact.
 *
 * @param sliceIndex - slice this answers
 *
 * @param lane - lane the contest backed
 *
 * @returns Record shaped as the contest stage produces one
 *
 * @example
 * ```ts
 * const record = contestSettling({ sliceIndex: 0, lane: 'repair', },);
 * ```
 */
function contestSettling(
  {
    sliceIndex,
    lane,
  }: {
    readonly sliceIndex: number;
    readonly lane: 'repair' | 'translate';
  },
): ArtifactContestSliceV2 {
  return {
    sliceIndex,
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
    findings: [],
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
    client = REFUSING_CLIENT,
    lineStructuredSlices = new Set(),
    pictureContextBySlice = new Map(),
    neighbourContextBySlice = new Map(),
  }: {
    readonly contests: readonly ArtifactContestSliceV2[];
    readonly resumed?: ReadonlyMap<string, ConsolidationSettlement>;
    readonly projected?: ProjectedLanesV2;
    readonly client?: SyntheticClient;
    readonly lineStructuredSlices?: ReadonlySet<number>;
    readonly pictureContextBySlice?: ReadonlyMap<number, string>;
    readonly neighbourContextBySlice?: ReadonlyMap<number, SliceNeighbourContext>;
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
    client,
    projected,
    contests,
    modelIds: ROSTER,
    cache,
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS,),
    perCallTimeoutMs: CALL_TIMEOUT_MS,
    lineStructuredSlices,
    pictureContextBySlice,
    neighbourContextBySlice,
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
            contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
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
            contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
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
            contestSettling({ sliceIndex: 0, lane: 'repair', },),
            contestSettling({ sliceIndex: 1, lane: 'translate', },),
          ],
          resumed: everyKey as unknown as ReadonlyMap<string, ConsolidationSettlement>,
        },);

        expect(slices.length,).toBe(2,);
        expect(slices[0]?.sliceIndex,).toBe(0,);
        expect(slices[1]?.sliceIndex,).toBe(1,);
        expect(slices[0]?.terminal,).toBe('incumbent-only',);
        expect(slices[0]?.gate.kind,).toBe('not-asked',);
        expect(written.length,).toBe(0,);
      },
    },),

    it({
      name: 'SHOWS A GOVERNED SLICE\'S PRODUCERS THE RULE AGAINST MERGING LINES, which is the only '
        + 'reason this driver is handed the governed set at all. The subject field carrying the fact '
        + 'was born optional on 2026-08-21 and no caller ever set it, so until 2026-08-22 every '
        + 'consolidating producer was told its passage was prose, verse included',
      fn: async () => {
        const { client, bodies, } = recordingClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          lineStructuredSlices: new Set([0,],),
        },);

        expect(bodies.length,).toBeGreaterThan(0,);
        expect(bodies.some(function carriesRule(body,): boolean {
          return body.includes(TRANSLATE_LINE_STRUCTURE_RULE,);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES THE RULE OUT OF A SLICE IT DOES NOT GOVERN, which is what makes the case above '
        + 'evidence. A sheet carrying the rule unconditionally would satisfy that one just as well, '
        + 'and would mean the governed set was never read',
      fn: async () => {
        const { client, bodies, } = recordingClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          lineStructuredSlices: new Set(),
        },);

        expect(bodies.length,).toBeGreaterThan(0,);
        expect(bodies.some(function carriesRule(body,): boolean {
          return body.includes(TRANSLATE_LINE_STRUCTURE_RULE,);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'SHOWS A PRODUCER WHAT THE PICTURES NEAR ITS SLICE WERE READ TO SAY, which the sheet has '
        + 'rendered since it was written and no caller ever supplied. A passage whose meaning leans '
        + 'on an image was consolidated blind until 2026-08-22, while the translate lane that wrote '
        + 'one of the candidates had been shown the same reading all along',
      fn: async () => {
        const { client, bodies, } = recordingClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          pictureContextBySlice: new Map([[0, 'the photograph shows a tabby asleep on a stack of library books',],],),
        },);

        expect(bodies.length,).toBeGreaterThan(0,);
        expect(bodies.some(function carriesReading(body,): boolean {
          return body.includes('the photograph shows a tabby asleep on a stack of library books',);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES A SLICE THE MAP NEVER MENTIONS UNILLUSTRATED, which is what makes the case above '
        + 'evidence rather than a sheet that always carries a picture heading. It pins the lookup too, '
        + 'which is why the map here holds a reading for a slice this contest never settles: a driver '
        + 'reading a neighbouring slice\'s entry finds that reading and puts it on the sheet, and both '
        + 'picture cases fail together. `#99` is the record of why that is the defect worth pinning',
      fn: async () => {
        const { client, bodies, } = recordingClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          pictureContextBySlice: new Map([[1, 'the photograph shows a tabby asleep on a stack of library books',],],),
        },);

        expect(bodies.length,).toBeGreaterThan(0,);
        expect(bodies.some(function carriesReading(body,): boolean {
          return body.includes('the photograph shows a tabby asleep on a stack of library books',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'SHOWS THE SLATE JUDGES WHAT THE PICTURES NEAR THEIR SLICE SAY. `#176` gave the readings to '
        + 'this stage\'s PRODUCERS and stopped, so for one day the judges weighed proposals written '
        + 'against evidence they could not see, which is worse than both halves being blind: a producer '
        + 'that used a picture correctly looked to its judge like one inventing detail. Read off the '
        + 'judges\' own request, which is the only place the wiring is visible',
      fn: async () => {
        const { client, judgeSheets, } = answeringClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          pictureContextBySlice: new Map([[0, 'The photograph shows a tortoiseshell asleep in a sunlit doorway.',],],),
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(
          judgeSheets.every(function carriesReading(sheet,): boolean {
            return sheet.includes('tortoiseshell asleep in a sunlit doorway',);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'SHOWS THEM THE PASSAGES EITHER SIDE, which neither half of this stage has ever been given. '
        + 'The translate lane\'s judges have had the window since `#107`, and a consolidation judge '
        + 'without it cannot tell a passage the archive moved next door from one a candidate invented. '
        + 'Kept apart from the picture case above so a break in one is not read as a break in the other',
      fn: async () => {
        const { client, judgeSheets, } = answeringClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
          neighbourContextBySlice: new Map([[
            0,
            {
              sourceText: '她把窗户推开了一条缝。',
              incumbentText: 'She pushed the window open a crack.',
            },
          ],],),
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(
          judgeSheets.every(function carriesWindow(sheet,): boolean {
            return sheet.includes('她把窗户推开了一条缝',)
              && sheet.includes('She pushed the window open a crack',);
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'SHOWS THEM NEITHER WHEN THE DRIVER HOLDS NEITHER, which is the control the case above needs. '
        + 'A sheet that rendered these blocks unconditionally would satisfy that one just as well and would '
        + 'mean the two maps were never read, and a slice near no readable picture would be shown a '
        + 'heading promising readings it does not have',
      fn: async () => {
        const { client, judgeSheets, } = answeringClient();

        await driveWith({
          client,
          contests: [contestSettling({ sliceIndex: 0, lane: 'repair', },),],
        },);

        expect(judgeSheets.length,).toBeGreaterThan(0,);
        expect(
          judgeSheets.some(function carriesEvidence(sheet,): boolean {
            return sheet.includes('tortoiseshell',)
              || sheet.includes('她把窗户推开了一条缝',)
              || sheet.includes('She pushed the window open a crack',);
          },),
        ).toBe(false,);
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
    findings: [],
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
          settlement: settlementFor({ terminal: 'slate-declined-standing', decision: 'declined-indecision', },),
        },),).toBe(false,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-declined-standing', decision: 'declined-rejection', },),
        },),).toBe(false,);
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-endorsed-standing', decision: 'judged', },),
        },),).toBe(true,);

        // THE SETTLED DECLINE, which is why the decision read survived the
        // terminal split: it shares a terminal with the two above and gets
        // the opposite answer, so the name alone cannot decide this one.
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-declined-standing', decision: 'no-candidate-backed', },),
        },),).toBe(true,);
      },
    },),

    it({
      name: 'CACHES A SLATE NO JUDGE WAS ASKED ABOUT, which is the state the merged name hid '
        + 'worst. A slate carrying one candidate measures the PRODUCING half and says nothing '
        + 'about the roster, so counting it beside an endorsement of the archive reported a '
        + 'working panel where no panel spoke',
      fn: async () => {
        expect(consolidationWorthResuming({
          settlement: settlementFor({ terminal: 'slate-unjudged-standing', decision: 'sole-candidate', },),
        },),).toBe(true,);
      },
    },),
  ],
},);
