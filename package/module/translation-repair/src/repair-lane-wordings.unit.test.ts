/**
 * Tests for the repair lane's per-slice wordings.
 *
 * WHAT THESE PIN is that this lane's silence at a passage the archive never
 * translated is reported as silence. It mends existing English, so where there
 * is none it has no work to do and no opinion to record; its settled outcome
 * carries the empty string for want of anything else, and passing that through
 * as a decision said the lane chose the wording it found. A lane comparison
 * then read that against a translate lane that had actually filled the passage
 * and reported the two lanes choosing DIFFERENT wordings.
 *
 * The second thing they pin is the intersection. The blocked exit settles a
 * prefix and stops, so an anchor before the crossing was reached and one after
 * it was not, and naming every anchor in the preparation would report the lane
 * as having visited slices it never got to.
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
  type ChunkPair,
  makeInsertionChunk,
  repairLaneWordings,
} from '../dist/final/node/index.mjs';

/**
 * Archive wording of each content slice, by index; the odd ones are anchors.
 */
const INCUMBENTS: Readonly<Record<number, string>> = {
  0: 'The cat sleeps on the sill.',
  2: 'The bowl is full.',
};

/**
 * Four prepared slices: content, anchor, content, anchor.
 *
 * @returns Pairs shaped as preparation produces them
 *
 * @example
 * ```ts
 * const slices = alternatingSlices();
 * ```
 */
function alternatingSlices(): readonly ChunkPair[] {
  return [
    0,
    1,
    2,
    3,
  ].map(function toPair(chunkIndex,): ChunkPair {
    /**
     * Archive wording here, absent at every anchor.
     */
    const incumbentText = INCUMBENTS[chunkIndex];
    return {
      source: {
        chunkIndex,
        nodes: [],
        startOffset: 0,
        endOffset: 1,
        text: `source of slice ${String(chunkIndex,)}`,
      },
      target: (incumbentText === undefined)
        ? makeInsertionChunk({
          chunkIndex,
          offset: 0,
        },)
        : {
          chunkIndex,
          nodes: [],
          startOffset: 0,
          endOffset: incumbentText.length,
          text: incumbentText,
        },
    };
  },);
}

await describe({
  name: repairLaneWordings.name,
  children: [
    it({
      name:
        'reports a passage the archive never translated as NOT APPLICABLE rather than as a decision, '
        + 'because this lane repairs existing English and there is none there: its outcome carries the '
        + 'empty string for want of anything else, and calling that a decision credits the lane with '
        + 'choosing a wording where it had no opinion at all',
      fn: async () => {
        /**
         * Wordings for a run that visited every slice.
         */
        const wordings = repairLaneWordings({
          slices: alternatingSlices(),
          undecided: 'refuse',
          outcomes: [
            { chunkIndex: 0, repairedText: 'The cat is asleep on the windowsill.', },
            { chunkIndex: 1, repairedText: '', },
            { chunkIndex: 2, repairedText: 'The bowl is full.', },
            { chunkIndex: 3, repairedText: '', },
          ],
        },);
        expect(wordings.map(function toOutcome(one,): string {
          return one.outcome
            .kind;
        },),).toEqual([
          'decided',
          'not-applicable',
          'decided',
          'not-applicable',
        ],);

        // And the archive side agrees, which is what makes the delivery a gap
        // that remains rather than wording being retained.
        expect(wordings.map(function toIncumbentKind(one,): string {
          return one.incumbentKind;
        },),).toEqual([
          'present',
          'absent',
          'present',
          'absent',
        ],);
      },
    },),
    it({
      name:
        'names only the anchors the run actually REACHED. The blocked exit settles a prefix and stops, so '
        + 'an anchor before the crossing is one this lane looked at and had no work for, and an anchor '
        + 'after it is one nobody got to: naming every anchor in the preparation would report slices as '
        + 'visited that never were',
      fn: async () => {
        /**
         * Wordings for a run blocked after the third slice.
         */
        const wordings = repairLaneWordings({
          slices: alternatingSlices(),
          undecided: 'not-evaluated',
          outcomes: [
            { chunkIndex: 0, repairedText: 'The cat is asleep on the windowsill.', },
            { chunkIndex: 1, repairedText: '', },
            { chunkIndex: 2, repairedText: 'The bowl is full.', },
          ],
        },);
        expect(wordings.map(function toOutcome(one,): string {
          return one.outcome
            .kind;
        },),).toEqual([
          'decided',
          'not-applicable',
          'decided',
          'not-evaluated',
        ],);
      },
    },),
  ],
},);
