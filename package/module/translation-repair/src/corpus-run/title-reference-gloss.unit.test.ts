/**
 A title reference the page renders as English with the Han title in
 parentheses after it (`Title (标题)`): the run before the gloss, read back
 to a boundary, carries the title and any words leading into it.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { unifyTitleReferences, } from '../../dist/final/node/index.mjs';
import {
  pair,
  textsOf,
} from './title-reference.test-fixture.ts';

/**
 Heading the references point at.
 */
const HEADING = pair({
  sliceIndex: 0,
  source: '### 午后猫语',
  target: '',
},);

/**
 Rendering of that heading.
 */
const HEADING_ROW = {
  sliceIndex: 0,
  replacementText: '### Afternoon Cat Murmurs',
} as const;

/**
 Original credit bracketing the title.
 */
const CREDIT = pair({
  sliceIndex: 1,
  source: '—— 云猫【梦】《午后猫语》',
  target: '',
},);

/**
 Whose rendering a reference to the heading takes, as the findings name it.
 */
const WHOSE = '「午后猫语」 rendered by the heading of slice 0 as "Afternoon Cat Murmurs"';

/**
 Page after the pass over the heading and one credit.

 @param credit - page text of the credit

 @returns Rows and findings

 @example
 ```ts
 const unified = passOver({ credit: '—— Yunmao, Cat Talk (午后猫语)', },);
 ```
 */
function passOver({ credit, }: { readonly credit: string; },): ReturnType<typeof unifyTitleReferences> {
  return unifyTitleReferences({
    slices: [
      HEADING,
      CREDIT,
    ],
    replacements: [
      HEADING_ROW,
      {
        sliceIndex: 1,
        replacementText: credit,
      },
    ],
  },);
}

await describe({
  name: `${unifyTitleReferences.name} over glossed references`,
  children: [
    it({
      name: 'KEEPS A SMALL-LETTER LEAD-IN WORD AHEAD OF THE TITLE (ledger B58): "from" stays and the title after it '
        + 'takes the heading\'s rendering',
      fn: async () => {
        /**
         Pass over a credit whose glossed run leads in with one word.
         */
        const unified = passOver({ credit: '—— Yunmao, from Afternoon Cat Talk (午后猫语)', },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          '—— Yunmao, from Afternoon Cat Murmurs (午后猫语)',
        ],);
        expect(unified.findings,).toEqual([
          `title-reference-unified (slice 1: "Afternoon Cat Talk" to "Afternoon Cat Murmurs"; ${WHOSE})`,
        ],);
      },
    },),
    it({
      name: 'KEEPS A LEAD-IN OF SEVERAL SMALL-LETTER WORDS (ledger B58): "sung in" stays',
      fn: async () => {
        /**
         Pass over a credit whose glossed run leads in with two words.
         */
        const unified = passOver({ credit: '—— Yunmao, sung in Afternoon Cat Talk (午后猫语)', },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          '—— Yunmao, sung in Afternoon Cat Murmurs (午后猫语)',
        ],);
      },
    },),
    it({
      name: 'STANDS ASIDE WHERE THE RUN HAS MORE WORDS THAN THE HEADING\'S RENDERING (ledger B58): a capitalized '
        + 'lead-in cannot be told from the title, so "From" is reported, not rewritten away',
      fn: async () => {
        /**
         Credit opening its glossed run with a capitalized lead-in word.
         */
        const credit = '——From Afternoon Cat Talk (午后猫语)';
        /**
         Pass over that credit.
         */
        const unified = passOver({ credit, },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          credit,
        ],);
        expect(unified.findings,).toEqual([
          `title-reference-ambiguous (slice 1: ${WHOSE}, but the glossed run reads as more than the title)`,
        ],);
      },
    },),
    it({
      name: 'STANDS ASIDE WHERE EVERY WORD OF THE RUN STARTS WITH A SMALL LETTER (ledger B58), since no word opens '
        + 'the title',
      fn: async () => {
        /**
         Credit rendering the title in small letters only.
         */
        const credit = '—— Yunmao, wu hou mao yu (午后猫语)';
        /**
         Pass over that credit.
         */
        const unified = passOver({ credit, },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          credit,
        ],);
        expect(unified.findings,).toEqual([
          `title-reference-ambiguous (slice 1: ${WHOSE}, but every word of the glossed run starts with a small letter, `
          + 'so where its title starts cannot be read)',
        ],);
      },
    },),
    it({
      name: 'READS A WORD OPENING WITH A DIGIT AS THE TITLE\'S FIRST (ledger B58): no small letter, no lead-in',
      fn: async () => {
        /**
         Pass over a credit whose glossed run opens with a digit.
         */
        const unified = passOver({ credit: '—— Yunmao, 9 Cat Talks (午后猫语)', },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          '—— Yunmao, Afternoon Cat Murmurs (午后猫语)',
        ],);
      },
    },),
    it({
      name: 'READS EVERY GLOSS OF THE TITLE IN A SLICE (ledger B59): each names the title, so a second credit is '
        + 'unified with the first',
      fn: async () => {
        /**
         Pass over a slice crediting the title twice, each credit glossing it.
         */
        const unified = unifyTitleReferences({
          slices: [
            HEADING,
            pair({
              sliceIndex: 1,
              source: '—— 云猫《午后猫语》\n\n—— 雨猫《午后猫语》',
              target: '',
            },),
          ],
          replacements: [
            HEADING_ROW,
            {
              sliceIndex: 1,
              replacementText: '—— Yunmao, Afternoon Cat Talk (午后猫语)\n\n—— Yumao, Cat Chatter (午后猫语)',
            },
          ],
        },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          '—— Yunmao, Afternoon Cat Murmurs (午后猫语)\n\n—— Yumao, Afternoon Cat Murmurs (午后猫语)',
        ],);
        expect(unified.findings,).toEqual([
          `title-reference-unified (slice 1: "Afternoon Cat Talk" to "Afternoon Cat Murmurs"; ${WHOSE})`,
          `title-reference-unified (slice 1: "Cat Chatter" to "Afternoon Cat Murmurs"; ${WHOSE})`,
        ],);
      },
    },),
  ],
},);
