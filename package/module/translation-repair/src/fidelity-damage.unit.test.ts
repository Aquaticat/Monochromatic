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
  donorTextsFor,
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
      name: 'LEAVES NO WHITESPACE MARK at the join, so the damaged candidate cannot be spotted by '
        + 'its typography instead of by what it fails to say',
      fn: async () => {
        const attempt = deleteOneSentence({ cleanText: CLEAN_TEXT, },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        // A sentence is stored trimmed and prose separates sentences on both
        // sides, so cutting the sentence alone leaves both separators: this ran
        // as a double space before the splice was written.
        expect(attempt.damagedText
          .includes('  ',),).toBe(false,);
      },
    },),
    it({
      name: 'leaves ONE paragraph break where a whole MIDDLE paragraph was, rather than the three '
        + 'consecutive line breaks a bare cut leaves behind',
      fn: async () => {
        /**
         * Three paragraphs whose MIDDLE one carries the longest sentence, which
         * is the one `deriveOmissionSeeds` picks. An earlier fixture put the
         * longest sentence first, so the cut happened at the start of the text
         * and this guard passed without ever exercising a middle join.
         */
        const document = [
          'The shelter opens at eight and closes late.',
          'Marmalade spent her first fortnight refusing to come out from behind the radiator in the back office, '
          + 'where the volunteers left her a bowl every morning and pretended not to watch.',
          'By March she was sleeping in the window.',
        ].join('\n\n',);
        const attempt = deleteOneSentence({ cleanText: document, },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        expect(attempt.damagedText
          .includes('\n\n\n',),).toBe(false,);
        expect(attempt.damagedText
          .includes('\n\n',),).toBe(true,);
      },
    },),
    it({
      name: 'keeps ONE trailing line break when the LAST paragraph goes, so the damaged text ends '
        + 'the way every other document does',
      fn: async () => {
        /**
         * Two paragraphs whose LAST one carries the longest sentence, so the cut
         * lands against the end of the text.
         */
        const document = 'The shelter opens at eight and closes late.\n\n'
          + 'She had been found under a parked van near the harbour that winter, thin and unwilling to be '
          + 'touched by anybody who came near her.\n';
        const attempt = deleteOneSentence({ cleanText: document, },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        expect(attempt.damagedText,).toBe('The shelter opens at eight and closes late.\n',);
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
          donorTexts: [DONOR_TEXT,],
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
          donorTexts: [DONOR_TEXT,],
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
          donorTexts: [],
        },);
        expect(attempt.kind,).toBe('undamageable',);
      },
    },),
  ],
},);

await describe({
  name: donorTextsFor.name,
  children: [
    it({
      name: 'orders donors FURTHEST FIRST, since a neighbour restates what the damaged slice says '
        + 'and would make the borrowed sentence supported after all',
      fn: async () => {
        const donors = donorTextsFor({
          slices: [
            sliceCarrying({ text: CLEAN_TEXT, },),
            sliceCarrying({ text: 'A neighbouring slice.', },),
            sliceCarrying({ text: DONOR_TEXT, },),
          ],
          sliceIndex: 0,
        },);
        expect(donors,).toEqual([
          DONOR_TEXT,
          'A neighbouring slice.',
        ],);
      },
    },),
    it({
      name: 'KEEPS the nearer slices rather than returning the furthest alone, because a document '
        + 'whose last slice is a credit line would otherwise refuse the whole entry',
      fn: async () => {
        const donors = donorTextsFor({
          slices: [
            sliceCarrying({ text: CLEAN_TEXT, },),
            sliceCarrying({ text: DONOR_TEXT, },),
            sliceCarrying({ text: 'Photo credits.', },),
          ],
          sliceIndex: 0,
        },);
        expect(donors,).toEqual([
          'Photo credits.',
          DONOR_TEXT,
        ],);
        // The unusable furthest slice is offered first and the fixture falls
        // past it, which is the whole point of returning an ordered list.
        const attempt = insertBorrowedSentence({
          cleanText: CLEAN_TEXT,
          donorTexts: donors,
        },);
        if (attempt.kind !== 'damaged')
          throw new Error(`expected damage, got ${attempt.reason}`,);
        expect(attempt.damagedText
          .includes(BORROWED,),).toBe(true,);
      },
    },),
    it({
      name: 'never donates a slice to itself, which would splice a sentence the slice already '
        + 'carries and damage nothing',
      fn: async () => {
        const donors = donorTextsFor({
          slices: [sliceCarrying({ text: CLEAN_TEXT, },),],
          sliceIndex: 0,
        },);
        expect(donors,).toEqual([],);
      },
    },),
    it({
      name: 'skips a slice carrying no English at all, which is what an insertion anchor is, rather '
        + 'than offering the empty string as a donor',
      fn: async () => {
        const donors = donorTextsFor({
          slices: [
            sliceCarrying({ text: CLEAN_TEXT, },),
            sliceCarrying({ text: DONOR_TEXT, },),
            sliceCarrying({ text: '', },),
          ],
          sliceIndex: 0,
        },);
        expect(donors,).toEqual([DONOR_TEXT,],);
      },
    },),
  ],
},);
