/**
 * Tests for the per-slice delivery ledger.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildSliceDelivery,
  type ChunkPair,
  type LaneSliceText,
  makeInsertionChunk,
  SliceDeliveryError,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of each fixture slice, in document order.
 */
const INCUMBENTS = [
  'The cat sleeps.',
  'The cat eats.',
  'The cat watches the birds.',
] as const;

/**
 * Original wording of each fixture slice.
 */
const SOURCES = [
  '猫猫在睡觉。',
  '猫猫在吃饭。',
  '猫猫在看鸟。',
] as const;

/**
 * Prepared slice pairs shaped as the preparation produces them.
 */
function preparedSlices(): readonly {
  readonly source: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
  readonly target: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
}[] {
  return INCUMBENTS.map(function toSlice(
    incumbentText,
    chunkIndex,
  ) {
    /**
     * Original of this slice, present for every fixture index.
     */
    const sourceText = SOURCES[chunkIndex] ?? '';
    return {
      source: {
        chunkIndex,
        nodes: [],
        startOffset: 0,
        endOffset: sourceText.length,
        text: sourceText,
      },
      target: {
        chunkIndex,
        nodes: [],
        startOffset: 0,
        endOffset: incumbentText.length,
        text: incumbentText,
      },
    };
  },);
}

/**
 * Lane wordings for the fixture slices, with the decisions a case needs.
 *
 * @param decided - accepted wording keyed by slice index; a slice absent from
 * the map is one the lane never reached
 *
 * @returns Wordings in document order
 *
 * @example
 * ```ts
 * const wordings = laneWordings({ decided: new Map([[0, 'The cat naps.',],],), },);
 * ```
 */
function laneWordings(
  { decided, }: { readonly decided: ReadonlyMap<number, string>; },
): readonly LaneSliceText[] {
  return INCUMBENTS.map(function toWording(
    incumbentText,
    chunkIndex,
  ): LaneSliceText {
    /**
     * What this case says the lane decided here.
     */
    const accepted = decided.get(chunkIndex,);
    return {
      chunkIndex,
      incumbentKind: 'present',
      incumbentText,
      outcome: (accepted === undefined)
        ? { kind: 'not-evaluated', }
        : {
          kind: 'decided',
          acceptedText: accepted,
        },
    };
  },);
}

/**
 * Wordings where every slice was examined and left exactly as it was.
 *
 * @returns Map from slice index to the archive's own wording
 *
 * @example
 * ```ts
 * const wordings = laneWordings({ decided: everySliceUnchanged(), },);
 * ```
 */
function everySliceUnchanged(): ReadonlyMap<number, string> {
  return new Map(INCUMBENTS.map(function toEntry(
    incumbentText,
    chunkIndex,
  ): readonly [number, string,] {
    return [
      chunkIndex,
      incumbentText,
    ];
  },),);
}

/**
 * Fixture slices whose middle one is a place rather than existing text.
 *
 * @returns Prepared pairs with an anchor at index one
 *
 * @example
 * ```ts
 * const slices = anchoredSlices();
 * ```
 */
function anchoredSlices(): readonly ChunkPair[] {
  return preparedSlices().map(function toAnchored(
    slice,
    chunkIndex,
  ): ChunkPair {
    return (chunkIndex === 1)
      ? {
        source: slice.source,
        target: makeInsertionChunk({
          chunkIndex,
          offset: 0,
        },),
      }
      : slice;
  },);
}

/**
 * Lane wordings for {@link anchoredSlices}, whose anchor holds no archive
 * wording to agree with.
 *
 * @param anchorDecided - whether the lane decided anything for the anchor
 *
 * @returns Wordings in document order
 *
 * @example
 * ```ts
 * const wordings = anchoredWordings({ anchorDecided: false, },);
 * ```
 */
function anchoredWordings(
  { anchorDecided, }: { readonly anchorDecided: boolean; },
): readonly LaneSliceText[] {
  return [
    {
      chunkIndex: 0,
      incumbentKind: 'present',
      incumbentText: INCUMBENTS[0],
      outcome: {
        kind: 'decided',
        acceptedText: INCUMBENTS[0],
      },
    },
    {
      chunkIndex: 1,
      incumbentKind: 'absent',
      incumbentText: '',
      // Deciding the blank is what a lane does when it agrees with an
      // incumbent, and at an anchor the incumbent is nothing at all; the
      // alternative is the lane reporting it reached the slice and could not
      // fill it.
      outcome: anchorDecided
        ? {
          kind: 'decided',
          acceptedText: '',
        }
        : { kind: 'unfilled', },
    },
    {
      chunkIndex: 2,
      incumbentKind: 'present',
      incumbentText: INCUMBENTS[2],
      outcome: {
        kind: 'decided',
        acceptedText: INCUMBENTS[2],
      },
    },
  ];
}

