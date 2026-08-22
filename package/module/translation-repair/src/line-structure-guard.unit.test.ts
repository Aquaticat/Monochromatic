/**
 * Tests for the fault that names a flattened line-structured rendering.
 *
 * WHAT THESE PIN is the shape the corpus measurement forced. The recorded
 * prescription was a line-count check against the original; measured over the
 * 211 line-structured slices of the pinned corpus, the archive's own English
 * matches its Chinese line for line on only 115, and 80 of the 96 that differ
 * carry MORE lines, because an English rendering of Chinese verse legitimately
 * expands. So the check names a SHORTFALL and nothing else, and the case that
 * proves it is the one accepting a longer rendering.
 *
 * The blind spot has a test of its own rather than a comment, so a later
 * instrument that closes it fails here and has to say so.
 *
 * Fixtures are cat-themed invention, with the original in Simplified Chinese as
 * every source in this corpus is. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { compareLineCounts, } from '../dist/final/node/index.mjs';

/**
 * One original whose six lines each stand as a unit.
 */
const ORIGINAL = [
  '猫醒了。',
  '太阳很暖。',
  '',
  '它数鸟。',
  '又数一遍。',
  '',
  '门开了。',
  '它不动。',
].join('\n',);

/**
 * Rendering that kept every line apart, as the rule asks.
 */
const KEPT_APART = [
  'The cat wakes.',
  'The sun is warm.',
  '',
  'She counts birds.',
  'She counts again.',
  '',
  'A door swings.',
  'She does not move.',
].join('\n',);

/**
 * Rendering that merged each pair into one line, which is the fault.
 */
const MERGED = [
  'The cat wakes. The sun is warm.',
  '',
  'She counts birds. She counts again.',
  '',
  'A door swings. She does not move.',
].join('\n',);

await describe({
  name: compareLineCounts.name,
  children: [
    it({
      name:
        'SAYS NOTHING ABOUT AN UNGOVERNED SLICE, even one whose rendering merged every line. Prose '
        + 'has no line-per-unit rule to break, and the semantic wrap still runs there, so a finding '
        + 'here would refuse renderings the pipeline goes on to wrap correctly',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: false,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'NAMES A GOVERNED RENDERING THAT MERGED LINES, which is the whole fault. The wrap used to '
        + 'paper over this and could not: it splits at semantic boundaries and never joins, so over '
        + 'the 116 governed slices with multi-line blocks, wrapping a flattened passage returned only '
        + '3 exactly and 290 of 740 original lines',
      fn: async () => {
        const found = compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },);

        expect(found.length,).toBe(1,);
      },
    },),

    it({
      name:
        'COUNTS BOTH SIDES IN THE FINDING and restates the rule, because a send-back is the model\'s '
        + 'only instruction on its second turn: it is told what it owes, what it wrote, and that the '
        + 'wording it chose is not what is being refused',
      fn: async () => {
        const [finding,] = compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: MERGED,
        },);

        expect(finding?.includes('3 lines',),).toBe(true,);
        expect(finding?.includes('6',),).toBe(true,);
        expect(finding?.includes('LINE-STRUCTURED',),).toBe(true,);
      },
    },),

    it({
      name:
        'ACCEPTS A RENDERING CARRYING MORE LINES THAN ITS ORIGINAL, and this case is why the check '
        + 'is not an equality. 80 of the 211 governed slices in the pinned corpus have English '
        + 'carrying more lines than the Chinese; an equality check would send back nearly half of '
        + 'every governed rendering, on text nobody faulted',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: `${KEPT_APART}\nShe sleeps once more.`,
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'ACCEPTS A RENDERING THAT KEPT EVERY LINE APART, which is what the rule asks for',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: KEPT_APART,
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'IGNORES BLANK LINES ON BOTH SIDES, since they separate blocks rather than carry text. A '
        + 'rendering that writes a different number of them has merged nothing, and faulting it would '
        + 'name a difference the line rule never spoke about',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: KEPT_APART.replaceAll('\n\n', '\n\n\n',),
        },).length,).toBe(0,);
      },
    },),

    it({
      name:
        'ACCEPTS A RENDERING THAT MERGED IN ONE BLOCK AND SPLIT IN ANOTHER, which is this check\'s '
        + 'one blind spot, pinned here rather than left in a comment. The count is over the whole '
        + 'slice, so the two cancel. Closing it needs per-block alignment, a larger instrument than '
        + 'the flattening this was built to catch, and an instrument that does close it should fail '
        + 'this case and say so',
      fn: async () => {
        expect(compareLineCounts({
          lineStructured: true,
          sourceText: ORIGINAL,
          candidateText: [
            'The cat wakes. The sun is warm.',
            '',
            'She counts birds.',
            'She counts again.',
            '',
            'A door swings.',
            'She does',
            'not move.',
          ].join('\n',),
        },).length,).toBe(0,);
      },
    },),
  ],
},);
