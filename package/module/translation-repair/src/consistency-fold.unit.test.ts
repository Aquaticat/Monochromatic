/**
 Tests for reading a judge's quote in a place's own English: what the fold
 treats as one text, where a quote stands as the English holds it, and the
 cases it must not merge.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  foldedWordsOf,
  locateWords,
  standsOf,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: foldedWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'TREATS A RUN OF WHITESPACE AS ONE SPACE, a line break and a tab included, and keeps a blank line apart '
            + 'from a space as two line breaks',
          fn: async () => {
            expect([
              foldedWordsOf({ text: 'The kitten   naps', },),
              foldedWordsOf({ text: 'The kitten\nnaps', },),
              foldedWordsOf({ text: 'The kitten\t naps', },),
              foldedWordsOf({ text: 'The kitten\n\nnaps', },),
              foldedWordsOf({ text: 'The kitten \n \n naps', },),
            ],).toEqual([
              'The kitten naps',
              'The kitten naps',
              'The kitten naps',
              'The kitten\n\nnaps',
              'The kitten\n\nnaps',
            ],);
          },
        },),
        it({
          name: 'READS ITS OWN RESULT AGAIN AS THE SAME WORDS, over every run of up to four pieces taken from words, '
            + 'spaces, line breaks, sentence punctuation, quotation marks and brackets',
          fn: async () => {
            const pieces = [
              'cat',
              ' ',
              '\n',
              '\n\n',
              '.',
              '"',
              '“',
              '”',
              '\'',
              '(',
              ')',
              '「',
              '」',
              '…',
            ];
            /**
             Every run of one more piece than the runs it is given.
             */
            function longer({ runs, }: { readonly runs: readonly string[]; },): readonly string[] {
              return runs.flatMap(function extended(run,): readonly string[] {
                return pieces.map(function withPiece(piece,): string {
                  return `${run}${piece}`;
                },);
              },);
            }
            const ones = longer({ runs: [''], },);
            const twos = longer({ runs: ones, },);
            const threes = longer({ runs: twos, },);
            const everyRun = [...ones, ...twos, ...threes, ...longer({ runs: threes, },),];
            const changed = everyRun.filter(function readsDifferently(text,): boolean {
              const once = foldedWordsOf({ text, },);
              return foldedWordsOf({ text: once, },) !== once;
            },);
            expect(changed,).toEqual([],);
          },
        },),
        it({
          name: 'READS A SOFT WRAP AS A SPACE AND A BLANK LINE AS A BLANK LINE, in the first reading and in the second',
          fn: async () => {
            const soft = foldedWordsOf({ text: 'One.\nTwo', },);
            const blank = foldedWordsOf({ text: 'One.\n\nTwo', },);
            expect([
              soft,
              foldedWordsOf({ text: soft, },),
              blank,
              foldedWordsOf({ text: blank, },),
            ],).toEqual([
              'One. Two',
              'One. Two',
              'One.\n\nTwo',
              'One.\n\nTwo',
            ],);
          },
        },),
        it({
          name: 'TAKES THE QUOTATION MARKS AND BRACKETS THAT ENCLOSE A QUOTE OFF ITS EDGES, straight or curly, single or '
            + 'double, corner brackets included, with the punctuation that closes it',
          fn: async () => {
            const kind = 'So she was kind';
            expect([
              '“So she was kind”.',
              '"So she was kind"',
              '‘So she was kind’',
              '「So she was kind」',
              '『So she was kind』',
              '(So she was kind)',
              '[So she was kind]',
              '("So she was kind").',
              '“So she was kind',
              'So she was kind”',
            ].map(function wordsOf(text,): string {
              return foldedWordsOf({ text, },);
            },),).toEqual([kind, kind, kind, kind, kind, kind, kind, kind, kind, kind,],);
          },
        },),
        it({
          name: 'KEEPS A QUOTATION MARK OR A BRACKET AT AN EDGE THAT PAIRS WITH ONE INSIDE THE QUOTE, since the words need it',
          fn: async () => {
            expect([
              '“So she was kind,” she said.',
              'So she was (kind)',
              '(a) and (b)',
              '"Cat" naps',
              'wasn’t',
            ].map(function wordsOf(text,): string {
              return foldedWordsOf({ text, },);
            },),).toEqual([
              '"So she was kind," she said',
              'So she was (kind)',
              '(a) and (b)',
              '"Cat" naps',
              'wasn\'t',
            ],);
          },
        },),
        it({
          name: 'TAKES A QUOTATION MARK OFF AN EDGE WHEN IT PAIRS WITH NOTHING IN THE QUOTE',
          fn: async () => {
            expect([
              'Cat naps."',
              ')Cat naps(',
            ].map(function wordsOf(text,): string {
              return foldedWordsOf({ text, },);
            },),).toEqual([
              'Cat naps',
              'Cat naps',
            ],);
          },
        },),
        it({
          name: 'KEEPS A STRAIGHT OR CURLY APOSTROPHE AT A WORD EDGE, a dropped initial, a dropped final letter and a plural '
            + 'possessive, and takes the pair off that encloses a quote holding one',
          fn: async () => {
            expect([
              '’Tis the season',
              'we were goin’',
              'the girls’',
              'the girls\'',
              '‘the cats’ bowl’',
              '\'cats\' bowl\'',
            ].map(function wordsOf(text,): string {
              return foldedWordsOf({ text, },);
            },),).toEqual([
              '\'Tis the season',
              'we were goin\'',
              'the girls\'',
              'the girls\'',
              'the cats\' bowl',
              'cats\' bowl',
            ],);
          },
        },),
        it({
          name: 'TREATS STRAIGHT AND CURLY QUOTES AND APOSTROPHES AS EQUAL, by the evidence fold',
          fn: async () => {
            expect([
              foldedWordsOf({ text: 'The kitten wasn’t “asleep”', },),
              foldedWordsOf({ text: 'The kitten wasn\'t "asleep"', },),
            ],).toEqual([
              'The kitten wasn\'t "asleep"',
              'The kitten wasn\'t "asleep"',
            ],);
          },
        },),
        it({
          name: 'IGNORES SENTENCE PUNCTUATION, SPACE AND INVISIBLE CHARACTERS AT THE TWO EDGES of a quote, and nowhere else',
          fn: async () => {
            const invisible = String.fromCodePoint(0x20_0B,);
            expect([
              foldedWordsOf({ text: 'The kitten naps.', },),
              foldedWordsOf({ text: '  The kitten naps?!  ', },),
              foldedWordsOf({ text: `${invisible}The kitten naps${invisible}`, },),
              foldedWordsOf({ text: 'The kitten, then naps.', },),
              foldedWordsOf({ text: '...', },),
              foldedWordsOf({ text: '', },),
            ],).toEqual([
              'The kitten naps',
              'The kitten naps',
              'The kitten naps',
              'The kitten, then naps',
              '',
              '',
            ],);
          },
        },),
        it({
          name: 'DOES NOT MERGE WORDS THAT DIFFER, a letter case or a letter apart',
          fn: async () => {
            expect(new Set([
              foldedWordsOf({ text: 'The kitten naps', },),
              foldedWordsOf({ text: 'the kitten naps', },),
              foldedWordsOf({ text: 'The kittens naps', },),
            ],).size,).toBe(3,);
          },
        },),
      ],
    },),
    describe({
      name: locateWords.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LOCATES A QUOTE THAT STANDS ONCE with the offsets of the English as it was given, a line break the quote '
            + 'writes as a space included',
          fn: async () => {
            const english = 'It purred.\nThe kitten wasn’t asleep,\nwas it?\nIt blinked.';
            const found = locateWords({ haystack: english, words: 'The kitten wasn\'t asleep, was it?', },);
            expect(found,).toEqual({ kind: 'once', start: 11, end: 43, },);
            expect(english.slice(11, 43,),).toBe('The kitten wasn’t asleep,\nwas it',);
          },
        },),
        it({
          name: 'LOCATES A QUOTE ACROSS A RUN OF SPACES IN THE ENGLISH, the end offset past the whole run it stands for',
          fn: async () => {
            const english = 'The kitten   naps  in the sun.';
            const found = locateWords({ haystack: english, words: 'The kitten naps in', },);
            expect(found,).toEqual({ kind: 'once', start: 0, end: 21, },);
            expect(english.slice(0, 21,),).toBe('The kitten   naps  in',);
          },
        },),
        it({
          name: 'FINDS NOTHING for a quote that stands nowhere, a quote that shows a reader nothing, and an empty English',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The kitten naps.', words: 'The kitten dozes', },),
              locateWords({ haystack: 'The kitten naps.', words: '...', },),
              locateWords({ haystack: '', words: 'The kitten', },),
            ],).toEqual([{ kind: 'none', }, { kind: 'none', }, { kind: 'none', },],);
          },
        },),
        it({
          name: 'FINDS MANY for a quote that stands more than once, overlapping stands included',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The cat naps. The cat naps.', words: 'The cat naps', },),
              locateWords({ haystack: '猫猫猫', words: '猫猫', },),
            ],).toEqual([{ kind: 'many', }, { kind: 'many', },],);
          },
        },),
        it({
          name: 'KEEPS A BLANK LINE APART FROM A SPACE, so a quote across a paragraph boundary is found only when it holds one',
          fn: async () => {
            const english = 'The kitten naps.\n\nThe dog barks.';
            expect([
              locateWords({ haystack: english, words: 'kitten naps.\n\nThe dog', },),
              locateWords({ haystack: english, words: 'kitten naps. The dog', },),
            ],).toEqual([{ kind: 'once', start: 4, end: 25, }, { kind: 'none', },],);
          },
        },),
        it({
          name: 'LOCATES A QUOTE ACROSS A BLANK LINE WHETHER ITS CALLER FOLDED IT FIRST OR NOT, the offsets those of the '
            + 'English as it was given',
          fn: async () => {
            const english = 'One.\n\nTwo.';
            const raw = 'One.\n\nTwo';
            expect([
              locateWords({ haystack: english, words: raw, },),
              locateWords({ haystack: english, words: foldedWordsOf({ text: raw, },), },),
            ],).toEqual([{ kind: 'once', start: 0, end: 9, }, { kind: 'once', start: 0, end: 9, },],);
          },
        },),
        it({
          name: 'FINDS A WORD NOWHERE WHEN IT STANDS ONLY INSIDE A LONGER WORD, at its start, at its end or in the middle, '
            + 'for letters and for digits',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The kitten also napped.', words: 'so', },),
              locateWords({ haystack: 'So she was a smart girl', words: 'art', },),
              locateWords({ haystack: 'The cats nap.', words: 'cat', },),
              locateWords({ haystack: 'The kitten has 123 toys.', words: '12', },),
              locateWords({ haystack: 'The kitten has 123 toys.', words: '23', },),
            ],).toEqual([
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
            ],);
          },
        },),
        it({
          name: 'FINDS A WORD ONCE WHEN ONE OF TWO STANDS IS INSIDE A LONGER WORD, and a word standing apart from its '
            + 'neighbours beside punctuation',
          fn: async () => {
            expect([
              locateWords({ haystack: 'also so', words: 'so', },),
              locateWords({ haystack: 'The kitten has 123 toys.', words: '123', },),
              locateWords({ haystack: 'The kitten, so it napped.', words: 'so', },),
            ],).toEqual([
              { kind: 'once', start: 5, end: 7, },
              { kind: 'once', start: 15, end: 18, },
              { kind: 'once', start: 12, end: 14, },
            ],);
          },
        },),
        it({
          name: 'NEEDS NO BOUNDARY BESIDE HAN TEXT, a Han edge standing inside a run of Han and a Latin edge beside Han',
          fn: async () => {
            expect([
              locateWords({ haystack: '小猫在窗台上打盹', words: '猫', },),
              locateWords({ haystack: '小猫cat咪', words: 'cat', },),
            ],).toEqual([
              { kind: 'once', start: 1, end: 2, },
              { kind: 'once', start: 2, end: 5, },
            ],);
          },
        },),
        it({
          name: 'LOCATES A QUOTE WITHOUT THE MARKS THAT ENCLOSE IT WHERE THE ENGLISH HOLDS THEM, and with the marks that '
            + 'pair inside it',
          fn: async () => {
            expect([
              locateWords({ haystack: 'She said, “So she was kind.”', words: 'So she was kind', },),
              locateWords({ haystack: 'She said, “So she was kind”.', words: '“So she was kind”', },),
              locateWords({ haystack: '“So she was kind,” she said.', words: '"So she was kind," she said', },),
              locateWords({ haystack: 'The "Cat" naps.', words: '"Cat" naps', },),
            ],).toEqual([
              { kind: 'once', start: 11, end: 26, },
              { kind: 'once', start: 11, end: 26, },
              { kind: 'once', start: 0, end: 27, },
              { kind: 'once', start: 4, end: 14, },
            ],);
          },
        },),
        it({
          name: 'LOCATES A QUOTE WITH THE APOSTROPHE AT ITS EDGE, the span holding the mark the English holds there',
          fn: async () => {
            expect([
              locateWords({ haystack: 'Tis the season to be jolly.', words: '\'Tis the season', },),
              locateWords({ haystack: '\'Tis the season to be jolly.', words: '\'Tis the season', },),
              locateWords({ haystack: 'We were goin’ home.', words: 'We were goin\'', },),
              locateWords({ haystack: 'Fill the cats’ bowl.', words: 'the cats\' bowl', },),
            ],).toEqual([
              { kind: 'none', },
              { kind: 'once', start: 0, end: 15, },
              { kind: 'once', start: 0, end: 13, },
              { kind: 'once', start: 5, end: 19, },
            ],);
          },
        },),
        it({
          name: 'FINDS A WORD NOWHERE WHEN ITS EDGE IS A JOINT OF A LONGER WORD: a hyphen or an apostrophe between two letters, '
            + 'a full stop or a comma between two digits, at the start or the end of the match',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The so-called cat', words: 'so', },),
              locateWords({ haystack: 'The so-called cat', words: 'called', },),
              locateWords({ haystack: 'The well-known cat', words: 'known', },),
              locateWords({ haystack: 'She don\'t nap', words: 't', },),
              locateWords({ haystack: 'The dog\'s nap', words: 'dog', },),
              locateWords({ haystack: 'The dog’s nap', words: 'dog', },),
              locateWords({ haystack: 'It cost 0.5 dollars', words: '5 dollars', },),
              locateWords({ haystack: 'It cost 0.5 dollars', words: '.5 dollars', },),
              locateWords({ haystack: 'It cost 0.5 dollars', words: 'It cost 0', },),
              locateWords({ haystack: 'It cost 1,500 dollars', words: '500 dollars', },),
              locateWords({ haystack: 'It cost 1,500 dollars', words: 'It cost 1', },),
            ],).toEqual([
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
              { kind: 'none', },
            ],);
          },
        },),
        it({
          name: 'LOCATES A WORD WHOSE EDGE IS NO JOINT: the whole compound, a mark beside a space, and a neighbour that is '
            + 'Greek, Han, an emoji or another mark',
          fn: async () => {
            expect([
              locateWords({ haystack: 'The so-called cat', words: 'so-called', },),
              locateWords({ haystack: 'The so - called cat', words: 'so', },),
              locateWords({ haystack: 'The cats\' bowl', words: 'cats', },),
              locateWords({ haystack: 'It cost 0.5 dollars', words: '0.5 dollars', },),
              locateWords({ haystack: 'It cost 0. 5 dollars', words: '5 dollars', },),
              locateWords({ haystack: 'catω naps', words: 'cat', },),
              locateWords({ haystack: 'cat猫 naps', words: 'cat', },),
              locateWords({ haystack: 'cat-猫 naps', words: 'cat', },),
              locateWords({ haystack: `${String.fromCodePoint(0x1_F6_00,)}cat naps`, words: 'cat', },),
              locateWords({ haystack: 'The cat-- naps', words: 'cat', },),
            ],).toEqual([
              { kind: 'once', start: 4, end: 13, },
              { kind: 'once', start: 4, end: 6, },
              { kind: 'once', start: 4, end: 8, },
              { kind: 'once', start: 8, end: 19, },
              { kind: 'once', start: 11, end: 20, },
              { kind: 'once', start: 0, end: 3, },
              { kind: 'once', start: 0, end: 3, },
              { kind: 'once', start: 0, end: 3, },
              { kind: 'once', start: 2, end: 5, },
              { kind: 'once', start: 4, end: 7, },
            ],);
          },
        },),
        it({
          name: 'LOCATES A QUOTE THAT HOLDS A CHARACTER BEYOND THE FIRST PLANE, offsets counted in the units the English is cut in',
          fn: async () => {
            const cat = String.fromCodePoint(0x1_F6_3A,);
            const english = `${cat} The kitten naps ${cat}.`;
            const found = locateWords({ haystack: english, words: `The kitten naps ${cat}`, },);
            expect(found,).toEqual({ kind: 'once', start: 3, end: english.length - 1, },);
          },
        },),
      ],
    },),
    describe({
      name: standsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS EVERY STAND OF THE WORDS AT WORD BOUNDARIES, overlaps included, in the fold locateWords reads',
          fn: async () => {
            expect([
              standsOf({ haystack: 'The cat naps. The cat naps.', words: 'The cat naps', },),
              standsOf({ haystack: 'The cat naps.\n\nThe  cat\nnaps.', words: 'The cat naps', },),
              standsOf({ haystack: 'aa aa aa', words: 'aa aa', },),
              standsOf({ haystack: '猫猫猫', words: '猫猫', },),
              standsOf({ haystack: 'She said, “The cat naps.”', words: '"The cat naps"', },),
            ],).toEqual([2, 2, 2, 2, 1,],);
          },
        },),
        it({
          name: 'COUNTS NO STAND INSIDE A LONGER WORD AND NONE FOR WORDS THAT SHOW A READER NOTHING',
          fn: async () => {
            expect([
              standsOf({ haystack: 'She was also kind.', words: 'so', },),
              standsOf({ haystack: 'A smart cat.', words: 'art', },),
              standsOf({ haystack: 'The cat naps.', words: '  ', },),
              standsOf({ haystack: 'The cat naps.', words: '', },),
              standsOf({ haystack: '', words: 'cat', },),
            ],).toEqual([0, 0, 0, 0, 0,],);
          },
        },),
        it({
          name: 'COUNTS NO STAND AT A JOINT OF A LONGER WORD, as locateWords finds none there, and counts the stands beside it',
          fn: async () => {
            expect([
              standsOf({ haystack: 'The so-called cat is so kind.', words: 'so', },),
              standsOf({ haystack: 'She don\'t nap and the dog\'s nap.', words: 'nap', },),
              standsOf({ haystack: 'She don\'t nap and the dog\'s nap.', words: 'dog', },),
              standsOf({ haystack: 'It cost 0.5 dollars and 5 dollars.', words: '5 dollars', },),
            ],).toEqual([1, 2, 0, 1,],);
          },
        },),
      ],
    },),
  ],
},);