await describe({
  name: buildSliceDelivery.name,
  children: [
    it({
      name: 'reads a slice the archive never translated as UNFILLED rather than as the archive standing '
        + 'or as unexamined. Both neighbours read falsely there: one says the document carries the '
        + 'archive`s own wording, of which there is none, and the other says nobody looked',
      fn: async () => {
        /** Ledger over an anchor the lane reached and could not fill. */
        const undecided = buildSliceDelivery({
          slices: anchoredSlices(),
          wordings: anchoredWordings({ anchorDecided: false, },),
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          blocked: false,
        },);
        expect(undecided[1]?.delivery
          .kind,).toBe('gap-remains',);

        /** Same anchor, with the lane agreeing with the blank it found. */
        const agreed = buildSliceDelivery({
          slices: anchoredSlices(),
          wordings: anchoredWordings({ anchorDecided: true, },),
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          blocked: false,
        },);
        expect(agreed[1]?.delivery
          .kind,).toBe('gap-remains',);
        // Every content slice still reads exactly as it did: this changes what
        // an ANCHOR means and nothing else.
        expect(agreed[0]?.delivery
          .kind,).toBe('incumbent-retained',);
        expect(agreed[2]?.delivery
          .kind,).toBe('incumbent-retained',);
      },
    },),
    it({
      name: 'names every fate a slice can meet in one pass: a shipped replacement, one the assembly '
        + 'guard took back, a slice the lane examined and left alone, and the source beside each, which '
        + 'is the field a grader cannot recover from an artifact at all',
      fn: async () => {
        /** Ledger over one shipped slice, one withdrawn, one left alone. */
        const ledger = buildSliceDelivery({
          slices: preparedSlices(),
          wordings: laneWordings({
            decided: new Map([
              [0, 'The cat is asleep.',],
              [1, 'The cat is eating.',],
              [2, INCUMBENTS[2],],
            ],),
          },),
          shippedChunkIndices: [0,],
          withdrawnChunkIndices: [1,],
          blocked: false,
        },);
        expect(ledger.map(function toShipment(record,): string {
          return record.delivery
            .kind;
        },),).toEqual([
          'replacement-shipped',
          'replacement-withdrawn',
          'incumbent-retained',
        ],);
        expect(ledger.map(function toShipped(record,): string {
          return record.shippedText;
        },),).toEqual([
          'The cat is asleep.',
          INCUMBENTS[1],
          INCUMBENTS[2],
        ],);
        expect(ledger.map(function toSource(record,): string {
          return record.sourceText;
        },),).toEqual([...SOURCES,],);
        expect(ledger[1]?.delivery,).toEqual({
          kind: 'replacement-withdrawn',
          reason: 'assembly-integrity',
        },);
      },
    },),
    it({
      name: 'records a slice the lane never reached as NOT EVALUATED rather than as one it left alone. '
        + 'Both carry the archive wording, and only one of them means anybody looked: the repair lane '
        + 'stops at the earliest dominance crossing, so the slices after it were never examined',
      fn: async () => {
        /** Ledger over a lane that stopped after its first slice. */
        const ledger = buildSliceDelivery({
          slices: preparedSlices(),
          wordings: laneWordings({
            decided: new Map([[0, INCUMBENTS[0],],],),
          },),
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          blocked: true,
        },);
        // WHAT THE LANE DID, which is the axis that separates these slices.
        expect(ledger.map(function toOutcome(record,): string {
          return record.outcome
            .kind;
        },),).toEqual([
          'decided',
          'not-evaluated',
          'not-evaluated',
        ],);
        // And what the DOCUMENT carries, which is the same for all three: the
        // archive's own wording, whether anyone looked at it or not. One word
        // could not hold both of these, which is why there are two.
        expect(ledger.map(function toDelivery(record,): string {
          return record.delivery
            .kind;
        },),).toEqual([
          'incumbent-retained',
          'incumbent-retained',
          'incumbent-retained',
        ],);
      },
    },),
    it({
      name: 'calls a decided slice on a BLOCKED run withdrawn, naming the block rather than the assembly '
        + 'guard. That exit never reaches assembly: it returns the archive whatever any slice decided, '
        + 'so the two withdrawals are different events and a reader counting integrity damage would '
        + 'otherwise count a refusal as one',
      fn: async () => {
        /** Ledger over a blocked run whose first slice had decided a repair. */
        const ledger = buildSliceDelivery({
          slices: preparedSlices(),
          wordings: laneWordings({
            decided: new Map([[0, 'The cat is asleep.',],],),
          },),
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          blocked: true,
        },);
        expect(ledger[0]?.delivery,).toEqual({
          kind: 'replacement-withdrawn',
          reason: 'blocked-non-translation',
        },);
        expect(ledger[0]?.shippedText,).toBe(INCUMBENTS[0],);
        expect(ledger[0]?.outcome,).toEqual({
          kind: 'decided',
          acceptedText: 'The cat is asleep.',
        },);
      },
    },),
    it({
      name: 'REFUSES a decided slice that an unblocked run names as neither shipped nor withdrawn, which '
        + 'is the state where nothing says what the document carries there',
      fn: async () => {
        expect(function unstatedSlice() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([
                [0, 'The cat is asleep.',],
                [1, INCUMBENTS[1],],
                [2, INCUMBENTS[2],],
              ],),
            },),
            shippedChunkIndices: [],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('is unstated',);
      },
    },),
    it({
      name: 'REFUSES a shipped slice whose decision is the archive wording, and a slice named as shipped '
        + 'that the lane never reached: each says the document carries a change nobody made',
      fn: async () => {
        expect(function shippedWithoutChange() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({ decided: everySliceUnchanged(), },),
            shippedChunkIndices: [0,],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('a change nobody made',);
        expect(function shippedWithoutDecision() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([
                [1, INCUMBENTS[1],],
                [2, INCUMBENTS[2],],
              ],),
            },),
            shippedChunkIndices: [0,],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('both did and did not reach it',);
      },
    },),
    it({
      name: 'REFUSES reports built from a different preparation: a short wording list, an index outside '
        + 'the prepared slices, and archive wording the two sides disagree about. Each would join one '
        + 'lane`s slice against another`s while the two name different passages',
      fn: async () => {
        expect(function shortWordings() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({ decided: everySliceUnchanged(), },)
              .slice(
                0,
                2,
              ),
            shippedChunkIndices: [],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('different preparations',);
        expect(function outOfRangeIndex() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({ decided: everySliceUnchanged(), },),
            shippedChunkIndices: [7,],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('this preparation of 3 slices never produced',);

        /** Wordings whose archive text was taken from another document. */
        const drifted = laneWordings({ decided: everySliceUnchanged(), },)
          .map(function toDrifted(
            wording,
            position,
          ) {
            return (position === 1)
              ? {
                ...wording,
                incumbentText: 'The cat dines.',
                acceptedText: 'The cat dines.',
              }
              : wording;
          },);
        expect(function driftedIncumbent() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: drifted,
            shippedChunkIndices: [],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow(SliceDeliveryError,);
      },
    },),

    it({
      name: 'REFUSES an index set that names one slice twice, which building a '
        + 'set out of it silently forgave: a lane counting one change as two '
        + 'has two derivations disagreeing about its own document, and neither '
        + 'the count nor the ledger showed it',
      fn: async () => {
        expect(function shippedTwice() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([[
                0,
                'The cat naps.',
              ],],),
            },),
            shippedChunkIndices: [
              0,
              0,
            ],
            withdrawnChunkIndices: [],
            blocked: false,
          },);
        },).toThrow('counts at least one slice twice',);
        expect(function withdrawnTwice() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([[
                1,
                'The cat dines.',
              ],],),
            },),
            shippedChunkIndices: [],
            withdrawnChunkIndices: [
              1,
              1,
            ],
            blocked: false,
          },);
        },).toThrow('counts at least one slice twice',);
      },
    },),

    it({
      name: 'REFUSES a slice named as both shipped and withdrawn rather than '
        + 'letting the branch order answer it, which reported a change assembly '
        + 'had taken back as one the document carries',
      fn: async () => {
        expect(function shippedAndWithdrawn() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([[
                2,
                'The cat studies the birds.',
              ],],),
            },),
            shippedChunkIndices: [2,],
            withdrawnChunkIndices: [2,],
            blocked: false,
          },);
        },).toThrow('both shipped and withdrawn',);
      },
    },),

    it({
      name: 'REFUSES a withdrawal of a slice the lane left at the archive '
        + 'wording, since assembly cannot take back a replacement nobody wrote '
        + 'and the row would read as a lane overruled rather than one that left '
        + 'the slice alone',
      fn: async () => {
        expect(function withdrewNothing() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({ decided: everySliceUnchanged(), },),
            shippedChunkIndices: [],
            withdrawnChunkIndices: [1,],
            blocked: false,
          },);
        },).toThrow('no replacement for assembly to take back',);
      },
    },),

    it({
      name: 'REFUSES a shipped slice on a BLOCKED run, because that exit returns the archive document '
        + 'whatever any slice decided: a shipped index there names a replacement no reader can have '
        + 'seen, and the ledger would report the run delivering work it explicitly refused to deliver',
      fn: async () => {
        expect(function shippedWhileBlocked() {
          buildSliceDelivery({
            slices: preparedSlices(),
            wordings: laneWordings({
              decided: new Map([[0, 'The cat is asleep.',],],),
            },),
            shippedChunkIndices: [0,],
            withdrawnChunkIndices: [],
            blocked: true,
          },);
        },).toThrow('shipped by a blocked run',);
      },
    },),
  ],
},);
