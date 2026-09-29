/**
 Tests the word-bounded match the refusal readers share (ledger B23): each
 Latin edge of a needle at a word boundary, the end left open, digits and
 combining marks continuing a word, Han and punctuation edges needing no
 boundary, overlapping starts, and the empty needle.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  carriesWord,
  wordStarts,
} from '../dist/final/node/index.mjs';

await describe({
  name: wordStarts.name,
  children: [
    it({
      name: 'FINDS EVERY START WHERE BOTH LATIN EDGES STAND APART, and none where a word runs on at either edge',
      fn: async () => {
        expect(wordStarts({
          text: 'cat, cats, bobcat, a cat.',
          needle: 'cat',
          end: 'word',
        },),).toEqual([
          0,
          21,
        ],);
      },
    },),
    it({
      name: 'LEAVES THE END OPEN when asked, so a marker is the start of a word and still not the middle of one',
      fn: async () => {
        expect(wordStarts({
          text: 'cat, cats, bobcat, a cat.',
          needle: 'cat',
          end: 'open',
        },),).toEqual([
          0,
          5,
          21,
        ],);
      },
    },),
    it({
      name: 'READS A DIGIT OR A COMBINING MARK BESIDE THE NEEDLE AS THE WORD RUNNING ON',
      fn: async () => {
        for (const text of [
          'cat9',
          '9cat',
          // U+0301 COMBINING ACUTE ACCENT after the needle's last letter.
          'cat\u{0301}',
          // An accented letter from Latin-1 before the needle.
          '\u{00E9}cat',
        ]) {
          expect(wordStarts({
            text,
            needle: 'cat',
            end: 'word',
          },),).toEqual([],);
        }
      },
    },),
    it({
      name: 'NEEDS NO BOUNDARY AT A HAN EDGE OR A PUNCTUATION EDGE, since Chinese writes no spaces and a mark '
        + 'already stands apart',
      fn: async () => {
        expect(wordStarts({
          text: 'ab\u{732B}\u{732B}cd',
          needle: '\u{732B}\u{732B}',
          end: 'word',
        },),).toEqual([2,],);
        expect(wordStarts({
          text: 'a(cat)b',
          needle: '(cat)',
          end: 'word',
        },),).toEqual([1,],);
        expect(wordStarts({
          text: '\u{732B}cat\u{732B}',
          needle: 'cat',
          end: 'word',
        },),).toEqual([1,],);
      },
    },),
    it({
      name: 'FINDS OVERLAPPING STARTS, stepping one unit past each rather than past the whole needle',
      fn: async () => {
        expect(wordStarts({
          text: 'a-a-a',
          needle: 'a-a',
          end: 'word',
        },),).toEqual([
          0,
          2,
        ],);
      },
    },),
    it({
      name: 'FINDS NOTHING FOR AN EMPTY NEEDLE rather than a start at every offset',
      fn: async () => {
        expect(wordStarts({
          text: 'cat',
          needle: '',
          end: 'word',
        },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: carriesWord.name,
  children: [
    it({
      name: 'SAYS WHETHER ANY START STANDS APART',
      fn: async () => {
        expect(carriesWord({
          text: 'the cat served as an aide',
          needle: 'as an ai',
          end: 'word',
        },),).toBe(false,);
        expect(carriesWord({
          text: 'as an aide, and as an ai.',
          needle: 'as an ai',
          end: 'word',
        },),).toBe(true,);
      },
    },),
  ],
},);
