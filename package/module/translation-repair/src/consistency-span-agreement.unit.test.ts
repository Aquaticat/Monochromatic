/**
 Tests for how a chosen place is located when the judges quoted different spans of it (the lead's ruling of 2026-10-15 on
 the run of TianqiChen66625, group 2, where three judges quoted three nested spans of one place and none was a strict
 majority of the text): the place is located by the longest of its quotes that stands exactly once in its English and that,
 after the fold, a strict majority of the quotes naming that place contain.

 Fixtures are cat-themed invention, except the three quotes and the two English sentences of group 2, which are the
 run's own words (English only, as the artifact and the page hold them).

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ConsistencyVoice,
  countConsistency,
} from '../dist/final/node/index.mjs';

/**
 Builds one ballot that chooses the first place and quotes the given spans.

 @param seat - seat that answered
 @param quotes - the quote given for each place, by label
 @param choice - label of the place chosen

 @returns The ballot

 @example
 ```ts
 const voice = ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },);
 ```
 */
function ballotOf(
  {
    seat,
    quotes,
    choice,
  }: {
    readonly seat: string;
    readonly quotes: Readonly<Record<string, string>>;
    readonly choice: string;
  },
): ConsistencyVoice {
  return {
    seat,
    reason: 'The first place words it best.',
    quotes: Object.entries(quotes,)
      .map(function quoteOf([label, quote,],) {
        return { label, quote, };
      },),
    choice,
    keep: [],
  };
}

/**
 English of the two places of group 2 of the run of TianqiChen66625, as the page holds them.
 */
const GROUP_TWO_ENGLISH = [
  'She also wanted to stay beside more people in her adorable form,\nbringing sunshine into more lives.',
  'She wanted to stay by more people’s sides in her cute form and bring sunshine to more of them.',
] as const;

/**
 The three ballots of group 2, rebuilt from the artifact (`artifacts/TianqiChen666.json`, group 2, `verdict.ballots`).
 */
const GROUP_TWO_BALLOTS: readonly ConsistencyVoice[] = [
  ballotOf({
    seat: 'hf:moonshotai/Kimi-K3',
    quotes: {
      'OCCURRENCE 1': 'She wanted to stay beside more people in her adorable form,\nbringing sunshine into more lives',
      'OCCURRENCE 2': 'She wanted to stay by more people\'s sides in her cute form and bring sunshine to more of them',
    },
    choice: 'OCCURRENCE 1',
  },),
  {
    ...ballotOf({
      seat: 'minimax-m3',
      quotes: {
        'OCCURRENCE 1': 'stay beside more people in her adorable form, bringing sunshine into more lives',
        'OCCURRENCE 2': 'stay by more people\'s sides in her cute form and bring sunshine to more of them',
      },
      choice: 'OCCURRENCE 1',
    },),
    keep: ['OCCURRENCE 2',],
  },
  {
    ...ballotOf({
      seat: 'inception/mercury-2.5',
      quotes: {
        'OCCURRENCE 1': 'wanted to stay beside more people in her adorable form, bringing sunshine into more lives.',
        'OCCURRENCE 2': 'wanted to stay by more people\'s sides in her cute form and bring sunshine to more of them.',
      },
      choice: 'OCCURRENCE 2',
    },),
    keep: ['OCCURRENCE 1',],
  },
];

/**
 Counts ballots against two places of the given English.

 @param voices - the ballots
 @param english - English of each place, in order
 @param quorum - quorum the gather closed on

 @returns What the ballots come to

 @example
 ```ts
 const count = countAgainst({ voices, english: ['the cat naps', 'the kitten naps',], quorum: 2, },);
 ```
 */
function countAgainst(
  {
    voices,
    english,
    quorum,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly english: readonly string[];
    readonly quorum: number;
  },
): ReturnType<typeof countConsistency> {
  return countConsistency({
    voices,
    places: english.map(function placeOf(text, position,) {
      return {
        label: `OCCURRENCE ${String(position + 1,)}`,
        english: { kind: 'present' as const, text, },
      };
    },),
    framed: false,
    quorum,
  },);
}

