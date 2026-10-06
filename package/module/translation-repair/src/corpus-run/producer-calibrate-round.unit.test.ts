/**
 Tests for one slice of the producer calibration over a scripted client, in
 which every translator writes the rendering the script holds, every judge
 backs the candidate carrying one needle, and no model is ever called.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BenchSlice,
  runCalibrationRound,
} from '../../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
} from '../roster-seats.test-fixture.ts';
import { translateLaneClient, } from './translate-lane-script.test-fixture.ts';

/**
 Archive wording the slice already carries.
 */
const INCUMBENT_TEXT = 'The cat is doing the sleeping on the windowsill, with tail hanging by the radiator.';

/**
 Slice every case renders.
 */
const SLICE: BenchSlice = {
  entryId: 'mittens',
  index: 0,
  sourceText: '猫猫在窗台上打盹，尾巴垂在暖气片旁边。',
  incumbentText: INCUMBENT_TEXT,
  lineStructured: false,
};

/**
 Models that write and judge the slice.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_HYPER_VISION,
] as const;

/**
 Rendering the judges back in every case.
 */
const DOZING = 'The cat dozes on the windowsill, tail draped beside the radiator.';

/**
 A rendering no judge backs.
 */
const NAPPING = 'A cat naps on the sill, its tail hanging near the heater.';

await describe({
  name: runCalibrationRound.name,
  concurrency: 1,
  children: [
    it({
      name: 'RETURNS the slate with every rendering and the incumbent, the ballots, and each writer as an author',
      fn: async () => {
        const round = await runCalibrationRound({
          slice: SLICE,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: {
              [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: DOZING,
              [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: NAPPING,
              [SEAT_HYPER_VISION]: 'The cat sleeps on the ledge, tail beside the radiator.',
            },
            needle: 'dozes',
          },),
        },);

        expect(round,).toEqual({
          round: {
            producers: [
              {
                kind: 'model',
                modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
              },
              {
                kind: 'model',
                modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
              },
              {
                kind: 'model',
                modelId: SEAT_HYPER_VISION,
              },
              {
                kind: 'incumbent',
                matched: [],
              },
            ],
            ballots: [
              {
                modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
                best: 1,
                reason: 'scripted',
                weight: 1,
                selfVote: false,
              },
              {
                modelId: SEAT_HYPER_VISION,
                best: 1,
                reason: 'scripted',
                weight: 1,
                selfVote: false,
              },
              {
                modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
                best: 1,
                reason: 'scripted',
                weight: 0.5,
                selfVote: true,
              },
            ],
          },
          authors: [
            SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            SEAT_HYPER_VISION,
          ],
        },);
      },
    },),

    it({
      name: 'CREDITS both writers of one rendering as authors of the single composite candidate they share',
      fn: async () => {
        const round = await runCalibrationRound({
          slice: SLICE,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: {
              [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: DOZING,
              [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: DOZING,
              [SEAT_HYPER_VISION]: NAPPING,
            },
            needle: 'dozes',
          },),
        },);

        expect(round.round
          .producers,).toEqual([
            {
              kind: 'model',
              modelId: SEAT_HYPER_VISION,
            },
            {
              kind: 'incumbent',
              matched: [],
            },
            {
              kind: 'composite',
              contributors: [
                SEAT_HYPER_OPENROUTER_VISION_EDITOR,
                SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
              ],
            },
          ],);
        expect(round.authors,).toEqual([
          SEAT_HYPER_VISION,
          SEAT_HYPER_OPENROUTER_VISION_EDITOR,
          SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
        ],);
      },
    },),

    it({
      name: 'CREDITS a writer whose rendering equals the archive wording as an author of the incumbent candidate',
      fn: async () => {
        const round = await runCalibrationRound({
          slice: SLICE,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: {
              [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: DOZING,
              [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: INCUMBENT_TEXT,
              [SEAT_HYPER_VISION]: NAPPING,
            },
            needle: 'dozes',
          },),
        },);

        expect(round.round
          .producers,).toEqual([
            {
              kind: 'model',
              modelId: SEAT_HYPER_VISION,
            },
            {
              kind: 'incumbent',
              matched: [SEAT_SYNTHETIC_VISION_NO_OPENROUTER,],
            },
            {
              kind: 'model',
              modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            },
          ],);
        expect(round.authors,).toEqual([
          SEAT_HYPER_VISION,
          SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
          SEAT_HYPER_OPENROUTER_VISION_EDITOR,
        ],);
      },
    },),

    it({
      name: 'LEAVES a writer that answered unusably out of the authors while it still judges',
      fn: async () => {
        const round = await runCalibrationRound({
          slice: SLICE,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: {
              [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: DOZING,
              [SEAT_HYPER_VISION]: NAPPING,
            },
            needle: 'dozes',
          },),
        },);

        expect(round.authors,).toEqual([
          SEAT_HYPER_VISION,
          SEAT_HYPER_OPENROUTER_VISION_EDITOR,
        ],);
        expect(round.round
          .ballots
          .map(function judge(ballot,): string {
            return ballot.modelId;
          },),).toEqual([
            SEAT_HYPER_VISION,
            SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
          ],);
      },
    },),
  ],
},);
