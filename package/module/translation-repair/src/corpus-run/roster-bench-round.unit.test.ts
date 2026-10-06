/**
 Tests for one slice at one width of the roster bench over a scripted client
 and a scripted clock, in which every translator writes the rendering the
 script holds, every judge backs the candidate carrying one needle, and no
 model is ever called.

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
  runBenchRow,
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
 Slice every case renders, the fifth of its entry.
 */
const SLICE: BenchSlice = {
  entryId: 'mittens',
  index: 4,
  sourceText: '猫猫在窗台上打盹，尾巴垂在暖气片旁边。',
  incumbentText: INCUMBENT_TEXT,
  lineStructured: false,
};

/**
 Models the widths are cut from, which also judge.
 */
const ROSTER = [
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_HYPER_VISION,
] as const;

/**
 What each of the roster's models writes, the last one copying the archive.
 */
const RENDERINGS = {
  [SEAT_HYPER_OPENROUTER_VISION_EDITOR]: 'The cat dozes on the windowsill, tail draped beside the radiator.',
  [SEAT_SYNTHETIC_VISION_NO_OPENROUTER]: 'A cat naps on the sill, its tail hanging near the heater.',
  [SEAT_HYPER_VISION]: INCUMBENT_TEXT,
} as const;

/**
 Clock reading a quarter second further on at every look.

 @returns The clock

 @example
 ```ts
 const clock = quarterSecondClock();
 ```
 */
function quarterSecondClock(): { readonly now: () => number; } {
  /**
   Reading the clock is at.
   */
  const reading = { at: 1_000, };
  return {
    now: function advance(): number {
      reading.at += 250;
      return reading.at;
    },
  };
}

await describe({
  name: runBenchRow.name,
  concurrency: 1,
  children: [
    it({
      name: 'RECORDS the row of a width cut from the head of the roster, its tally, its slate and its duration',
      fn: async () => {
        const { calls, ...row } = await runBenchRow({
          slice: SLICE,
          width: 2,
          pass: 1,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: RENDERINGS,
            needle: 'dozes',
          },),
          clock: quarterSecondClock(),
        },);

        expect(row,).toEqual({
          width: 2,
          pass: 1,
          entryId: 'mittens',
          index: 4,
          sourceChars: 19,
          incumbentChars: 83,
          translators: [
            SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
          ],
          decision: 'judged',
          keptIncumbent: false,
          voteWeight: 2.5,
          judgesAvailable: 3,
          ballots: 3,
          abstentions: 0,
          selfVotes: 1,
          round: {
            producers: [
              {
                kind: 'model',
                modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
              },
              {
                kind: 'incumbent',
                matched: [],
              },
              {
                kind: 'model',
                modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
              },
            ],
            ballots: [
              {
                modelId: SEAT_HYPER_VISION,
                best: 3,
                reason: 'scripted',
                weight: 1,
                selfVote: false,
              },
              {
                modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR,
                best: 3,
                reason: 'scripted',
                weight: 0.5,
                selfVote: true,
              },
              {
                modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
                best: 3,
                reason: 'scripted',
                weight: 1,
                selfVote: false,
              },
            ],
          },
          candidateCount: 3,
          heardTranslators: 2,
          findings: [
            'translate-candidates (2/2 heard, 3 distinct, 0 collapsed)',
            `select-self-vote (${SEAT_HYPER_OPENROUTER_VISION_EDITOR})`,
          ],
          ms: 250,
        },);
        expect(calls.map(function summary(call,): readonly unknown[] {
          return [
            call.schema,
            call.modelId,
            call.outcome,
            call.promptTokens,
            call.completionTokens,
            call.tokens,
          ];
        },),).toEqual([
          [
            'translation_report',
            SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            'ok',
            0,
            0,
            0,
          ],
          [
            'translation_report',
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'ok',
            0,
            0,
            0,
          ],
          [
            'candidate_ballot',
            SEAT_HYPER_VISION,
            'ok',
            0,
            0,
            0,
          ],
          [
            'candidate_ballot',
            SEAT_HYPER_OPENROUTER_VISION_EDITOR,
            'ok',
            0,
            0,
            0,
          ],
          [
            'candidate_ballot',
            SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
            'ok',
            0,
            0,
            0,
          ],
        ],);
      },
    },),

    it({
      name: 'RECORDS the incumbent as kept, and the writer who copied it, at the width that seats that writer',
      fn: async () => {
        const row = await runBenchRow({
          slice: SLICE,
          width: 3,
          pass: 2,
          roster: ROSTER,
          client: translateLaneClient({
            renderings: RENDERINGS,
            needle: 'sleeping',
          },),
          clock: quarterSecondClock(),
        },);

        expect({
          width: row.width,
          pass: row.pass,
          translators: row.translators,
          keptIncumbent: row.keptIncumbent,
          heardTranslators: row.heardTranslators,
          candidateCount: row.candidateCount,
          findings: row.findings,
          calls: row.calls.length,
        },).toEqual({
          width: 3,
          pass: 2,
          translators: [...ROSTER,],
          keptIncumbent: true,
          heardTranslators: 3,
          candidateCount: 3,
          findings: [
            `translate-matched-incumbent (${SEAT_HYPER_VISION})`,
            'translate-candidates (3/3 heard, 3 distinct, 1 collapsed)',
            `select-self-vote (${SEAT_HYPER_VISION})`,
          ],
          calls: 6,
        },);
      },
    },),
  ],
},);
