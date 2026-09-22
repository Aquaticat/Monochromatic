/**
 Guards the second arm of class eighty (shi_Yumiaoya11, 2026-09-22). The
 sheet clause of `bilingual-line-clause.ts` reached every wording and the
 judges still chose the candidate that rendered the film quote's Chinese line
 a second time in English, calling the candidate carrying the English alone
 "a dropped line ... ineligible" under the line criterion, and one judge
 reasoning that the Chinese line "is a literal translation of the sentiment,
 which is distinct from the actual English quote". A judge without the film
 cannot see that the two lines are one, so the question is settled where the
 evidence is: the EXISTING TRANSLATION, a human's, carried the pair as one
 line, and a rendering carrying more lines than that on a slice with such a
 pair has invented one. Without page text, or where the page itself keeps the
 two lines apart (an introduction then a quoted poem, on ten other entries),
 nothing is refused and the judges decide.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { compareLineCounts, } from '../dist/final/node/index.mjs';

/**
 Original quoting a film line in Chinese with its English beside it, the
 attribution likewise, then a closing line.
 */
const BILINGUAL = [
  '> 如果再也见不到猫，祝你早安。',
  '>',
  '> And in case I don’t see the cat, good morning.',
  '>',
  '> 出自《猫的世界》',
  '>',
  '> From *The Cat Show*',
  '',
  '好了，猫，睡吧。',
].join('\n',);

/**
 Page as the human translator left it: each pair once.
 */
const PAGE = [
  '> And in case I don’t see the cat, good morning.',
  '>',
  '> From *The Cat Show*',
  '',
  'All right, cat, sleep now.',
].join('\n',);

/**
 Rendering that wrote the Chinese quote line again in English above the
 film's own line.
 */
const DOUBLED = [
  '> If I never see the cat again, good morning.',
  '>',
  '> And in case I don’t see the cat, good morning.',
  '>',
  '> From *The Cat Show*',
  '',
  'All right, cat, sleep now.',
].join('\n',);

/**
 Original whose Chinese line introduces an English poem line of different
 content: a pair by adjacency, not by meaning.
 */
const INTRODUCED = [
  '最后以一段诗歌结尾吧。',
  'I became a rush that horses tread.',
  '',
  '好了，猫，睡吧。',
].join('\n',);

await describe({
  name: 'the existing translation bounds a bilingual pair to one line (class eighty, shi_Yumiaoya11)',
  children: [
    it({
      name: 'REFUSES a rendering carrying more lines than the page where the page carries the pair once',
      fn: async () => {
        const found = compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED,
          pageText: PAGE,
        },);
        expect(found.length,).toBe(1,);
        expect(found[0],).toContain('once in Chinese and once in English',);
        expect(found[0],).toContain('EXISTING TRANSLATION',);
      },
    },),
    it({
      name: 'ACCEPTS the rendering carrying each pair once, as the page does',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: PAGE,
          pageText: PAGE,
        },).length,).toBe(0,);
      },
    },),
    it({
      name: 'STAYS SILENT without page text, where the judges decide on the sheet clause',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED,
        },).length,).toBe(0,);
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED,
          pageText: '',
        },).length,).toBe(0,);
      },
    },),
    it({
      name: 'STAYS SILENT where the page itself keeps the adjacent lines apart (an introduction then a poem line)',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: INTRODUCED,
          candidateText: 'Let a poem close this.\nI became a rush that horses tread.\n\nAll right, cat, sleep now.',
          pageText: 'To end, a poem.\nI became a rush that horses tread.\n\nAll right, cat, sleep now.',
        },).length,).toBe(0,);
      },
    },),
    it({
      name: 'REFUSES the doubled quote even where the page splits another line of the slice (shi_Yumiaoya12: the '
        + 'archive writes the closing line as two, so the whole-slice count never matched and the bound slept)',
      fn: async () => {
        const found = compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED,
          pageText: [
            '> And in case I don’t see the cat, good morning.',
            '>',
            '> From *The Cat Show*',
            '',
            'All right, cat.',
            'Sleep now.',
          ].join('\n',),
        },);
        expect(found.length,).toBe(1,);
        expect(found[0],).toContain('once in Chinese and once in English',);
      },
    },),
    it({
      name: 'STAYS SILENT where the rendering reworded both English lines of the quote, since the block holding a pair '
        + 'can no longer be found; reworded on one line only, the other pair still names the block',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED
            .replace('And in case I don’t see the cat', 'And should I not see the cat',)
            .replace('From *The Cat Show*', 'Taken from *The Cat Show*',),
          pageText: PAGE,
        },).length,).toBe(0,);
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: BILINGUAL,
          candidateText: DOUBLED.replace('And in case I don’t see the cat', 'And should I not see the cat',),
          pageText: PAGE,
        },).length,).toBe(1,);
      },
    },),
    it({
      name: 'STAYS SILENT on a slice with no pair however long the rendering runs, the shortfall check\'s own blind spot kept',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: '猫醒了。\n太阳很暖。',
          candidateText: 'The cat wakes,\nstretching.\nThe sun is warm.',
          pageText: 'The cat wakes.\nThe sun is warm.',
        },).length,).toBe(0,);
      },
    },),
  ],
},);
