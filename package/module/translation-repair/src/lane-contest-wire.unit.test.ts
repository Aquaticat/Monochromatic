/**
 * Tests for how a judge's reply becomes a ballot.
 *
 * WHAT THIS FILE EXISTS TO STOP. The findings guard once demanded that every
 * member of `unsupported` and `dropped` name a candidate, so a judge answering
 * with the offending phrases lost its entire ballot, including a choice that
 * was perfectly usable. Calibration lost two of its first sixty voices that
 * way. The choice is the thing the contest counts, so the wording of a finding
 * may never cost a voice.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildLaneContestMessages,
  isLaneContestWire,
  readLaneContestBallot,
} from '../dist/final/node/index.mjs';

await describe({
  name: isLaneContestWire.name,
  children: [
    it({
      name: 'ACCEPTS findings written as phrases rather than candidate names',
      fn: async () => {
        // THE REGRESSION. This exact shape arrived from a real judge, carrying
        // `choice: "repair"`, and was thrown away whole.
        expect(isLaneContestWire({
          choice: 'repair',
          unsupported: [ 'napping in the sun', 'a second bowl', ],
          dropped: [ 'Although', ],
          reason: 'the translate candidate invents an afternoon',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'ACCEPTS a candidate name carrying its own annotation',
      fn: async () => {
        expect(isLaneContestWire({
          choice: 'neither',
          unsupported: [ 'repair (changes the bowl to a saucer)', ],
          dropped: [],
          reason: 'both stray',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'REFUSES a reply whose findings are not a list of strings',
      fn: async () => {
        // SHAPE IS STILL ENFORCED. Loosening the vocabulary check must not
        // loosen the shape check, or the reader receives values it cannot read.
        expect(isLaneContestWire({
          choice: 'repair',
          unsupported: [ 7, ],
          dropped: [],
          reason: 'x',
        },),).toBe(false,);
        expect(isLaneContestWire({
          choice: 'repair',
          unsupported: 'napping',
          dropped: [],
          reason: 'x',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a reply naming a candidate that does not exist',
      fn: async () => {
        expect(isLaneContestWire({
          choice: 'incumbent',
          unsupported: [],
          dropped: [],
          reason: 'x',
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: readLaneContestBallot.name,
  children: [
    it({
      name: 'READS an annotated candidate name as blaming that candidate',
      fn: async () => {
        const ballot = readLaneContestBallot({
          wire: {
            choice: 'translate',
            unsupported: [ 'repair (invents an afternoon in the sun)', ],
            dropped: [],
            reason: 'the original says only that the cat slept',
          },
        },);
        expect(ballot.unsupported,).toEqual([ 'repair', ],);
      },
    },),
    it({
      name: 'READS a longer word beginning with a candidate name as blaming nobody',
      fn: async () => {
        // `repairing` is a word about repairing, not the name of the repair
        // candidate. A bare prefix test would blame the wrong lane here.
        const ballot = readLaneContestBallot({
          wire: {
            choice: 'neither',
            unsupported: [ 'repairing the fence', 'translated loosely', ],
            dropped: [],
            reason: 'neither is worse',
          },
        },);
        expect(ballot.unsupported,).toEqual([],);
      },
    },),
    it({
      name: 'KEEPS phrase findings verbatim even when they blame no candidate',
      fn: async () => {
        const ballot = readLaneContestBallot({
          wire: {
            choice: 'repair',
            unsupported: [ 'napping in the sun', ],
            dropped: [ 'the second bowl', ],
            reason: 'the translate candidate adds an afternoon',
          },
        },);
        expect(ballot.choice,).toBe('repair',);
        expect(ballot.unsupported,).toEqual([],);
        expect(ballot.unsupportedRaw,).toEqual([ 'napping in the sun', ],);
        expect(ballot.dropped,).toEqual([],);
        expect(ballot.droppedRaw,).toEqual([ 'the second bowl', ],);
      },
    },),
    it({
      name: 'READS repeated blame of one candidate as naming it once',
      fn: async () => {
        const ballot = readLaneContestBallot({
          wire: {
            choice: 'translate',
            unsupported: [ 'repair (adds an afternoon)', 'repair (adds a sunbeam)', ],
            dropped: [],
            reason: 'two inventions from the same candidate',
          },
        },);
        expect(ballot.unsupported,).toEqual([ 'repair', ],);
      },
    },),
    it({
      name: 'READS blame of both candidates in canonical order',
      fn: async () => {
        const ballot = readLaneContestBallot({
          wire: {
            choice: 'neither',
            unsupported: [ 'translate: drops the bowl', 'repair: adds an afternoon', ],
            dropped: [],
            reason: 'both stray',
          },
        },);
        expect(ballot.unsupported,).toEqual([ 'repair', 'translate', ],);
      },
    },),
  ],
},);

await describe({
  name: buildLaneContestMessages.name,
  children: [
    it({
      name: 'SHOWS the declared names, so an attested one is not read as an invention',
      fn: async () => {
        // THE FAILURE THIS CLOSES. Front matter is document-level and this
        // stage sees one slice, so a declared name reaches the judge only if
        // it is put here. Without it the name appears in the archive and in
        // one candidate and nowhere in the original, and calling it unsupported
        // is the correct inference from the wrong evidence.
        const messages = buildLaneContestMessages({
          subject: {
            sourceText: '猫睡了。',
            incumbentText: 'Mittens (Whiskers) slept.',
            repairText: 'Mittens (Whiskers) slept.',
            translateText: 'Mittens slept.',
            identityContext: 'name: 猫猫 / Mittens\nalias: Whiskers',
          },
        },);
        const asked = messages.at(1,)?.content ?? '';
        expect(asked.includes('Whiskers',),).toBe(true,);
        expect(asked.includes('DECLARED NAMES',),).toBe(true,);
      },
    },),
    it({
      name: 'OMITS the block entirely when neither document declares a name',
      fn: async () => {
        // An empty heading would read as "nothing is declared about this
        // person", which is a claim, rather than as an absent section.
        const messages = buildLaneContestMessages({
          subject: {
            sourceText: '猫睡了。',
            incumbentText: 'The cat slept.',
            repairText: 'The cat slept.',
            translateText: 'The cat slept soundly.',
          },
        },);
        expect((messages.at(1,)?.content ?? '').includes('DECLARED NAMES',),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES to call a passage that names nobody a dropped detail',
      fn: async () => {
        // THIS ASSERTION WAS REVERSED, deliberately. It used to require the
        // opposite, that a candidate omitting a declared name HAS dropped
        // something, and that wording was measured causing two failures: a
        // judge abstained from a whole slate because no candidate carried the
        // declared LOCATION, and a shipped rendering signed a note left by a
        // FRIEND of the deceased with the deceased's own name, alias and city.
        // The selection sheet was corrected then; this sheet, which decides
        // which LANE ships, kept the old wording and this test held it there.
        const policy = buildLaneContestMessages({
          subject: {
            sourceText: '猫睡了。',
            incumbentText: 'x',
            repairText: 'y',
            translateText: 'z',
          },
        },).at(0,)?.content ?? '';
        expect(policy.includes('DECLARED NAMES ARE ATTESTED FACTS',),).toBe(true,);
        expect(policy.includes('HAS dropped something',),).toBe(false,);
        expect(policy.includes('has dropped nothing',),).toBe(true,);
      },
    },),
  ],
},);
