/**
 Tests for reading the words of a place with the page definitions the place records, from generation nineteen. The words of
 `a [b*] c*’` hold an apostrophe of their word only where `[b*]` is a reference, which the page defines in another slice and the
 file holds no page to show. The pass records the definitions that change how the words read (`definitions`), and the recount, the
 edge test of the recorded words and the plan of each splice read the words with them. A section of generation eighteen or earlier
 reads the words alone, as it was written.

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
  ARTIFACT_SCHEMA_VERSION_V18,
  ARTIFACT_SCHEMA_VERSION_V19,
  type ArtifactConsistencyBallot,
  type ArtifactConsistencyCarry,
  type ArtifactConsistencyGroup,
  type ArtifactConsistencyOccurrence,
  assertSpanGroupCoherent,
  type TwoLaneArtifactGeneration,
} from '../../dist/final/node/index.mjs';
import { refusalTextOf, } from './consistency-refusal.test-fixture.ts';

/**
 Where the group sits in the section, for the refusals.
 */
const GROUP = 'cat.consistency.groups[0]';

/**
 The definition of a reference whose label ends in the character of emphasis, which stands in another slice of the page.
 */
const DEFINITION = '[b*]: https://cats.example/b';

/**
 The second place's words: they end in a mark after `c*`, an apostrophe of the word only where `[b*]` is a reference.
 */
const WORDS = 'a [b*] c*’';

/**
 The refusal of words that end in a mark the pass would put there only as a proven apostrophe, which the file cannot show for
 words read alone.
 */
const EDGE_REFUSAL = `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering: expected words that hold at most `
  + 'one apostrophe at an edge, directly beside a letter or a digit and never the opening curly single mark, since the pass puts only '
  + 'a proven apostrophe there.';

/**
 The group the cases read.
 */
type AskedGroup = ArtifactConsistencyGroup & { readonly verdict: { readonly kind: 'asked'; }; };

/**
 One ballot, choosing the first place and quoting the three places by the words each holds.

 @param seat - seat that answered

 @param words - the words the second place holds

 @returns The ballot

 @example
 ```ts
 const ballot = ballotOf({ seat: 'hyper-cat', words: 'a [b*] c*’', },);
 ```
 */
function ballotOf({ seat, words, }: { readonly seat: string; readonly words: string; },): ArtifactConsistencyBallot {
  return {
    seat,
    reason: 'The first place words it best.',
    quotes: [
      { label: 'OCCURRENCE 1', quote: 'the dogs’', },
      { label: 'OCCURRENCE 2', quote: words, },
      { label: 'OCCURRENCE 3', quote: 'the kitten naps', },
    ],
    choice: 'OCCURRENCE 1',
    keep: [],
  };
}

/**
 The carry of a receiving place: the bench chose the chosen words moved in by code.

 @param label - label of the receiving place

 @returns The carry

 @example
 ```ts
 const carry = carryOf({ label: 'OCCURRENCE 2', },);
 ```
 */
function carryOf({ label, }: { readonly label: string; },): ArtifactConsistencyCarry {
  return {
    label,
    candidates: [
      { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'Later *a [b*] c*’ naps in the sun.', },
      { label: 'CANDIDATE 2', kind: 'splice', writers: [], text: 'Later *the dogs’ naps in the sun.', },
    ],
    ballots: [
      { seat: 'hyper-cat', reason: 'It words the original best.', choice: 'CANDIDATE 2', },
      { seat: 'bedrock-cat', reason: 'It words the original best.', choice: 'CANDIDATE 2', },
    ],
    usable: 2,
    quorum: 2,
    decision: { kind: 'chosen', label: 'CANDIDATE 2', },
  };
}

/**
 A group of three places in which the chosen words are carried to the other two: the second holds the words that end in a mark
 after closing emphasis, whose reading needs the definition, and the third holds plain words.

 @param second - the words of the second place, the definitions its rendering records and what became of it

 @returns The group

 @example
 ```ts
 const group = groupOf({ second: { definitions: DEFINITION, outcome: 'replaced', }, },);
 ```
 */
function groupOf(
  { second, }: {
    readonly second: {
      readonly words?: string;
      readonly definitions?: string;
      readonly outcome: ArtifactConsistencyOccurrence['outcome'];
    };
  },
): AskedGroup {
  return {
    repeat: { kind: 'maximal', wording: '窗台上的阳光让小猫睡着了', },
    occurrences: [
      {
        label: 'OCCURRENCE 1',
        sliceIndex: 0,
        startOffset: 6,
        endOffset: 18,
        line: 3,
        rendering: { kind: 'located', quote: 'the dogs’', start: 5, },
        outcome: 'chosen',
      },
      {
        label: 'OCCURRENCE 2',
        sliceIndex: 1,
        startOffset: 30,
        endOffset: 42,
        line: 5,
        rendering: {
          kind: 'located',
          quote: second.words ?? WORDS,
          start: 7,
          ...((second.definitions === undefined) ? {} : { definitions: second.definitions, }),
        },
        outcome: second.outcome,
      },
      {
        label: 'OCCURRENCE 3',
        sliceIndex: 2,
        startOffset: 50,
        endOffset: 62,
        line: 7,
        rendering: { kind: 'located', quote: 'the kitten naps', start: 6, },
        outcome: 'replaced',
      },
    ],
    unplaced: [],
    verdict: {
      kind: 'asked',
      ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotFor(seat,): ArtifactConsistencyBallot {
        return ballotOf({
          seat,
          words: second.words ?? WORDS,
        },);
      },),
      usable: 3,
      quorum: 2,
      winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
    },
    carries: [carryOf({ label: 'OCCURRENCE 2', },), carryOf({ label: 'OCCURRENCE 3', },),],
  };
}

