/**
 * Tests for the rule tying a lane's outcome to what the archive holds.
 *
 * WHAT THESE PIN is that the two axes of a wording are independent and not
 * unconstrained. Three of their combinations describe a slice that cannot
 * exist, every field of each is individually well formed, and no later join or
 * count could detect one: a fallback onto wording that was never there reads
 * downstream as a translation being kept.
 *
 * `buildLaneSliceTexts` refuses all three while building. This is the same rule
 * at the boundaries that take wordings from a caller rather than making them.
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
  assertWordingCoherent,
  type LaneSliceText,
  WordingCoherenceError,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of the slice the coherent cases use.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

await describe({
  name: assertWordingCoherent.name,
  children: [
    it({
      name:
        'accepts every combination a real slice can be in: a decision, an unexamined slice, silence where '
        + 'the archive has wording to stand on, and a missing passage where it has none',
      fn: async () => {
        /**
         * Wordings a lane can legitimately report.
         */
        const coherent = [
          {
            chunkIndex: 0,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: 'The cat is asleep on the windowsill.',
            },
          },
          {
            chunkIndex: 1,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: { kind: 'not-evaluated', },
          },
          {
            chunkIndex: 2,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: { kind: 'incumbent-fallback', },
          },
          {
            chunkIndex: 3,
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: { kind: 'unfilled', },
          },
          // An anchor nobody reached is still just an anchor nobody reached.
          {
            chunkIndex: 4,
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: { kind: 'not-evaluated', },
          },
          // And an anchor a lane FILLED is the point of anchors existing.
          {
            chunkIndex: 5,
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: {
              kind: 'decided',
              acceptedText: 'The cat has a bowl of its own.',
            },
          },
        ] satisfies readonly LaneSliceText[];
        for (const wording of coherent)
          assertWordingCoherent({ wording, },);
      },
    },),
    it({
      name:
        'REFUSES a fallback onto wording the archive does not hold, since `incumbent-fallback` says the '
        + 'archive`s own English stands here and there is none: the row would report a passage as covered '
        + 'by a translation that has never existed',
      fn: async () => {
        expect(function fellBackOnNothing() {
          assertWordingCoherent({
            wording: {
              chunkIndex: 2,
              incumbentKind: 'absent',
              incumbentText: '',
              outcome: { kind: 'incumbent-fallback', },
            },
          },);
        },).toThrow(WordingCoherenceError,);
      },
    },),
    it({
      name:
        'REFUSES a missing passage the archive translates, the mirror of the same rule, because every count '
        + 'of untranslated passages would inherit a slice the archive covers',
      fn: async () => {
        expect(function missingWhatExists() {
          assertWordingCoherent({
            wording: {
              chunkIndex: 3,
              incumbentKind: 'present',
              incumbentText: ARCHIVE_NAP,
              outcome: { kind: 'unfilled', },
            },
          },);
        },).toThrow('holds wording for it',);
      },
    },),
    it({
      name:
        'REFUSES a decision of empty wording at a place the archive never translated, which fills nothing '
        + 'and leaves the passage exactly as it was, so recording it as a decision credits the lane with '
        + 'work indistinguishable from the gap it started with',
      fn: async () => {
        expect(function decidedNothing() {
          assertWordingCoherent({
            wording: {
              chunkIndex: 4,
              incumbentKind: 'absent',
              incumbentText: '',
              outcome: {
                kind: 'decided',
                acceptedText: '',
              },
            },
          },);
        },).toThrow(WordingCoherenceError,);
      },
    },),
    it({
      name:
        'still accepts a decision of empty wording where the archive HAS wording, since deleting a passage '
        + 'is a decision somebody took and the delivery ledger has to be able to say so',
      fn: async () => {
        assertWordingCoherent({
          wording: {
            chunkIndex: 5,
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: '',
            },
          },
        },);
      },
    },),
  ],
},);
