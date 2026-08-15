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
): readonly {
  readonly chunkIndex: number;
  readonly incumbentText: string;
  readonly acceptedText?: string;
}[] {
  return INCUMBENTS.map(function toWording(
    incumbentText,
    chunkIndex,
  ) {
    /**
     * What this case says the lane decided here.
     */
    const accepted = decided.get(chunkIndex,);
    return {
      chunkIndex,
      incumbentText,
      ...(accepted === undefined ? {} : { acceptedText: accepted, }),
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

await describe({
  name: buildSliceDelivery.name,
  children: [
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
          return record.shipment
            .kind;
        },),).toEqual([
          'replacement-shipped',
          'replacement-withdrawn',
          'incumbent-shipped',
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
        expect(ledger[1]?.shipment,).toEqual({
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
        expect(ledger.map(function toShipment(record,): string {
          return record.shipment
            .kind;
        },),).toEqual([
          'incumbent-shipped',
          'not-evaluated',
          'not-evaluated',
        ],);
        expect(Object.hasOwn(
          ledger[1] ?? {},
          'acceptedText',
        ),).toBe(false,);
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
        expect(ledger[0]?.shipment,).toEqual({
          kind: 'replacement-withdrawn',
          reason: 'blocked-non-translation',
        },);
        expect(ledger[0]?.shippedText,).toBe(INCUMBENTS[0],);
        expect(ledger[0]?.acceptedText,).toBe('The cat is asleep.',);
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
        },).toThrow('of 3 prepared',);

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
  ],
},);
