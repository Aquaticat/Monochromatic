/**
 A title reference the original writes as a link (`《[title](url)》`), found
 on the page by the link's destination. Cat-themed invention throughout; no
 corpus content appears here.

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
  source: '### 窗边猫',
  target: '',
},);

/**
 Rendering of that heading.
 */
const HEADING_ROW = {
  sliceIndex: 0,
  replacementText: '### Cat by the Window',
} as const;

/**
 Finding for a reference the pass found no span for.
 */
const UNPLACED = 'title-reference-unplaced (slice 1: 「窗边猫」 rendered by the heading of slice 0 as "Cat by the Window", '
  + 'no linked, glossed, bracketed or quoted span found)';

await describe({
  name: `${unifyTitleReferences.name} over linked references`,
  children: [
    it({
      name: 'READS NO LINK TEXT ACROSS A LINE (ledger B57): a page link that lost its opening bracket below a footnote '
        + 'line leaves the footnote whole',
      fn: async () => {
        /**
         Page text whose link lost its opening bracket.
         */
        const page = '[^1]: A cat.\n\n——From The Window Cat](https://example.test/cat)';
        /**
         Pass over the heading and that page.
         */
        const unified = unifyTitleReferences({
          slices: [
            HEADING,
            pair({
              sliceIndex: 1,
              source: '[^1]: 一只猫。\n\n——出自《[窗边猫](https://example.test/cat)》',
              target: '',
            },),
          ],
          replacements: [
            HEADING_ROW,
            {
              sliceIndex: 1,
              replacementText: page,
            },
          ],
        },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          page,
        ],);
        expect(unified.findings,).toEqual([UNPLACED,],);
      },
    },),
    it({
      name: 'READS NO LINK TEXT PAST ANOTHER LINK\'S BRACKET (ledger B57): a page link that lost its opening bracket '
        + 'after an earlier link on its line leaves that link whole',
      fn: async () => {
        /**
         Page text whose second link lost its opening bracket.
         */
        const page = 'See [cat](https://example.test/a) and The Window Cat](https://example.test/cat)';
        /**
         Pass over the heading and that page.
         */
        const unified = unifyTitleReferences({
          slices: [
            HEADING,
            pair({
              sliceIndex: 1,
              source: '见[猫](https://example.test/a)与《[窗边猫](https://example.test/cat)》',
              target: '',
            },),
          ],
          replacements: [
            HEADING_ROW,
            {
              sliceIndex: 1,
              replacementText: page,
            },
          ],
        },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          page,
        ],);
        expect(unified.findings,).toEqual([UNPLACED,],);
      },
    },),
    it({
      name: 'READS NO LINK where no opening bracket stands before the destination on the page',
      fn: async () => {
        /**
         Page text carrying the destination with no bracket before it.
         */
        const page = '——From The Window Cat](https://example.test/cat)';
        /**
         Pass over the heading and that page.
         */
        const unified = unifyTitleReferences({
          slices: [
            HEADING,
            pair({
              sliceIndex: 1,
              source: '——出自《[窗边猫](https://example.test/cat)》',
              target: '',
            },),
          ],
          replacements: [
            HEADING_ROW,
            {
              sliceIndex: 1,
              replacementText: page,
            },
          ],
        },);
        expect(textsOf({ rows: unified.replacements, },),).toEqual([
          HEADING_ROW.replacementText,
          page,
        ],);
        expect(unified.findings,).toEqual([UNPLACED,],);
      },
    },),
  ],
},);
