/**
 Tests for the tag-and-attribute reader.
 Fixtures are cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { readTags, } from '../../dist/final/node/index.mjs';

/**
 Whole reading of the one readable tag every case puts first.
 */
const CAT_READING = {
  name: 'Cat',
  text: '<Cat n="1"/>',
  start: 0,
  end: 12,
  attributes: [{ name: 'n', value: '1', valueStart: 8, valueEnd: 9, },],
};

await describe({
  name: readTags.name,
  children: [
    it({
      name: 'READS NO TAG out of a bracket that opens no letter, since a tag name starts with one',
      fn: async () => {
        expect(readTags({ text: '<Cat n="1"/> then </Paw> and <3', },),).toEqual([CAT_READING,],);
      },
    },),

    it({
      name: 'READS NO TAG out of a name cut off at the end of the text, since no close bracket ever follows',
      fn: async () => {
        expect(readTags({ text: '<n', },),).toEqual([],);
      },
    },),

    it({
      name: 'READS the tag and LEAVES a bare attribute with no equals out of its reading, since a name '
        + 'alone states no value',
      fn: async () => {
        expect(readTags({ text: '<Paw x>', },),).toEqual([{
          name: 'Paw',
          text: '<Paw x>',
          start: 0,
          end: 7,
          attributes: [],
        },],);
      },
    },),

    it({
      name: 'READS NO TAG out of one whose attribute starts where no name may, keeping the readable tag '
        + 'before it',
      fn: async () => {
        expect(readTags({ text: '<Cat n="1"/> then <Paw !>', },),).toEqual([CAT_READING,],);
      },
    },),

    it({
      name: 'READS NO TAG out of one whose attribute value carries no quote, keeping the readable tag '
        + 'before it',
      fn: async () => {
        expect(readTags({ text: '<Cat n="1"/> then <Paw n=5>', },),).toEqual([CAT_READING,],);
      },
    },),

    it({
      name: 'READS NO TAG out of one whose quoted value never closes, keeping the readable tag before '
        + 'it',
      fn: async () => {
        expect(readTags({ text: '<Cat n="1"/> then <Paw n="5>', },),).toEqual([CAT_READING,],);
      },
    },),
  ],
},);
