/**
 * Tests for the slice-by-slice comparison of the two lanes.
 *
 * The comparison exists to answer one question, whether repair and translate
 * produce the same English where both touch a slice, and it has one hard
 * requirement: it must read what each DOCUMENT carries rather than what each
 * lane chose. A slice whose replacement the assembly guard withdrew chose one
 * thing and shipped another, and a comparison that read the choice would report
 * a rewrite no reader ever saw.
 *
 * Fixtures are invented. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  compareDocumentLanes,
  LaneComparisonError,
  type LaneSliceText,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the one slice most cases here use.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Builds one lane's side of a comparison over a single slice.
 *
 * @param acceptedText - wording that lane decided on
 *
 * @param shipped - whether the returned document carries it
 *
 * @returns Lane side shaped as a lane result carries it
 *
 * @example
 * ```ts
 * const lane = laneOf({ acceptedText: 'The cat naps.', shipped: true, },);
 * ```
 */
function laneOf(
  {
    acceptedText,
    shipped,
  }: {
    readonly acceptedText: string;
    readonly shipped: boolean;
  },
): {
  readonly sliceTexts: readonly LaneSliceText[];
  readonly shippedChunkIndices: readonly number[];
} {
  return {
    sliceTexts: [{
      chunkIndex: 0,
      incumbentKind: 'present',
      incumbentText: ARCHIVE_NAP,
      outcome: {
        kind: 'decided',
        acceptedText,
      },
    },],
    shippedChunkIndices: shipped ? [0,] : [],
  };
}

