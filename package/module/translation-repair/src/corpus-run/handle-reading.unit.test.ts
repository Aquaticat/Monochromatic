/**
 Guards class eighty-three's reading of a handle the archive never rendered
 (XingZ622, 2026-09-22). Owner, 2026-09-22: pinyin in syllable groups, never
 one joined word ("Jiecheng Tianzou" or "Jie Cheng Tian Zou" are fine,
 "Jiechengtianzou" is not); the reading pairs the syllables, capitalised,
 a lone trailing syllable standing by itself. Cat-themed invention
 throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  carriesRendering,
  handleReading,
  withoutGloss,
} from '../../dist/final/node/index.mjs';

await describe({
  name: 'a handle the archive never rendered is read as pinyin in syllable groups (class eighty-three, XingZ622)',
  children: [
    it({
      name: 'READS two syllables as one capitalised group',
      fn: async () => {
        expect(handleReading({ name: '锦猫', },),).toBe('Jinmao',);
      },
    },),
    it({
      name: 'READS four syllables as two capitalised groups, never one joined word (owner 2026-09-22: '
        + '"Jiechengtianzou is not fine")',
      fn: async () => {
        expect(handleReading({ name: '洁澄天猫', },),).toBe('Jiecheng Tianmao',);
      },
    },),
    it({
      name: 'LEAVES a lone trailing syllable standing by itself',
      fn: async () => {
        expect(handleReading({ name: '雨猫花', },),).toBe('Yumao Hua',);
      },
    },),
    it({
      name: 'KEEPS Latin letters the original writes against the handle, a space apart from the reading',
      fn: async () => {
        expect(handleReading({ name: '洁澄天猫Official', },),).toBe('Jiecheng Tianmao Official',);
        expect(handleReading({ name: '白猫 suki', },),).toBe('Baimao suki',);
        expect(handleReading({ name: 'Mikä', },),).toBe('Mikä',);
      },
    },),
    it({
      name: 'ACCEPTS a rendering carrying its literal meaning in parentheses as the rendering itself',
      fn: async () => {
        expect(withoutGloss({ rendering: 'Jinmao (Brocade Cat)', },),).toBe('Jinmao',);
        expect(carriesRendering({
          written: 'Jinmao (Brocade Cat)',
          rendering: 'Jinmao',
        },),).toBe(true,);
        expect(carriesRendering({
          written: 'Jin Mao',
          rendering: 'Jinmao',
        },),).toBe(false,);
      },
    },),
  ],
},);
