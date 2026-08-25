/**
 * Tests for the guard that separates a rendering of nothing from nothing to
 * render.
 *
 * WHAT THIS ADDS BESIDE THE JUDGE'S OWN CASE, which was measured rather than
 * assumed: `translate-judge.unit.test.ts` hand-builds a slate whose sole
 * candidate is whitespace and proves the judge throws, and removing this guard
 * fails that case too. So the yes arm and the trim on the winner side are
 * already driven, through the one caller there is.
 *
 * THE SECOND CONJUNCT IS WHAT NOTHING ELSE ASKS. That case's original always
 * says something, because a slate is only judged where there was a passage to
 * render, so nothing varies the source side. A slice whose original is empty
 * must settle as the absence it is rather than as a passage this run emptied,
 * and a guard reading the winner alone would call it a deletion.
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

import { blankAgainst, } from '../dist/final/node/index.mjs';

/**
 * Original that says something, for every case that needs one.
 */
const SOURCE_SAYS_SOMETHING = '猫猫在窗台上睡觉。';

await describe({
  name: blankAgainst.name,
  children: [
    it({
      name: 'REPORTS a deletion where the winner says nothing and the original said something, whether '
        + 'the winner is empty or only whitespace. Trimming is the difference between a guard that '
        + 'fires and one a single newline walks past',
      fn: async () => {
        expect(blankAgainst({
          winner: '',
          sourceText: SOURCE_SAYS_SOMETHING,
        },),).toBe(true,);
        expect(blankAgainst({
          winner: ' \n\t \n ',
          sourceText: SOURCE_SAYS_SOMETHING,
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REPORTS no deletion where the original said nothing either, so an anchor the archive never '
        + 'translated settles as the absence it is rather than as a passage this run emptied',
      fn: async () => {
        expect(blankAgainst({
          winner: '',
          sourceText: '',
        },),).toBe(false,);
        // A source of nothing but whitespace is a source that says nothing, on
        // the same reading the winner side takes.
        expect(blankAgainst({
          winner: '',
          sourceText: '   \n  ',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'REPORTS no deletion where the winner says something, which is every slice that ships, and '
        + 'says so even where the original is silent',
      fn: async () => {
        expect(blankAgainst({
          winner: 'The cat sleeps on the windowsill.',
          sourceText: SOURCE_SAYS_SOMETHING,
        },),).toBe(false,);
        expect(blankAgainst({
          winner: 'The cat sleeps on the windowsill.',
          sourceText: '',
        },),).toBe(false,);
      },
    },),
  ],
},);