await describe({
  name: compareDocumentLanes.name,
  children: [
    it({
      name:
        'names the four ways two documents can differ on a slice: neither moved, one moved, '
        + 'both moved to the same wording, and both moved apart, which is the only one a human has to read',
      fn: async () => {
        /**
         * Both lanes left the archive wording standing.
         */
        const kept = compareDocumentLanes({
          repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(kept[0]?.verdict,).toBe('archive-stands',);

        /**
         * Only repair changed the slice.
         */
        const repairOnly = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(repairOnly[0]?.verdict,).toBe('repair-only',);

        /**
         * Only translate changed it.
         */
        const translateOnly = compareDocumentLanes({
          repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(translateOnly[0]?.verdict,).toBe('translate-only',);

        /**
         * Both changed it the same way, character for character.
         */
        const agreed = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(agreed[0]?.verdict,).toBe('both-agree',);

        /**
         * Both changed it, differently.
         */
        const apart = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(apart[0]?.verdict,).toBe('both-differ',);
        expect(apart[0]?.repairText,).toBe('The cat is asleep on the windowsill.',);
        expect(apart[0]?.translateText,).toBe('A cat dozes in the window.',);
      },
    },),
    it({
      name:
        'reads what the DOCUMENT carries rather than what the lane chose: a slice whose replacement '
        + 'the assembly guard withdrew compares as the archive wording, even though its record names a rewrite, '
        + 'because reporting the rewrite would credit a lane with English no reader ever saw',
      fn: async () => {
        /**
         * Repair chose a rewrite the guard took back; translate shipped one.
         */
        const rows = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: false, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(rows[0]?.verdict,).toBe('translate-only',);

        // The withdrawn wording is nowhere in the row: what repair CARRIES is
        // the archive text, and that is the only repair-side text a comparison
        // may state.
        expect(rows[0]?.repairText,).toBe(ARCHIVE_NAP,);
      },
    },),
    it({
      name:
        'REFUSES two results whose slice counts differ, since a shorter list means the lanes ran over '
        + 'different preparations and every row after the first gap compares two different passages',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
    it({
      name:
        'REFUSES two results that disagree about a slice`s archive wording, which is the same defect '
        + 'arriving with matching counts and is otherwise undetectable downstream',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'present',
                incumbentText: 'A different archive sentence entirely.',
                outcome: {
                  kind: 'decided',
                  acceptedText: 'A cat dozes in the window.',
                },
              },],
              shippedChunkIndices: [0,],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
    it({
      name:
        'separates a lane that LOOKED and kept the archive wording from one that never reached the slice, '
        + 'which the repair lane`s whole-document block produces: both documents carry the archive text either way, '
        + 'and only one of them means anybody examined it',
      fn: async () => {
        /**
         * Repair stopped before this slice; translate looked and kept it.
         */
        const rows = compareDocumentLanes({
          repair: {
            // `not-evaluated`, which is how a lane says it never reached the
            // slice: a decision carrying the archive wording would say it
            // looked and kept it, and one carrying an empty string would say it
            // chose to delete the passage.
            sliceTexts: [{
              chunkIndex: 0,
              incumbentKind: 'present',
              incumbentText: ARCHIVE_NAP,
              outcome: { kind: 'not-evaluated', },
            },],
            shippedChunkIndices: [],
          },
          translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
        },);
        expect(rows[0]?.verdict,).toBe('archive-stands',);
        expect(rows[0]?.repairOutcome
          .kind,).toBe('not-evaluated',);
        expect(rows[0]?.translateOutcome
          .kind,).toBe('decided',);
        expect(rows[0]?.repairText,).toBe(ARCHIVE_NAP,);
        // The two lanes did different things here, so their DECISIONS are not
        // comparable however alike the two documents read.
        expect(rows[0]?.decisionComparison
          .kind,).toBe('not-comparable',);
      },
    },),
    it({
      name:
        'REFUSES a shipped index naming a slice the lane reports no wording for. That set and those '
        + 'rows are the two halves of one claim, and an index matching no row used to be accepted '
        + 'and then quietly match nothing, so every row below it was wrong one row at a time',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'present',
                incumbentText: ARCHIVE_NAP,
                outcome: {
                  kind: 'decided',
                  acceptedText: 'The cat is asleep on the windowsill.',
                },
              },],
              shippedChunkIndices: [4,],
            },
            translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
        expect(String(caught,),).toContain('reports no wording for it',);
      },
    },),
    it({
      name:
        'REFUSES a shipped index whose own row carries the archive`s wording, which is the same '
        + 'contradiction the assembly checks refuse one layer up and would read here as a rewrite '
        + 'nobody made',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: true, },),
            translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
        expect(String(caught,),).toContain('archive',);
      },
    },),
    it({
      name:
        'REFUSES a lane whose rows REPEAT a slice, on either side. Equal lengths are not equal '
        + 'coverage: repair rows for slices 0 and 0 against translate rows for 0 and 1 both count '
        + 'two, and the join then emits two rows for slice 0 and drops slice 1 without a word',
      fn: async () => {
        /**
         * Failure the comparison raised for a repeated repair row.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: {
              sliceTexts: [
                {
                  chunkIndex: 0,
                  incumbentKind: 'present',
                  incumbentText: ARCHIVE_NAP,
                  outcome: {
                    kind: 'decided',
                    acceptedText: ARCHIVE_NAP,
                  },
                },
                {
                  chunkIndex: 0,
                  incumbentKind: 'present',
                  incumbentText: ARCHIVE_NAP,
                  outcome: {
                    kind: 'decided',
                    acceptedText: ARCHIVE_NAP,
                  },
                },
              ],
              shippedChunkIndices: [],
            },
            translate: {
              sliceTexts: [
                {
                  chunkIndex: 0,
                  incumbentKind: 'present',
                  incumbentText: ARCHIVE_NAP,
                  outcome: {
                    kind: 'decided',
                    acceptedText: ARCHIVE_NAP,
                  },
                },
                {
                  chunkIndex: 1,
                  incumbentKind: 'present',
                  incumbentText: 'The sill is warm.',
                  outcome: {
                    kind: 'decided',
                    acceptedText: 'The sill is warm.',
                  },
                },
              ],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
        expect(String(caught,),).toContain('distinct slices',);
      },
    },),
    it({
      name:
        'REFUSES a shipped index REPEATED within one lane, rather than folding it into a set: '
        + 'the repeat is the lane saying something twice about one slice, and every rate built '
        + 'on that list counts it twice',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'present',
                incumbentText: ARCHIVE_NAP,
                outcome: {
                  kind: 'decided',
                  acceptedText: 'The cat is asleep on the windowsill.',
                },
              },],
              shippedChunkIndices: [
                0,
                0,
              ],
            },
            translate: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
        expect(String(caught,),).toContain('more than once',);
      },
    },),
    it({
      name: 'REFUSES a slice the other lane does not report at all, even when both lists are the same length',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: laneOf({ acceptedText: ARCHIVE_NAP, shipped: false, },),
            translate: {
              sliceTexts: [{
                chunkIndex: 4,
                incumbentKind: 'present',
                incumbentText: ARCHIVE_NAP,
                outcome: {
                  kind: 'decided',
                  acceptedText: ARCHIVE_NAP,
                },
              },],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
      },
    },),
    it({
      name:
        'reports a passage NEITHER lane filled as a gap that still remains rather than as the archive '
        + 'standing, since the archive has never translated it: the older verdict told a grader a '
        + 'translation was being kept where none has ever existed',
      fn: async () => {
        /**
         * One lane's side of an anchor both lanes reached and neither filled.
         */
        const unfilledAnchor = {
          sliceTexts: [{
            chunkIndex: 0,
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: { kind: 'unfilled', },
          },],
          shippedChunkIndices: [],
        } satisfies {
          readonly sliceTexts: readonly LaneSliceText[];
          readonly shippedChunkIndices: readonly number[];
        };

        /**
         * Comparison over that one anchor.
         */
        const rows = compareDocumentLanes({
          repair: unfilledAnchor,
          translate: unfilledAnchor,
        },);
        expect(rows[0]?.verdict,).toBe('gap-remains',);
        expect(rows[0]?.incumbentKind,).toBe('absent',);
        // Neither lane decided anything, so there is nothing to compare either.
        expect(rows[0]?.decisionComparison
          .kind,).toBe('not-comparable',);
      },
    },),
    it({
      name:
        'REFUSES two lanes that disagree about whether the archive translates a slice at all, EVEN WHEN '
        + 'their incumbent text matches, which is the only case that matters: a blank content slice and a '
        + 'place the archive never translated both carry the empty string, and every row took its kind '
        + 'from the repair lane',
      fn: async () => {
        /**
         * Failure the comparison raised.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'present',
                incumbentText: '',
                outcome: { kind: 'not-evaluated', },
              },],
              shippedChunkIndices: [],
            },
            translate: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'absent',
                incumbentText: '',
                outcome: { kind: 'unfilled', },
              },],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneComparisonError,);
        expect(String(caught,),).toContain('whether the archive translates it',);
      },
    },),
    it({
      name:
        'asserts each lane`s wording against itself before joining them, since the two structural '
        + 'boundaries that take wordings from a caller are this and the delivery ledger, and a row that '
        + 'contradicts itself would otherwise be compared as though it did not',
      fn: async () => {
        /**
         * Failure raised by a lane falling back on wording the archive lacks.
         */
        let caught: unknown;
        try {
          compareDocumentLanes({
            repair: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'absent',
                incumbentText: '',
                // Nothing to fall back on: the archive holds no wording here.
                outcome: { kind: 'incumbent-fallback', },
              },],
              shippedChunkIndices: [],
            },
            translate: {
              sliceTexts: [{
                chunkIndex: 0,
                incumbentKind: 'absent',
                incumbentText: '',
                outcome: { kind: 'unfilled', },
              },],
              shippedChunkIndices: [],
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(String(caught,),).toContain('standing by default, and the archive holds none',);
      },
    },),
    it({
      name:
        'does not call it disagreement when one lane had no work to do. The repair lane mends existing '
        + 'English, so at a passage the archive never translated it never had an opinion; reporting its '
        + 'silence as a decision made every anchor the translate lane filled read as the two lanes '
        + 'choosing different wordings',
      fn: async () => {
        /**
         * Anchor the translate lane filled and the repair lane cannot touch.
         */
        const rows = compareDocumentLanes({
          repair: {
            sliceTexts: [{
              chunkIndex: 0,
              incumbentKind: 'absent',
              incumbentText: '',
              outcome: { kind: 'not-applicable', },
            },],
            shippedChunkIndices: [],
          },
          translate: {
            sliceTexts: [{
              chunkIndex: 0,
              incumbentKind: 'absent',
              incumbentText: '',
              outcome: {
                kind: 'decided',
                acceptedText: 'The cat has a bowl of its own.',
              },
            },],
            shippedChunkIndices: [0,],
          },
        },);

        // ONE lane decided, so there is nothing to compare, and the row names
        // which one rather than implying both fell short.
        expect(rows[0]?.decisionComparison,).toEqual({
          kind: 'not-comparable',
          undecidedLanes: ['repair',],
        },);
        expect(rows[0]?.verdict,).toBe('translate-only',);
        expect(rows[0]?.repairOutcome
          .kind,).toBe('not-applicable',);
      },
    },),
    it({
      name:
        'compares what the two lanes DECIDED beside what the two documents carry, because both lanes '
        + 'choosing the same wording where only one shipped it is agreement between the lanes and a '
        + 'difference between the documents, and one verdict cannot state both',
      fn: async () => {
        /**
         * Both lanes chose the same replacement; the guard withdrew translate`s.
         */
        const agreed = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: false, },),
        },);
        // The DOCUMENTS differ, since only one carries the replacement.
        expect(agreed[0]?.verdict,).toBe('repair-only',);
        // The LANES agree, which the delivery verdict cannot say.
        expect(agreed[0]?.decisionComparison,).toEqual({
          kind: 'comparable',
          verdict: 'same',
        },);

        /**
         * Both lanes chose differently, and both shipped.
         */
        const apart = compareDocumentLanes({
          repair: laneOf({ acceptedText: 'The cat is asleep on the windowsill.', shipped: true, },),
          translate: laneOf({ acceptedText: 'A cat dozes in the window.', shipped: true, },),
        },);
        expect(apart[0]?.decisionComparison,).toEqual({
          kind: 'comparable',
          verdict: 'different',
        },);
      },
    },),
  ],
},);
