/**
 * Tests for the two constructed defects `#84` puts on the ballot.
 *
 * What these pin is the property each fixture EXISTS for: the deletion leaves
 * the complete text longer, the insertion leaves it shorter, and both leave
 * every other word alone. A fixture that quietly failed either would produce a
 * number that reads exactly like a good one.
 *
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
  deleteOneSentence,
  donorTextFor,
  insertBorrowedSentence,
} from '../dist/final/node/index.mjs';

/**
 * Slice English long enough for a sentence to be worth moving.
 */
const CLEAN_TEXT = [
  'The tortoiseshell cat arrived at the shelter on a rainy Tuesday in November.',
  'She had been found under a parked van near the harbour, thin and unwilling to be touched.',
  'The volunteers named her Marmalade because of the orange patch across her left shoulder.',
].join(' ',);

/**
 * English of another slice of the same imagined document.
 */
const DONOR_TEXT = [
  'Her favourite place in the whole building turned out to be the top of the filing cabinet.',
  'From there she could watch the front door without anybody watching her back.',
].join(' ',);

/**
 * Sentence the donor offers, which is its longest unique one.
 */
const BORROWED = 'Her favourite place in the whole building turned out to be the top of the filing cabinet.';

/**
 * Builds a slice pair carrying the given English.
 *
 * AN EMPTY STRING IS AN INSERTION ANCHOR, which is how the real type spells a
 * boundary where translation is not: both members of `DocumentChunk` declare
 * `text`, so "no English here" arrives as empty rather than as absent.
 *
 * @param text - English the slice carries, empty for an insertion anchor
 *
 * @returns Slice pair shaped as preparation produces
 *
 * @example
 * ```ts
 * const slice = sliceCarrying({ text: DONOR_TEXT, },);
 * ```
 */
function sliceCarrying({ text, }: { readonly text: string; },) {
  return {
    source: {
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 2,
      nodes: [],
      text: '小猫',
    },
    target: {
      chunkIndex: 0,
      startOffset: 0,
      endOffset: text.length,
      nodes: [],
      text,
    },
  };
}

await describe({
  name: deleteOneSentence.name,
  children: [
    it({
      name: 'removes one whole sentence and leaves the rest word for word, so the damaged text can '
        + 'lose on coverage and on nothing else',
      fn: async () => {
        const attempt = deleteOneSentence({ cleanText: CLEAN_TEXT, },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        expect(attempt.damageKind,).toBe('deletion',);
        expect(attempt.damagedText
          .length,).toBeLessThan(CLEAN_TEXT.length,);
        // Every surviving sentence must appear untouched: a deletion that also
        // rewrote its neighbours would let a judge choose on wording.
        expect(CLEAN_TEXT.includes('The volunteers named her Marmalade',),).toBe(true,);
        expect(attempt.damagedText
          .includes('The tortoiseshell cat arrived at the shelter',),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a passage with no sentence long enough to delete, rather than returning the '
        + 'text unchanged as though it had damaged it',
      fn: async () => {
        const attempt = deleteOneSentence({ cleanText: 'Short. Also short.', },);
        expect(attempt.kind,).toBe('undamageable',);
      },
    },),
  ],
},);

await describe({
  name: insertBorrowedSentence.name,
  children: [
    it({
      name: 'splices the borrowed sentence in, which makes the COMPLETE text the shorter candidate '
        + 'and is the whole reason this fixture exists beside the deletion',
      fn: async () => {
        const attempt = insertBorrowedSentence({
          cleanText: CLEAN_TEXT,
          donorText: DONOR_TEXT,
        },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        expect(attempt.damageKind,).toBe('insertion',);
        // THE INVERSION, stated as an assertion rather than as a comment: a
        // roster preferring length scores every deletion trial and fails here.
        expect(attempt.damagedText
          .length,).toBeGreaterThan(CLEAN_TEXT.length,);
        expect(attempt.damagedText
          .includes(BORROWED,),).toBe(true,);
        // Nothing of the clean text may be lost, or the damaged candidate would
        // carry two defects and a judge choosing it could be right about one.
        expect(attempt.damagedText
          .includes('The volunteers named her Marmalade',),).toBe(true,);
        expect(attempt.changedChars,).toBe(BORROWED.length,);
      },
    },),
    it({
      name: 'REFUSES to borrow a sentence the slice already carries, which would add nothing and '
        + 'would score a judge wrong for keeping a text that says the same things',
      fn: async () => {
        const attempt = insertBorrowedSentence({
          cleanText: `${CLEAN_TEXT} ${BORROWED}`,
          donorText: DONOR_TEXT,
        },);
        expect(attempt.kind,).toBe('undamageable',);
      },
    },),
    it({
      name: 'REFUSES when the donor offers no sentence, so an entry of one slice cannot produce a '
        + 'trial whose damaged candidate is the clean text',
      fn: async () => {
        const attempt = insertBorrowedSentence({
          cleanText: CLEAN_TEXT,
          donorText: '',
        },);
        expect(attempt.kind,).toBe('undamageable',);
      },
    },),
  ],
},);

await describe({
  name: donorTextFor.name,
  children: [
    it({
      name: 'takes the FURTHEST slice carrying English, since a neighbour restates what the damaged '
        + 'slice says and would make the borrowed sentence supported after all',
      fn: async () => {
        const donor = donorTextFor({
          slices: [
            sliceCarrying({ text: CLEAN_TEXT, },),
            sliceCarrying({ text: 'A neighbouring slice.', },),
            sliceCarrying({ text: DONOR_TEXT, },),
          ],
          sliceIndex: 0,
        },);
        expect(donor,).toBe(DONOR_TEXT,);
      },
    },),
    it({
      name: 'never donates a slice to itself, which would splice a sentence the slice already '
        + 'carries and damage nothing',
      fn: async () => {
        const donor = donorTextFor({
          slices: [sliceCarrying({ text: CLEAN_TEXT, },),],
          sliceIndex: 0,
        },);
        expect(donor,).toBe('',);
      },
    },),
    it({
      name: 'skips a slice carrying no English at all, so the furthest INSERTION ANCHOR cannot be '
        + 'chosen as the donor and leave the insertion fixture with nothing to borrow',
      fn: async () => {
        const donor = donorTextFor({
          slices: [
            sliceCarrying({ text: CLEAN_TEXT, },),
            sliceCarrying({ text: DONOR_TEXT, },),
            sliceCarrying({ text: '', },),
          ],
          sliceIndex: 0,
        },);
        expect(donor,).toBe(DONOR_TEXT,);
      },
    },),
  ],
},);