/**
 The text of the refusal the recount raises for a group, empty when the group is accepted.

 @param group - the group, asked of the bench

 @param generation - generation the section was written under

 @returns The refusal as text, or an empty text

 @example
 ```ts
 const text = refusalOf({ group: groupOf({ second, },), generation: 19, },);
 ```
 */
function refusalOf(
  {
    group,
    generation,
  }: {
    readonly group: AskedGroup;
    readonly generation: TwoLaneArtifactGeneration;
  },
): string {
  try {
    assertSpanGroupCoherent({
      group,
      path: GROUP,
      generation,
    },);
  } catch (error) {
    return refusalTextOf({
      read: function rethrows(): never {
        throw error;
      },
    },);
  }
  return '';
}

await describe({
  name: '',
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    describe({
      name: assertSpanGroupCoherent.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE WORDS OF A PLACE WITH THE DEFINITIONS IT RECORDS FROM GENERATION NINETEEN: the place of a run whose words end '
            + 'in a mark after `c*` records the definition that makes the mark an apostrophe of its word, so the chosen apostrophe '
            + 'moves in by code and both receiving places end replaced',
          fn: async () => {
            expect(refusalOf({
              group: groupOf({ second: { definitions: DEFINITION, outcome: 'replaced', }, },),
              generation: ARTIFACT_SCHEMA_VERSION_V19,
            },),).toBe('',);
          },
        },),
        it({
          name: 'REFUSES A GENERATION NINETEEN PLACE WHOSE DEFINITIONS ARE MISSING, since its words read alone end in a mark that is no '
            + 'proven apostrophe the file can show',
          fn: async () => {
            expect(refusalOf({
              group: groupOf({ second: { outcome: 'replaced', }, },),
              generation: ARTIFACT_SCHEMA_VERSION_V19,
            },),).toBe(EDGE_REFUSAL,);
          },
        },),
        it({
          name: 'REFUSES A GENERATION NINETEEN PLACE THAT RECORDS DEFINITIONS WHICH CHANGE NEITHER ITS SLOT NOR HOW ITS WORDS READ, since '
            + 'the pass records them only where they change one: a place of plain words that records the definition of an unrelated '
            + 'reference',
          fn: async () => {
            expect(refusalOf({
              group: groupOf({ second: { words: 'the kitten naps', definitions: '[z]: https://x.example/z', outcome: 'replaced', }, },),
              generation: ARTIFACT_SCHEMA_VERSION_V19,
            },),).toBe(
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering.definitions: expected the definitions `
              + 'that change the slot the usable ballots give inside those words or how those words read, and none where they change '
              + 'neither.',
            );
          },
        },),
        it({
          name: 'PLANS THE SPLICE WITH THE RECORDED DEFINITIONS FROM GENERATION NINETEEN: a place that records them and ends '
            + 'kept-current is refused, since code can move the chosen words into words that read as a word with the definition',
          fn: async () => {
            expect(refusalOf({
              group: groupOf({ second: { definitions: DEFINITION, outcome: 'kept-current', }, },),
              generation: ARTIFACT_SCHEMA_VERSION_V19,
            },),).toBe(
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].outcome: expected replaced, kept-floor, `
              + 'overlapped, kept-current, for a carry that decided as recorded.',
            );
          },
        },),
        it({
          name: 'KEEPS READING THE WORDS ALONE FOR GENERATION EIGHTEEN, as it was written: the same words, with or without the '
            + 'definition recorded beside them, end in a mark that is no proven apostrophe the file can show',
          fn: async () => {
            expect([
              groupOf({ second: { definitions: DEFINITION, outcome: 'replaced', }, },),
              groupOf({ second: { outcome: 'kept-current', }, },),
            ].map(function refusedAtEighteen(group,): string {
              return refusalOf({
                group,
                generation: ARTIFACT_SCHEMA_VERSION_V18,
              },);
            },),).toEqual([EDGE_REFUSAL, EDGE_REFUSAL,],);
          },
        },),
        it({
          name: 'REFUSES DEFINITIONS ON A PLACE OF A RUN FOR GENERATION EIGHTEEN, which recorded definitions for a slot alone',
          fn: async () => {
            expect(refusalOf({
              group: groupOf({ second: { words: 'the kitten naps', definitions: DEFINITION, outcome: 'replaced', }, },),
              generation: ARTIFACT_SCHEMA_VERSION_V18,
            },),).toBe(
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering.definitions: expected the definitions `
              + 'that change the slot the usable ballots give inside those words, and none where they change none.',
            );
          },
        },),
      ],
    },),
  ],
},);
