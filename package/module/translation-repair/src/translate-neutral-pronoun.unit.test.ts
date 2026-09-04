/**
 * Tests for the floor rule refusing a translation that keeps the corpus's
 * neutral pronoun in Latin letters.
 *
 * WHAT THESE PIN: every spelling the sources use counts; the letters inside a
 * word, a handle, a path or an address do not; an apostrophe or a han
 * character beside the pronoun still leaves it a word of its own; the finding
 * names each spelling with its count and says what English renders it as; a
 * candidate carrying none yields nothing.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { neutralPronounFindings, } from '../dist/final/node/index.mjs';

await describe({
  name: neutralPronounFindings.name,
  children: [
    it({
      name: 'stays quiet on a translation that renders the pronoun, which is the case that must not fire',
      fn: async () => {
        expect(neutralPronounFindings({
          candidateText: 'They dozed on the windowsill, and their tail hung down. We set a room for them.',
        },),).toStrictEqual([],);
        expect(neutralPronounFindings({ candidateText: '', },),).toStrictEqual([],);
      },
    },),

    it({
      name: 'NAMES each spelling kept and its count, in the order TA, Ta, ta',
      fn: async () => {
        const findings = neutralPronounFindings({
          candidateText: 'TA dozed. Then Ta woke, and ta stretched; Ta purred.',
        },);

        expect(findings.length,).toBe(1,);
        expect(findings[0],).toContain('untranslated as "TA" (1 time) and "Ta" (2 times) and "ta" (1 time)',);
        expect(findings[0],).toContain('English renders it as singular they (they, them, their)',);
      },
    },),

    it({
      name: 'COUNTS the pronoun beside an apostrophe, a comma, a quotation mark or a han character, '
        + 'since none of those makes it part of a longer word',
      fn: async () => {
        const findings = neutralPronounFindings({
          candidateText: 'A room for Ta, to give Ta\'s memorial warmth. “Ta” 的 (Ta)',
        },);

        expect(findings[0],).toContain('"Ta" (4 times)',);
      },
    },),

    it({
      name: 'IGNORES the letters inside a word, a handle, a path segment, an address or a hyphenated '
        + 'form, which are what a bare word-boundary check would have counted',
      fn: async () => {
        expect(neutralPronounFindings({
          candidateText: 'DATA and STATION stay with @ta_cat at https://example.org/ta/ and meta.ta, ta-da, ta9.',
        },),).toStrictEqual([],);
      },
    },),
  ],
},);
