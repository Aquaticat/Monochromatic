/**
 Tests the Latin letter tests the package's prose scanners share (audit area
 six): each block at its edges, the characters just outside them, the two
 Latin-1 signs, and the Greek and Cyrillic letters a kaomoji carries; and
 the word scan built on them, over accented words opening, inside and
 decomposed.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  continuesLatinWord,
  foldLatinWord,
  isCombiningMark,
  isLatinLetter,
  isLatinLetterOrMark,
  isLatinWordCharacter,
  latinWordSpans,
  lowerCaseLatinWords,
} from '../dist/final/node/index.mjs';

/**
 Characters each test is read against, named by code point where the glyph
 alone would not say which one it is.
 */
const PROBES: readonly string[] = [
  'a',
  'Z',
  '7',
  '_',
  // U+00BF INVERTED QUESTION MARK, just before the Latin-1 letters.
  '\u{00BF}',
  // U+00C0 LATIN CAPITAL LETTER A WITH GRAVE, the first Latin-1 letter.
  '\u{00C0}',
  // U+00D7 MULTIPLICATION SIGN, inside the Latin-1 letters.
  '\u{00D7}',
  // U+00F7 DIVISION SIGN, inside the Latin-1 letters.
  '\u{00F7}',
  'é',
  'ǎ',
  // U+024F LATIN SMALL LETTER Y WITH STROKE, the last of Latin Extended-B.
  '\u{024F}',
  // U+0250 LATIN SMALL LETTER TURNED A, the first IPA extension.
  '\u{0250}',
  // U+0300 COMBINING GRAVE ACCENT, the first combining mark.
  '\u{0300}',
  // U+036F COMBINING LATIN SMALL LETTER X, the last combining mark.
  '\u{036F}',
  // U+0370 GREEK CAPITAL LETTER HETA, just past the combining marks.
  '\u{0370}',
  'ω',
  'д',
  // U+1DFF COMBINING RIGHT ARROWHEAD AND DOWN ARROWHEAD BELOW, just before Latin Extended Additional.
  '\u{1DFF}',
  // U+1E00 LATIN CAPITAL LETTER A WITH RING BELOW, the first of Latin Extended Additional.
  '\u{1E00}',
  // U+1EFF LATIN SMALL LETTER Y WITH LOOP, the last of Latin Extended Additional.
  '\u{1EFF}',
  // U+1F00 GREEK SMALL LETTER ALPHA WITH PSILI, just past it.
  '\u{1F00}',
  '，',
  '猫',
  '',
];

/**
 Probes one test admits, in probe order.

 @param admits - test under read

 @returns Probes the test admits

 @example
 ```ts
 admitted(isLatinLetter);
 ```
 */
function admitted(
  admits: (argument: { readonly character: string; },) => boolean,
): readonly string[] {
  return PROBES.filter(function admittedProbe(character,): boolean {
    return admits({ character, },);
  },);
}

await describe({
  name: 'latin letters',
  children: [
    it({
      name: 'ADMITS ASCII, Latin-1, Extended-A, -B and Additional letters, and not the signs, digits or other scripts',
      fn: async () => {
        expect(admitted(isLatinLetter,),).toEqual([
          'a',
          'Z',
          '\u{00C0}',
          'é',
          'ǎ',
          '\u{024F}',
          '\u{1E00}',
          '\u{1EFF}',
        ],);
      },
    },),
    it({
      name: 'ADMITS ASCII digits besides the letters as word characters, and nothing else',
      fn: async () => {
        expect(admitted(isLatinWordCharacter,),).toEqual([
          'a',
          'Z',
          '7',
          '\u{00C0}',
          'é',
          'ǎ',
          '\u{024F}',
          '\u{1E00}',
          '\u{1EFF}',
        ],);
      },
    },),
    it({
      name: 'ADMITS the combining diacritical marks block at both edges and nothing beside it',
      fn: async () => {
        expect(admitted(isCombiningMark,),).toEqual(['\u{0300}', '\u{036F}',],);
      },
    },),
    it({
      name: 'CONTINUES a letter run with a letter or a mark, and a word also with a digit',
      fn: async () => {
        expect(admitted(isLatinLetterOrMark,),).toEqual([
          'a',
          'Z',
          '\u{00C0}',
          'é',
          'ǎ',
          '\u{024F}',
          '\u{0300}',
          '\u{036F}',
          '\u{1E00}',
          '\u{1EFF}',
        ],);
        expect(admitted(continuesLatinWord,),).toEqual([
          'a',
          'Z',
          '7',
          '\u{00C0}',
          'é',
          'ǎ',
          '\u{024F}',
          '\u{0300}',
          '\u{036F}',
          '\u{1E00}',
          '\u{1EFF}',
        ],);
      },
    },),
    it({
      name: 'SCANS words that open on, carry or end in an accent, composed or combining, as one word each, where they start',
      fn: async () => {
        // An ASCII scan read `Heřmánek` as `He`, `m` and `nek`, and `Åhe` as
        // `he` from its second letter.
        expect(latinWordSpans({ text: 'Heřmánek met Åhe at the Cafe\u{0301}.', },),).toEqual([
          { word: 'Heřmánek', start: 0, },
          { word: 'met', start: 9, },
          { word: 'Åhe', start: 13, },
          { word: 'at', start: 17, },
          { word: 'the', start: 20, },
          { word: 'Cafe\u{0301}', start: 24, },
        ],);
      },
    },),
    it({
      name: 'SPLITS at digits, apostrophes, spaces, other scripts, and a combining mark with no letter before it',
      fn: async () => {
        expect(lowerCaseLatinWords({ text: 'Cat9lives don\'t 猫猫 ω\u{0301}x (・ω・) Z', },),).toEqual([
          'cat',
          'lives',
          'don',
          't',
          'x',
          'z',
        ],);
      },
    },),
    it({
      name: 'FOLDS a word written with its accent, a separate accent or none to one lower-case form',
      fn: async () => {
        expect([
          'Kätzchen',
          'Ka\u{0308}tzchen',
          'KATZCHEN',
          'Château',
        ].map(function folded(word,): string {
          return foldLatinWord({ word, },);
        },),).toEqual([
          'katzchen',
          'katzchen',
          'katzchen',
          'chateau',
        ],);
      },
    },),
  ],
},);
