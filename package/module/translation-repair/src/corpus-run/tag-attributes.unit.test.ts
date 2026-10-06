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
import {
  grammarAcceptsDocument,
  tagNameSpellings,
} from '../tag-name-spellings.test-fixture.ts';

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
      name: 'READS A TAG EXACTLY WHERE THE STRICT GRAMMAR READS ITS NAME, over every spelling of the differential '
        + 'set, so a name starting with `$`, `_` or a letter of another script is read and a name holding a '
        + 'character the grammar refuses, or ending on a separator, is not',
      fn: async () => {
        /**
         Spellings the reader and the grammar disagree on, as the self-closing tag a page may carry.
         */
        const disagreeing = tagNameSpellings()
          .filter(function disagrees(name,): boolean {
            return grammarAcceptsDocument({ document: `<${name} n="1"/>\n`, },)
              !== (readTags({ text: `<${name} n="1"/>\n`, },).length === 1);
          },);
        expect(disagreeing,).toEqual([],);
      },
    },),

    it({
      name: 'READS THE NAME OF A MEMBER OR PREFIXED TAG WITHOUT THE WHITESPACE AROUND ITS SEPARATOR, so the page\'s '
        + 'tag and the archive\'s name one element however each spaces it',
      fn: async () => {
        expect(readTags({ text: '<Cat . Paw n="1"/>', },).map(function nameOf({ name, },): string {
          return name;
        },),).toEqual(['Cat.Paw',],);
      },
    },),

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
