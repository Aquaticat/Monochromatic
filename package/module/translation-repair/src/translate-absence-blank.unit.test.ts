/**
 * Tests for the guard that separates a rendering of nothing from nothing to
 * render.
 *
 * WHY THIS FILE EXISTS. `blankAgainst` decides whether a winning text shipping
 * empty would delete a passage, and `translate-judge.ts` calls it on every
 * selected outcome. That call site documents its own arm as unreachable: blank
 * proposals never become candidates and a blank incumbent never joins the
 * slate, so no end-to-end case can make it answer yes. A guard whose answer
 * nothing can reach is a guard nothing has ever run, and the day the slate
 * changes is the day it decides whether a slice ships a deletion.
 *
 * BOTH CONJUNCTS ARE PINNED, because the pair is the whole point: emptiness is
 * only a defect where there was something to render, and an anchor the archive
 * never translated must not be read as a passage this run deleted.
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
