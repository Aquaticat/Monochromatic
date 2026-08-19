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
  quotedTranscript,
  readingAnchors,
  readingMakesSense,
  sharedAnchorCount,
} from '../dist/final/node/index.mjs';

await describe({
  name: readingAnchors.name,
  children: [
    it({
      name: 'KEEPS THE PARTS THAT SURVIVE PARAPHRASE, dates and handles and addresses, since two '
        + 'readings of one picture share those even when every sentence around them differs',
      fn: async () => {
        /**
         * Anchors of a short profile.
         */
        const anchors = readingAnchors({ text: 'Adopted 2019, handle @mittensdaily.', },);

        expect(anchors.has('2019',),).toBe(true,);
        expect(anchors.has('mittensdaily',),).toBe(true,);
      },
    },),

    it({
      name: 'DROPS RUNS TOO SHORT TO IDENTIFY ANYTHING, so a reading and a transcript sharing only '
        + 'the word "the" are not taken to describe one picture',
      fn: async () => {
        /**
         * Anchors of a sentence carrying no identifiers.
         */
        const anchors = readingAnchors({ text: 'The cat sat on the mat by it.', },);

        expect(anchors.has('the',),).toBe(false,);
        expect(anchors.has('cat',),).toBe(false,);
        expect(anchors.has('mat',),).toBe(false,);
      },
    },),

    it({
      name: 'SEPARATES A DIGIT RUN FROM THE LETTERS BESIDE IT, so a version and a word touching it '
        + 'are two anchors rather than one string neither text would repeat',
      fn: async () => {
        const anchors = readingAnchors({ text: 'photo2019webp', },);
        expect(anchors.has('photo',),).toBe(true,);
        expect(anchors.has('2019',),).toBe(true,);
        expect(anchors.has('webp',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: sharedAnchorCount.name,
  children: [
    it({
      name: 'COUNTS WHAT TWO READINGS OF ONE PICTURE HAVE IN COMMON, which stays high through '
        + 'rewording because the identifiers do not reword',
      fn: async () => {
        expect(sharedAnchorCount({
          left: 'Her name was Mittens. She was adopted in 2019.',
          right: '> Name: Mittens.\n> Adopted 2019.',
        },),).toBeGreaterThanOrEqual(2,);
      },
    },),

    it({
      name: 'FINDS NOTHING IN COMMON between readings of different pictures, which is the whole '
        + 'signal: a reading of the wrong image shares no dates and no handles',
      fn: async () => {
        expect(sharedAnchorCount({
          left: 'A screenshot of a train timetable, platform 9 at 14:05.',
          right: '> Name: Mittens.\n> Handle @mittensdaily.',
        },),).toBe(0,);
      },
    },),
  ],
},);

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
      name: 'REFUSES A READING TOO SHORT TO BE A TRANSCRIPT, since an image nobody could read '
        + 'comes back as an apology or as nothing and both are shorter than any transcript',
      fn: async () => {
        /**
         * What the rule decided.
         */
        const verdict = readingMakesSense({ reading: '   a cat   ', },);

        expect(verdict.kind,).toBe('refused',);
        if (verdict.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(verdict.clause,).toBe('too-short',);
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

await describe({
  name: quotedTranscript.name,
  children: [
    it({
      name: 'TAKES THE QUOTED BLOCKS AND NOTHING ELSE, reading a passage the same way the deletion '
        + 'guard does, so the two never disagree about what a transcript is',
      fn: async () => {
        expect(quotedTranscript({
          text: 'Her notes read:\n\n> Name: Mittens.\n\nShe kept them by the door.',
        },),).toBe('> Name: Mittens.',);
      },
    },),

    it({
      name: 'REPORTS NOTHING for a passage carrying no quotation, which is what an archive that '
        + 'never transcribed the picture looks like',
      fn: async () => {
        expect(quotedTranscript({ text: 'She kept notes by the door.', },),).toBe('',);
      },
    },),
  ],
},);
