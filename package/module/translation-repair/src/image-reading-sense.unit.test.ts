/**
 * Tests for deciding whether a model's reading of a picture may be used.
 *
 * WHAT THESE PIN is a rule whose two branches cost very different things.
 * Trusting a bad reading licenses replacing a human's careful transcription with
 * something derived from a misreading, and the judges cannot tell, because the
 * reading is the only evidence they are given about the picture. Falling back
 * costs nothing that exists today, since the block is then protected and left
 * alone, which is where every transcript already stands. So the rule is
 * deliberately eager to fall back, and these tests pin that direction rather
 * than a balance.
 *
 * The rule itself is written out in
 * `doc/planning/when-an-image-reading-makes-no-sense.md`.
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
  readingMakesSense,
} from '../dist/final/node/index.mjs';

await describe({
  name: readingMakesSense.name,
  children: [
    it({
      name: 'ACCEPTS A READING LONG ENOUGH TO BE A TRANSCRIPTION AND NOT ANNOUNCING A REFUSAL, '
        + 'which is everything this decides now: whether the picture was read at all. Whether it '
        + 'was the RIGHT picture is settled in `reading-corroboration.ts`, against a second '
        + 'reader rather than against the archive',
      fn: async () => {
        expect(readingMakesSense({
          reading: 'Profile card. Name Mittens, adopted 2019, vet every 6 months, '
            + 'reachable at tabbyhouse@example.org or @mittensdaily.',
        },).kind,).toBe('usable',);
      },
    },),

    it({
      name: 'CALLS A READING UNDER THE TRANSCRIPT LINE SHORT when it refuses nothing, which is what a '
        + 'picture carrying a hull number produces (Uekawakuyuurei img370, DE581 from every reader on '
        + '2026-09-04), and REFUSES one that negates or is empty, since an apology fragment is not a '
        + 'reading of anything',
      fn: async () => {
        expect(readingMakesSense({ reading: 'DE581', },).kind,).toBe('short',);
        expect(readingMakesSense({ reading: '   a cat   ', },).kind,).toBe('short',);
        expect(readingMakesSense({ reading: '   ', },).kind,).toBe('refused',);

        // An apology the phrase list knows is a refusal before its length is
        // looked at; one it does not know, negating, is too short to be anything.
        expect(readingMakesSense({ reading: 'I can\'t.', },).kind,).toBe('refused',);

        /**
         * What the rule decided about an apology fragment the list does not know.
         */
        const verdict = readingMakesSense({ reading: 'None.', },);

        expect(verdict.kind,).toBe('refused',);
        if (verdict.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(verdict.clause,).toBe('too-short',);
      },
    },),

    it({
      name: 'REFUSES AN ABSENCE REPORT UNDER ITS OWN CLAUSE, however short, so the pair stage can count '
        + 'two of them as a textless picture rather than as two readers who declined (Uekawakuyuurei '
        + 'IMG_1308, 2026-09-04: a painting whose canvas passed the OCR gate as 24 characters of noise)',
      fn: async () => {
        for (const reading of [
          'No text.',
          'There is no visible text in this image. It is a painting of ships at sea, and I cannot discern any '
          + 'words, names, signatures, dates, or inscriptions.',
        ]) {
          /**
           * Verdict on an absence report.
           */
          const verdict = readingMakesSense({ reading, },);
          expect(verdict.kind,).toBe('refused',);
          if (verdict.kind !== 'refused')
            throw new Error('refused by construction',);
          expect(verdict.clause,).toBe('reports-no-text',);
        }
      },
    },),

    it({
      name: 'REFUSES A READING THAT ANNOUNCES IT COULD NOT READ, even a long and fluent one, '
        + 'because a model apologising at length is still telling us it has nothing',
      fn: async () => {
        /**
         * What the rule decided about a fluent apology.
         */
        const verdict = readingMakesSense({
          reading: 'I cannot make out the text in this image. The photograph appears to show a '
            + 'card of some kind, but the resolution is too low for me to transcribe it reliably.',
        },);

        expect(verdict.kind,).toBe('refused',);
        if (verdict.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(verdict.clause,).toBe('reads-as-refusal',);
      },
    },),

    it({
      name: 'ACCEPTS A READING OF A PICTURE THE ARCHIVE TRANSCRIBED NOWHERE, because refusing '
        + 'there would mean this pipeline could never ADD a transcript it does not already have, '
        + 'which is half of what the image is being sent for',
      fn: async () => {
        expect(readingMakesSense({
          reading: 'A handwritten note reading: feed the cat at seven, she waits by the door.',
        },).kind,).toBe('usable',);
      },
    },),

    it({
      name: 'ACCEPTS A READING THAT SHARES NOTHING WITH THE ARCHIVE, the case the clause removed '
        + 'on 2026-08-19 used to refuse. Real traffic measured it rejecting every reading of '
        + 'Mio/7\'s two pictures while the two readers agreed with each other at 0.967 and 1.000 '
        + 'character overlap: the slice\'s target-only English was simply not a transcription of '
        + 'either picture',
      fn: async () => {
        expect(readingMakesSense({
          reading: 'A photograph of a railway timetable, platform 9, departures at 14:05 and 16:20.',
        },).kind,).toBe('usable',);
      },
    },),
  ],
},);
