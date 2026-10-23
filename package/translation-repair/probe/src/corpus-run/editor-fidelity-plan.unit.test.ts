/**
 Tests for what the editor fidelity probe writes down and says: the per-card tally of how each trial read, and the
 lines that report it. Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  editorKeptLine,
  editorPreflightLine,
  type EditorFidelityRow,
  editorTallyLine,
  editorTallyOf,
} from '../../dist/final/node/index.mjs';
import {
  HIGH_CARD,
  LOW_CARD,
} from '../editor-fidelity.test-fixture.ts';

/**
 A row of the given reading, for the card.

 @param cardId - card the row belongs to

 @param reading - how the trial read

 @returns The row

 @example
 ```ts
 const row = rowOf({ cardId: LOW_CARD, reading: { kind: 'refused', findings: [], }, },);
 ```
 */
function rowOf(
  {
    cardId,
    reading,
  }: {
    readonly cardId: string;
    readonly reading: EditorFidelityRow['reading'];
  },
): EditorFidelityRow {
  return {
    cardId,
    trialId: 'tabby-reference/insertion',
    referenceId: 'tabby-reference',
    entryId: 'tabby',
    damageKind: 'insertion',
    changedChars: 12,
    damageDetail: 'inserted a borrowed sentence of 12 characters',
    reading,
  } as EditorFidelityRow;
}

/**
 Every way a trial can read, once, for one card, and one more row for another card.
 */
const ROWS: readonly EditorFidelityRow[] = [
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'answered',
      score: {
        fixed: 'exact',
        collateral: false,
      },
      applied: 1,
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'answered',
      score: {
        fixed: 'equivalent',
        collateral: false,
      },
      applied: 1,
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'answered',
      score: {
        fixed: 'defect-only',
        collateral: true,
      },
      applied: 1,
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'answered',
      score: {
        fixed: 'none',
        collateral: true,
      },
      applied: 1,
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'answered',
      score: {
        fixed: 'none',
        collateral: false,
      },
      applied: 1,
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'refused',
      findings: [],
    },
  },),
  rowOf({
    cardId: LOW_CARD,
    reading: {
      kind: 'unusable',
      cause: 'no-reply',
      rejected: 0,
      findings: [],
    },
  },),
  rowOf({
    cardId: HIGH_CARD,
    reading: {
      kind: 'refused',
      findings: [],
    },
  },),
];

await describe({
  name: '',
  children: [
    describe({
      name: editorTallyOf.name,
      children: [
        it({
          name: 'COUNTS EACH WAY A TRIAL READS APART, for the card alone: fixed with its three kinds, collateral on any '
            + 'answered trial, missed, refused and unusable, out of the card\'s trials, and the parts add up to the whole',
          fn: async () => {
            expect(editorTallyOf({
              cardId: LOW_CARD,
              rows: ROWS,
            },),).toStrictEqual({
              cardId: LOW_CARD,
              trials: 7,
              fixed: 3,
              exact: 1,
              equivalent: 1,
              defectOnly: 1,
              collateral: 2,
              missed: 2,
              refused: 1,
              unusable: 1,
            },);
            expect(editorTallyOf({
              cardId: HIGH_CARD,
              rows: ROWS,
            },),).toStrictEqual({
              cardId: HIGH_CARD,
              trials: 1,
              fixed: 0,
              exact: 0,
              equivalent: 0,
              defectOnly: 0,
              collateral: 0,
              missed: 0,
              refused: 1,
              unusable: 0,
            },);
          },
        },),

        it({
          name: 'COUNTS A CARD WITH NO ROWS as zero trials rather than failing',
          fn: async () => {
            expect(editorTallyOf({
              cardId: 'claude-haiku-5-5',
              rows: ROWS,
            },).trials,).toBe(0,);
          },
        },),
      ],
    },),

    describe({
      name: editorTallyLine.name,
      children: [
        it({
          name: 'SAYS EVERY COUNT and what it is out of, in one line a log search finds',
          fn: async () => {
            expect(editorTallyLine({
              tally: editorTallyOf({
                cardId: LOW_CARD,
                rows: ROWS,
              },),
            },),).toBe(
              `EDITOR ${LOW_CARD}: fixed 3 of 7 (exact 1, equivalent 1, defect only 1), collateral 2, missed 2, refused 1, `
                + 'unusable 1',
            );
          },
        },),
      ],
    },),

    describe({
      name: editorPreflightLine.name,
      children: [
        it({
          name: 'SAYS WHAT A CAP OF ZERO BOUGHT: cards named and the references selected, and that nothing was read or '
            + 'asked',
          fn: async () => {
            expect(editorPreflightLine({
              cardIds: [LOW_CARD,],
              selected: 3,
            },),).toBe(
              `preflight only: 3 pinned reference specifications selected for ${LOW_CARD}; no corpus or model calls`,
            );
            expect(editorPreflightLine({
              cardIds: [LOW_CARD, HIGH_CARD,],
              selected: 1,
            },),).toBe(
              `preflight only: 1 pinned reference specification selected for ${LOW_CARD}, ${HIGH_CARD}; no corpus or `
                + 'model calls',
            );
          },
        },),
      ],
    },),

    describe({
      name: editorKeptLine.name,
      children: [
        it({
          name: 'SAYS HOW MANY ROWS WERE KEPT AND WHERE',
          fn: async () => {
            expect(editorKeptLine({
              count: 1,
              keptAt: '/runs/x.json',
            },),).toBe('kept 1 editor row at /runs/x.json',);
            expect(editorKeptLine({
              count: 4,
              keptAt: '/runs/x.json',
            },),).toBe('kept 4 editor rows at /runs/x.json',);
          },
        },),
      ],
    },),
  ],
},);
