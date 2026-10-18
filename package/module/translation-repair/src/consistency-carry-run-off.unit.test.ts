/**
 Tests for which candidates a carry choice runs off (the lead's adoption of 2026-10-15 of the owner's rule of 2026-10-11
 for this ask, open to the owner's veto): a choice that reached its quorum and gave no strict majority runs off among the
 candidates tied for first, as the first round runs off among places, and a single leader without a majority is not a tie.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  carryRunOffFinalistsOf,
  type ConsistencyChoiceVoice,
  tiedChoicesOf,
} from '../dist/final/node/index.mjs';

/**
 Labels a choice among five candidates showed.
 */
const LABELS = ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3', 'CANDIDATE 4', 'CANDIDATE 5',] as const;

/**
 Builds the heard choices of seats that wrote the given labels.

 @param choices - what each seat wrote, in seat order

 @returns The heard choices

 @example
 ```ts
 const voices = votesFor({ choices: ['CANDIDATE 1', '2',], },);
 ```
 */
function votesFor({ choices, }: { readonly choices: readonly string[]; },): readonly ConsistencyChoiceVoice[] {
  return choices.map(function voiceOf(
    choice,
    position,
  ): ConsistencyChoiceVoice {
    return { seat: `seat-${String(position,)}`, reason: 'It reads best.', choice, };
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: tiedChoicesOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE LABELS TIED FOR FIRST, in the order of the sheet, when no label has more than half of the usable choices',
          fn: async () => {
            expect([
              tiedChoicesOf({ voices: votesFor({ choices: ['CANDIDATE 3', 'CANDIDATE 5', 'CANDIDATE 1',], },), labels: LABELS, },),
              tiedChoicesOf({
                voices: votesFor({ choices: ['CANDIDATE 2', 'CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 1',], },),
                labels: LABELS,
              },),
            ],).toEqual([
              ['CANDIDATE 1', 'CANDIDATE 3', 'CANDIDATE 5',],
              ['CANDIDATE 1', 'CANDIDATE 2',],
            ],);
          },
        },),
        it({
          name: 'NAMES NONE WHEN A LABEL HAS A STRICT MAJORITY, WHEN ONE LABEL LEADS ALONE OR WHEN NOTHING COUNTED',
          fn: async () => {
            expect([
              tiedChoicesOf({ voices: votesFor({ choices: ['CANDIDATE 1', 'CANDIDATE 1', 'CANDIDATE 2',], },), labels: LABELS, },),
              tiedChoicesOf({
                voices: votesFor({ choices: ['CANDIDATE 1', 'CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3', 'CANDIDATE 4',], },),
                labels: LABELS,
              },),
              tiedChoicesOf({ voices: votesFor({ choices: ['CANDIDATE 9', 'nothing',], },), labels: LABELS, },),
            ],).toEqual([[], [], [],],);
          },
        },),
        it({
          name: 'READS THE FORMS OF A LABEL AS THE LABEL, so a tie is a tie whichever way the seats wrote it',
          fn: async () => {
            expect(tiedChoicesOf({ voices: votesFor({ choices: ['Candidate 1', '2', 'candidate 1', ' 2',], },), labels: LABELS, },),)
              .toEqual(['CANDIDATE 1', 'CANDIDATE 2',],);
          },
        },),
      ],
    },),
    describe({
      name: carryRunOffFinalistsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RUNS OFF THE TIED LEADERS OF A CHOICE THAT REACHED ITS QUORUM, with the quorum the first ask closed on as the floor',
          fn: async () => {
            expect(
              carryRunOffFinalistsOf({
                voices: votesFor({ choices: ['CANDIDATE 3', 'CANDIDATE 5', 'CANDIDATE 1',], },),
                labels: LABELS,
                quorum: 2,
              },),
            ).toEqual(['CANDIDATE 1', 'CANDIDATE 3', 'CANDIDATE 5',],);
          },
        },),
        it({
          name: 'RUNS OFF NOTHING BELOW THE QUORUM OR WHEN A CANDIDATE WON BY A STRICT MAJORITY',
          fn: async () => {
            expect([
              carryRunOffFinalistsOf({ voices: votesFor({ choices: ['CANDIDATE 3', 'CANDIDATE 5',], },), labels: LABELS, quorum: 3, },),
              carryRunOffFinalistsOf({
                voices: votesFor({ choices: ['CANDIDATE 3', 'CANDIDATE 3', 'CANDIDATE 5',], },),
                labels: LABELS,
                quorum: 2,
              },),
            ],).toEqual([[], [],],);
          },
        },),
      ],
    },),
  ],
},);
