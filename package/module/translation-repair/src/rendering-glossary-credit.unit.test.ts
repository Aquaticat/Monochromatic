/**
 Guards class one hundred forty (XingZ6012, 2026-09-26): the original credits
 a song with 「——来自《title》，作者 handle」 and the page shipped
 "——from “title”, author handle", the 作者 of a credit line rendered word for
 word. An English credit names its maker with "by". The rendering glossary
 seeds the credit form (the comma before 作者, so 工作者 and a sentence whose
 subject is the author stay out of it) and refuses ", author ".

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  RENDERING_GLOSSARY,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original crediting a song to its maker.
 */
const CREDIT = '<p style="text-align: end;">——来自《毛线球》，作者 猫猫Official</p>';

/**
 Original footnote whose subject is the author, which the seeded form never reads as a credit.
 */
const AUTHOR_SENTENCE = '原文如此，作者可能想写的是毛线球。';

await describe({
  name: 'a credit line\'s 作者 the rendering glossary refuses word for word (class one hundred forty)',
  children: [
    it({
      name: 'SEEDS the credit form ，作者',
      fn: async () => {
        expect(RENDERING_GLOSSARY.some(function isCredit(entry,): boolean {
          return entry.term === '，作者';
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES "…, author handle" on a credit line',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CREDIT,
          candidateText: '<p style="text-align: end;">——from “Yarn Ball”, author Maomao Official</p>',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS "…, by handle" on a credit line',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CREDIT,
          candidateText: '<p style="text-align: end;">——From “Yarn Ball”, by Maomao Official</p>',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'ACCEPTS a sentence whose subject is the author',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: AUTHOR_SENTENCE,
          candidateText: 'As in the original; the author probably meant to write Yarn Ball.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
