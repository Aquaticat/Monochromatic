/**
 * Tests for reading damage regions out of a version 2 delivery ledger.
 *
 * The case that matters is WHICH ROWS COUNT. The version 1 draw read a
 * repair-lane issue list, and carrying that habit forward would have produced a
 * draw covering less than half the regions where this pipeline replaced text,
 * while describing itself as a draw over the shipped regions. Measured over the
 * six settled entries the split is 32 repair against 37 translate, so the error
 * would not have been small and nothing in the output would have shown it.
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

import {
  regionIdOf,
  regionsOfLane,
} from '../../dist/final/node/index.mjs';

/**
 * Builds one delivery row.
 *
 * @param chunkIndex - slice index
 *
 * @param kind - what the lane did with the slice
 *
 * @param incumbentKind - whether the archive had wording there at all
 *
 * @returns Row shaped as the ledger carries it
 *
 * @example
 * ```ts
 * const row = rowOf({ chunkIndex: 0, kind: 'replacement-shipped', },);
 * ```
 */
function rowOf(
  {
    chunkIndex,
    kind,
    incumbentKind = 'present',
  }: {
    readonly chunkIndex: number;
    readonly kind: 'replacement-shipped' | 'replacement-withdrawn' | 'incumbent-retained';
    readonly incumbentKind?: 'present' | 'absent';
  },
): Parameters<typeof regionsOfLane>[0]['rows'][number] {
  /**
   * Delivery, whose withdrawn form carries a reason the others do not.
   */
  const delivery = (kind === 'replacement-withdrawn')
    ? {
      kind,
      reason: 'assembly-integrity' as const,
    }
    : { kind, };

  return {
    chunkIndex,
    sourceText: `窗台上有第${String(chunkIndex,)}只猫。`,
    incumbentKind,
    incumbentText: (incumbentKind === 'present')
      ? `Cat ${String(chunkIndex,)} sits on the sill.`
      : '',
    outcome: { kind: 'decided', },
    shippedText: `Cat ${String(chunkIndex,)} is perched on the windowsill.`,
    delivery,
  } as Parameters<typeof regionsOfLane>[0]['rows'][number];
}

await describe({
  name: regionsOfLane.name,
  children: [
    it({
      name: 'KEEPS ONLY THE ROWS THAT SHIPPED A REPLACEMENT, since a withdrawn one put nothing in '
        + 'the document and a retained one left the archive wording alone: asking whether either '
        + 'damaged the text asks about an edit that never happened',
      fn: async () => {
        /**
         * One of each disposition.
         */
        const census = regionsOfLane({
          entryId: 'Tabby',
          lane: 'repair',
          rows: [
            rowOf({
              chunkIndex: 0,
              kind: 'replacement-shipped',
            },),
            rowOf({
              chunkIndex: 1,
              kind: 'replacement-withdrawn',
            },),
            rowOf({
              chunkIndex: 2,
              kind: 'incumbent-retained',
            },),
          ],
        },);

        expect(census.regions.length,).toBe(1,);
        expect(census.regions[0]?.chunkIndex,).toBe(0,);
        expect(census.filledWithoutIncumbent,).toBe(0,);
      },
    },),

    it({
      name: 'SETS ASIDE a slice filled where the archive had no wording, and COUNTS it rather than '
        + 'dropping it: nothing was replaced so no edit could have damaged anything, and a silent '
        + 'drop would make the pool look smaller than the run without saying why',
      fn: async () => {
        const census = regionsOfLane({
          entryId: 'Tabby',
          lane: 'translate',
          rows: [
            rowOf({
              chunkIndex: 0,
              kind: 'replacement-shipped',
            },),
            rowOf({
              chunkIndex: 1,
              kind: 'replacement-shipped',
              incumbentKind: 'absent',
            },),
          ],
        },);

        expect(census.regions.length,).toBe(1,);
        expect(census.filledWithoutIncumbent,).toBe(1,);
      },
    },),

    it({
      name: 'CARRIES THE LANE ON EVERY REGION, which is what lets the two be separated afterwards: '
        + 'they answer different questions, and a pooled rate with no label cannot be split back '
        + 'apart once it is written down',
      fn: async () => {
        /**
         * The same slice index, shipped by both lanes, which happens.
         */
        const repair = regionsOfLane({
          entryId: 'Tabby',
          lane: 'repair',
          rows: [rowOf({
            chunkIndex: 3,
            kind: 'replacement-shipped',
          },),],
        },);
        const translate = regionsOfLane({
          entryId: 'Tabby',
          lane: 'translate',
          rows: [rowOf({
            chunkIndex: 3,
            kind: 'replacement-shipped',
          },),],
        },);

        expect(repair.regions[0]?.lane,).toBe('repair',);
        expect(translate.regions[0]?.lane,).toBe('translate',);

        // Distinct identities, so one slice shipped by both lanes is two
        // regions rather than one overwriting the other in a keyed collection.
        expect(repair.regions[0]?.regionId,).not.toBe(translate.regions[0]?.regionId,);
      },
    },),

    it({
      name: 'TAKES THE TEXTS FROM THE ROW rather than from anywhere else, so the sheet asks about '
        + 'the wording the judges actually saw',
      fn: async () => {
        const census = regionsOfLane({
          entryId: 'Tabby',
          lane: 'repair',
          rows: [rowOf({
            chunkIndex: 5,
            kind: 'replacement-shipped',
          },),],
        },);

        /**
         * Region built from the row.
         */
        const [region,] = census.regions;
        expect(region?.entryId,).toBe('Tabby',);
        expect(region?.sourceText,).toBe('窗台上有第5只猫。',);
        expect(region?.incumbentText,).toBe('Cat 5 sits on the sill.',);
        expect(region?.shippedText,).toBe('Cat 5 is perched on the windowsill.',);
      },
    },),

    it({
      name: 'REPORTS AN EMPTY LEDGER as no regions rather than failing, since a lane that shipped '
        + 'nothing is an ordinary outcome',
      fn: async () => {
        const census = regionsOfLane({
          entryId: 'Tabby',
          lane: 'repair',
          rows: [],
        },);
        expect(census.regions.length,).toBe(0,);
        expect(census.filledWithoutIncumbent,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: regionIdOf.name,
  children: [
    it({
      name: 'NAMES A REGION BY LANE AND INDEX, which is what version 2 addresses a slice by: the '
        + 'envelope ids version 1 used do not exist here, and an index alone would collide '
        + 'whenever both lanes shipped the same slice',
      fn: async () => {
        expect(regionIdOf({
          lane: 'repair',
          chunkIndex: 0,
        },),).toBe('repair#0',);
        expect(regionIdOf({
          lane: 'translate',
          chunkIndex: 12,
        },),).toBe('translate#12',);
        expect(regionIdOf({
          lane: 'repair',
          chunkIndex: 12,
        },),).not.toBe(regionIdOf({
          lane: 'translate',
          chunkIndex: 12,
        },),);
      },
    },),
  ],
},);
