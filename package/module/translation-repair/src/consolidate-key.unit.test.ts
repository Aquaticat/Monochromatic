/**
 * Tests for what makes two runs' consolidations the same consolidation.
 *
 * WHAT THESE PIN is the half of a cache that fails silently. A key that is too
 * WIDE discards settled work on an unrelated change, which is expensive and
 * obvious. A key that is too NARROW returns a settlement reached under a
 * different question, and nothing looks wrong: the texts match, so the key
 * matches, and a run reports a decision it never bought.
 *
 * The contest ballots are the case this stage adds over the others. They are
 * prompt content here, shown to the producers as claims about each lane, so two
 * consolidations over identical candidates and different ballots are different
 * questions.
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
  consolidateRunShape,
  consolidateSliceKey,
  type LaneContestBallot,
} from '../dist/final/node/index.mjs';

/**
 * Roster this run seats.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.8-27B',
] as const;

/**
 * One contest ballot as the judges record them.
 */
const BALLOT: LaneContestBallot = {
  modelId: 'hf:zai-org/GLM-5.2',
  choice: 'repair',
  unsupported: [],
  unsupportedRaw: [],
  dropped: ['translate',],
  droppedRaw: ['translate',],
  reason: 'the repair lane keeps the clause about the window',
} as LaneContestBallot;

/**
 * The slice every case keys, which each varies one field of.
 */
const SLICE = {
  runShape: consolidateRunShape({ modelIds: ROSTER, },),
  sourceText: '猫在窗边睡着了。',
  incumbentText: 'The cat slept by the window.',
  repairText: 'The cat fell asleep by the window.',
  translateText: 'The cat had fallen asleep beside the window.',
  standingText: 'The cat fell asleep by the window.',
  ballots: [BALLOT,],
};

await describe({
  name: consolidateSliceKey.name,
  children: [
    it({
      name: 'GIVES ONE KEY FOR ONE QUESTION, so a resumed run finds what an earlier run settled rather '
        + 'than paying for the same slate twice',
      fn: async () => {
        expect(consolidateSliceKey(SLICE,),).toBe(consolidateSliceKey({ ...SLICE, },),);
      },
    },),

    it({
      name: 'SEPARATES TWO SLICES THAT DIFFER ONLY IN THE CONTEST BALLOTS, which is what this key adds '
        + 'over the contest key it sits after. The ballots are prompt content: the producers are shown '
        + 'what the judges said about each lane, so the same two candidates with different arguments '
        + 'about them is a different question',
      fn: async () => {
        /**
         * The same contest settled the other way.
         */
        const otherWay: LaneContestBallot = {
          ...BALLOT,
          choice: 'translate',
          dropped: ['repair',],
          droppedRaw: ['repair',],
          reason: 'the translate lane reads as English rather than as a gloss',
        };

        expect(consolidateSliceKey(SLICE,),).not.toBe(
          consolidateSliceKey({ ...SLICE, ballots: [otherWay,], },),
        );
      },
    },),

    it({
      name: 'SEPARATES A SLICE WITH NO STANDING TEXT FROM ONE THAT HAS IT, because the standing text '
        + 'is not derivable from the two lane renderings: a contest that declined leaves nothing '
        + 'standing, and the deciding half then takes a different exit entirely',
      fn: async () => {
        expect(consolidateSliceKey(SLICE,),).not.toBe(
          consolidateSliceKey({ ...SLICE, standingText: '', },),
        );
      },
    },),

    it({
      name: 'SEPARATES TWO ROSTERS asking the same slice, since a settlement carries the voices that '
        + 'reached it and a resumed slice must not return ballots a different panel cast',
      fn: async () => {
        /**
         * The same run with one more seat.
         */
        const wider = consolidateRunShape({
          modelIds: [...ROSTER, 'hf:moonshotai/Kimi-K3',] as const,
        },);

        expect(consolidateSliceKey(SLICE,),).not.toBe(
          consolidateSliceKey({ ...SLICE, runShape: wider, },),
        );
      },
    },),

    it({
      name: 'SEPARATES TWO PAIRS THAT DECLARE DIFFERENT NAMES, because identity context is '
        + 'front-matter-derived prompt content that varies per pair and measurably changes the answer',
      fn: async () => {
        /**
         * The same roster over a pair that declares a name.
         */
        const named = consolidateRunShape({
          modelIds: ROSTER,
          identityContext: 'the subject goes by Whiskers',
        },);

        expect(consolidateSliceKey(SLICE,),).not.toBe(
          consolidateSliceKey({ ...SLICE, runShape: named, },),
        );
      },
    },),

    it({
      name: 'SEPARATES A CHANGE TO THE ARCHIVE RENDERING, which the consolidation never ships. It is '
        + 'the structural standard the guard floors on, so two slices with identical candidates and '
        + 'different pages are checked against different shapes',
      fn: async () => {
        expect(consolidateSliceKey(SLICE,),).not.toBe(
          consolidateSliceKey({ ...SLICE, incumbentText: '> The cat slept by the window.', },),
        );
      },
    },),
  ],
},);
