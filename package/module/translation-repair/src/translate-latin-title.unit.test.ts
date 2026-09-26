/**
 Guards class one hundred forty-one (XingZ6012, 2026-09-26): the second song
 credit shipped "— Yuli【妄想症Paranoia】《Zero-Layer Prayer》", an English title
 inside the Chinese title marks. 《》 carry no meaning in English prose, where
 a work's title stands in quotation marks, so a candidate that brackets a
 title with no Han in 《》 is refused before any judge reads it, unless the
 page it would replace writes the same bracketed title.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original crediting a song by its Han title.
 */
const CREDIT = '<p style="text-align: end;">—— 猫猫《喵喵歌》</p>';

/**
 Original naming a poem by its own English title in title marks.
 */
const ENGLISH_TITLE = '她最爱的诗是《Cats Are Liquid》。';

await describe({
  name: 'an English title left in 《》 (class one hundred forty-one)',
  children: [
    it({
      name: 'REFUSES a translated title bracketed in 《》',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CREDIT,
          candidateText: '<p style="text-align: end;">— Maomao 《Meow Song》</p>',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS the translated title in quotation marks',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: CREDIT,
          candidateText: '<p style="text-align: end;">— Maomao, “Meow Song”</p>',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'REFUSES the original\'s own English title kept in 《》',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ENGLISH_TITLE,
          candidateText: 'Her favourite poem was 《Cats Are Liquid》.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS a bracketed English title the page itself writes',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: ENGLISH_TITLE,
          candidateText: 'Her favourite poem was 《Cats Are Liquid》.',
          pageText: 'Her favourite poem is 《Cats Are Liquid》.',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'ACCEPTS a bracketed title that keeps Han beside its Latin letters',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '她最爱的游戏是《喵萌DX》。',
          candidateText: 'Her favourite game was 《喵萌DX》 (Meowmeow DX).',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