await describe({
  name: countConsistency.name,
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    it({
      name: 'LOCATES GROUP 2 OF THE RUN OF TianqiChen66625 BY THE LONGEST QUOTE A STRICT MAJORITY CONTAIN: the first judge\'s span '
        + 'stands nowhere on the page, the third judge\'s span is inside the first and contains the second, and so the third '
        + 'judge\'s span locates the chosen place and the winner is no longer lost to an unlocated place',
      fn: async () => {
        const count = countAgainst({ voices: GROUP_TWO_BALLOTS, english: GROUP_TWO_ENGLISH, quorum: 3, },);
        expect({
          first: count.renderings[0]?.kind === 'located' ? count.renderings[0].quote : count.renderings[0],
          second: count.renderings[1]?.kind === 'located' ? count.renderings[1].quote : count.renderings[1],
          winner: count.winner,
        },).toEqual({
          first: 'wanted to stay beside more people in her adorable form,\nbringing sunshine into more lives',
          second: 'wanted to stay by more people’s sides in her cute form and bring sunshine to more of them',
          winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
        },);
      },
    },),
    it({
      name: 'CHOOSES THE LONGER OF TWO QUOTES WHEN A STRICT MAJORITY OF THE QUOTES CONTAIN IT, and the shorter when they do not',
      fn: async () => {
        // Two quotes: the shorter is inside both, the longer inside one of two, which is no strict majority.
        const split = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps in the sun', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'cat naps in the sun', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['In the evening the cat naps in the sun.', 'The kitten naps.',],
          quorum: 2,
        },);
        expect(split.renderings[0]?.kind === 'located' ? split.renderings[0].quote : split.renderings[0],).toBe(
          'cat naps in the sun',
        );
        // Three quotes: the longer is inside two of three.
        const nested = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps in the sun', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'the cat naps in the sun', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'c', quotes: { 'OCCURRENCE 1': 'cat naps', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['In the evening the cat naps in the sun.', 'The kitten naps.',],
          quorum: 3,
        },);
        expect(nested.renderings[0]?.kind === 'located' ? nested.renderings[0].quote : nested.renderings[0],).toBe(
          'the cat naps in the sun',
        );
      },
    },),
    it({
      name: 'LOCATES NOTHING WHEN NO QUOTE IS CONTAINED IN A STRICT MAJORITY OF THE QUOTES, the place staying as it stands',
      fn: async () => {
        const count = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'in the sun', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'c', quotes: { 'OCCURRENCE 1': 'every evening', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['Every evening the cat naps in the sun.', 'The kitten naps.',],
          quorum: 3,
        },);
        expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'no-agreement', },);
      },
    },),
    it({
      name: 'COUNTS A MAJORITY OF EVERY USABLE BALLOT, not only of the quotes naming the place: two of four ballots quoting a '
        + 'place the same way, the other two quoting nothing of it, do not agree on it',
      fn: async () => {
        const count = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps', 'OCCURRENCE 2': 'the kitten naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'the cat naps', 'OCCURRENCE 2': 'the kitten naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'c', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'd', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['the cat naps in the sun.', 'the kitten naps in the sun.',],
          quorum: 3,
        },);
        expect(count.renderings[1],).toEqual({ kind: 'unlocated', reason: 'no-agreement', },);
      },
    },),
    it({
      name: 'SKIPS A QUOTE THAT STANDS NOWHERE IN THE PLACE FOR A SHORTER QUOTE A STRICT MAJORITY CONTAIN THAT STANDS ONCE, and '
        + 'reports the longest quote\'s own failure when none stands once',
      fn: async () => {
        // "the cat naps in the shade" is inside two of three quotes and stands nowhere; "the cat naps" is inside all three.
        const skipped = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps in the shade', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'the cat naps in the shade', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'c', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['the cat naps in the sun.', 'The kitten naps.',],
          quorum: 3,
        },);
        const twice = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['the cat naps. the cat naps again.', 'The kitten naps.',],
          quorum: 2,
        },);
        const nowhere = countAgainst({
          voices: [
            ballotOf({ seat: 'a', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
            ballotOf({ seat: 'b', quotes: { 'OCCURRENCE 1': 'the cat naps', }, choice: 'OCCURRENCE 1', },),
          ],
          english: ['The kitten naps.', 'The kitten naps.',],
          quorum: 2,
        },);
        expect([
          skipped.renderings[0]?.kind === 'located' ? skipped.renderings[0].quote : skipped.renderings[0],
          twice.renderings[0],
          nowhere.renderings[0],
        ],).toEqual([
          'the cat naps',
          { kind: 'unlocated', reason: 'ambiguous', },
          { kind: 'unlocated', reason: 'not-found', },
        ],);
      },
    },),
  ],
},);
