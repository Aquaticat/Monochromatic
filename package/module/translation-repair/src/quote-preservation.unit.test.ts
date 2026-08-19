/**
 * Tests for the guard that stops an edit deleting a quoted passage.
 *
 * WHY THIS QUESTION AND NOT THE OTHER ONE. The harm is that a lane writing from
 * the source alone deletes English the source cannot account for, and the
 * obvious response is to work out which passages those are. That is not cheaply
 * decidable: translation changes bytes by construction, so no exact match
 * separates an unpaired passage from an ordinary translated one. Deletion, on
 * the other hand, is decidable from the two texts alone, and measured over both
 * settled pools it caught four real losses and nothing else in sixty-nine
 * natural rows.
 *
 * THE CARRIAGE-RETURN CASE IS NOT DEFENSIVENESS. One of the 184 markdown files
 * in the pinned corpus uses CRLF throughout. A splitter looking for two bytes
 * `\n\n` finds no boundary there, reads the whole document as one block, and
 * counts zero quotes, which is worse than an error because a guard counting
 * zero reports nothing wrong.
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

import {
  dropsQuotedPassage,
  quoteBlockCount,
  quoteLossRefusalFinding,
  topLevelBlocks,
} from '../dist/final/node/index.mjs';

await describe({
  name: topLevelBlocks.name,
  children: [
    it({
      name: 'SPLITS ON BLANK LINES and keeps no empty blocks, which is the shape every guard '
        + 'reading this asks its question about',
      fn: async () => {
        expect(topLevelBlocks({ text: 'One.\n\nTwo.\n\n\n\nThree.', },).length,).toBe(3,);
        expect(topLevelBlocks({ text: '', },).length,).toBe(0,);
      },
    },),

    it({
      name: 'READS A CARRIAGE-RETURN FILE, which one corpus file is: a splitter looking for two '
        + 'bytes of newline finds no boundary there, reads the document as ONE block, and counts '
        + 'zero quotes, so a guard built on it reports nothing wrong about anything',
      fn: async () => {
        expect(topLevelBlocks({ text: 'One.\r\n\r\nTwo.\r\n\r\nThree.', },).length,).toBe(3,);
        expect(quoteBlockCount({ text: '> She said so.\r\n\r\nAnd then left.', },),).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: quoteBlockCount.name,
  children: [
    it({
      name: 'COUNTS BLOCKS RATHER THAN LINES, so a lane may reflow a quotation freely and only '
        + 'losing a whole quoted passage counts against it',
      fn: async () => {
        /**
         * One quotation across three lines.
         */
        const wrapped = '> The cat sat.\n> Then she left.\n> Then she came back.';
        expect(quoteBlockCount({ text: wrapped, },),).toBe(1,);

        /**
         * The same words on one line.
         */
        expect(quoteBlockCount({ text: '> The cat sat. Then she left. Then she came back.', },),).toBe(1,);
      },
    },),

    it({
      name: 'COUNTS EACH SEPARATE QUOTATION, since a passage carrying two is a passage a reader '
        + 'would miss either of',
      fn: async () => {
        expect(quoteBlockCount({
          text: '> Mittens spoke.\n\nShe paused.\n\n> Then Whiskers did.',
        },),).toBe(2,);
      },
    },),
  ],
},);

await describe({
  name: dropsQuotedPassage.name,
  children: [
    it({
      name: 'REFUSES A REPLACEMENT THAT DELETES A QUOTED PASSAGE, which is the whole point: the '
        + 'lost blocks in the measured cases were transcripts of images, written by a person, with '
        + 'no original to regenerate them from',
      fn: async () => {
        expect(dropsQuotedPassage({
          incumbentText: 'Her notes read:\n\n> Name: Mittens.\n> Likes: sunbeams.',
          shippedText: 'Her notes read as follows.',
        },),).toBe(true,);
      },
    },),

    it({
      name: 'ACCEPTS A REPLACEMENT THAT KEEPS THE QUOTATION, however much it rewords the prose '
        + 'around it, since rewording is what this lane is for',
      fn: async () => {
        expect(dropsQuotedPassage({
          incumbentText: 'Her notes read:\n\n> Name: Mittens.',
          shippedText: 'What she wrote was this:\n\n> Name is Mittens.',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS A REPLACEMENT THAT ADDS ONE, because a passage the archive never quoted and '
        + 'the original does is exactly the gap this lane exists to close',
      fn: async () => {
        expect(dropsQuotedPassage({
          incumbentText: 'She left a note.',
          shippedText: 'She left a note:\n\n> Feed the cat.',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS PROSE FOR PROSE, so an edit that removes an invented paragraph is untouched '
        + 'by this guard: one lane correctly cut a paragraph of translator invention with nine '
        + 'accepted findings against it, and that cut was not a quotation',
      fn: async () => {
        expect(dropsQuotedPassage({
          incumbentText: 'She naps.\n\nA florid paragraph nobody wrote.',
          shippedText: 'She naps.',
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: quoteLossRefusalFinding.name,
  children: [
    it({
      name: 'NAMES THE SLICE AND BOTH COUNTS, so a corpus-wide reading can separate this refusal '
        + 'from the alignment one rather than counting them together',
      fn: async () => {
        /**
         * Sentence a run's findings would carry.
         */
        const finding = quoteLossRefusalFinding({
          chunkIndex: 4,
          incumbentText: '> Mittens.\n\n> Whiskers.',
          shippedText: '> Mittens.',
        },);

        expect(finding.includes('refused-quote-loss',),).toBe(true,);
        expect(finding.includes('slice 4',),).toBe(true,);
        expect(finding.includes('2',),).toBe(true,);
      },
    },),
  ],
},);
