/**
 Tests for applying every group's replacements slice by slice and putting each
 changed slice through the floors: where two groups meet in one slice, where
 their words overlap, what a floor's refusal keeps, what each place and each
 changed slice is recorded as, and the invariants a settled group must hold.

 The groups are settled from scripted ballots over the cat page, so the
 replacements are the ones the pass would plan.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  applyConsistency,
  type ArtifactConsistencyGroup,
  ConsistencyInvariantError,
  consistencyFloorVerdict,
  type ConsistencySliceFacts,
  consistencySlicesOf,
  placesOf,
  repeatGroupsOf,
  repeatOf,
  type SettledGroup,
  settleAsked,
  unplacedOf,
} from '../../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '../capturing-logger.test-fixture.ts';
import {
  archiveEnglishOf,
  preparedCatPage,
  projectedCatPage,
  REFRAIN_QUOTES,
  SENTENCE_QUOTES,
} from './consistency-page.test-fixture.ts';

/**
 What the pass made of each slice of the cat page when the archive stands everywhere.
 */
const ENGLISH = archiveEnglishOf({ prepared: preparedCatPage(), },);

/**
 The ballots of three judges who all choose the first place and keep none.

 @param quotes - the quotes every judge gives

 @returns The voices, in seat order

 @example
 ```ts
 const voices = alikeVoices({ quotes: SENTENCE_QUOTES, },);
 ```
 */
function alikeVoices({ quotes, }: { readonly quotes: readonly Record<string, string>[]; },) {
  return ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function voiceFor(seat,) {
    return {
      seat,
      reason: 'The first place words it best.',
      quotes: quotes.map(function quoted(quote,) {
        return {
          label: quote.label ?? '',
          quote: quote.quote ?? '',
          ...((quote.slot === undefined) ? {} : { slot: quote.slot, }),
        };
      },),
      choice: 'OCCURRENCE 1',
      keep: [] as string[],
    };
  },);
}

/**
 The cat page's two groups settled from scripted ballots, beside the facts of its slices.

 @param english - what each slice would ship, the archive by default

 @param sentenceQuotes - the quotes the judges give for the repeated sentence

 @param frameQuotes - the quotes the judges give for the refrain

 @returns The settled groups in page order and the facts of every slice

 @example
 ```ts
 const { settled, slices, } = settledCatPage({},);
 ```
 */
function settledCatPage(
  {
    english = ENGLISH,
    sentenceQuotes = SENTENCE_QUOTES,
    frameQuotes = REFRAIN_QUOTES,
  }: {
    readonly english?: readonly string[];
    readonly sentenceQuotes?: readonly Record<string, string>[];
    readonly frameQuotes?: readonly Record<string, string>[];
  },
): {
  readonly settled: readonly SettledGroup[];
  readonly slices: readonly ConsistencySliceFacts[];
} {
  const prepared = preparedCatPage();
  const slices = consistencySlicesOf({
    prepared,
    projected: projectedCatPage({ prepared, english, },),
    contestSlices: [],
    consolidateSlices: [],
    archiveDisputes: new Map(),
  },);
  const text = prepared.sourceText;
  return {
    slices,
    settled: repeatGroupsOf({
      text,
      slices: prepared.slices
        .map(function sourceOf(slice,) {
          return slice.source;
        },),
    },)
      .map(function settle(group,): SettledGroup {
        const places = placesOf({ group, slices, },);
        return settleAsked({
          repeat: repeatOf({ group, text, },),
          places,
          unplaced: unplacedOf({ group, },),
          asked: {
            quorum: 2,
            voices: alikeVoices({ quotes: (group.kind === 'refrain') ? frameQuotes : sentenceQuotes, },),
            findings: [],
            resumed: false,
          },
        },);
      },),
  };
}

/**
 Outcomes of every place of every group, in page order.

 @param groups - the groups with final outcomes

 @returns One list of outcomes per group

 @example
 ```ts
 const outcomes = outcomesOf({ groups, },);
 ```
 */
function outcomesOf({ groups, }: { readonly groups: readonly ArtifactConsistencyGroup[]; },): readonly (readonly string[])[] {
  return groups.map(function placesOutcomes(group,): readonly string[] {
    return Array.from(
      group.occurrences,
      function outcomeOf(occurrence,): string {
        return occurrence.outcome;
      },
    );
  },);
}

/**
 Applies the replacements of a settled cat page with no declared names.

 @param page - the settled groups and slice facts

 @param lines - sink for the level and text of every line the pass logs

 @returns What applying came to

 @example
 ```ts
 const applied = applyCat({ page: settledCatPage({},), lines: [], },);
 ```
 */
function applyCat(
  {
    page,
    lines,
  }: {
    readonly page: ReturnType<typeof settledCatPage>;
    readonly lines: string[];
  },
): ReturnType<typeof applyConsistency> {
  return applyConsistency({
    settled: page.settled,
    slices: page.slices,
    declared: [],
    declaredNames: [],
    l: levelCapturingLogger({ lines, },),
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: applyConsistency.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'MAKES EVERY GROUP\'S REPLACEMENTS IN ONE SLICE TOGETHER, the sentence and the refrain both reaching the third slice',
          fn: async () => {
            const lines: string[] = [];
            const applied = applyCat({ page: settledCatPage({},), lines, },);
            expect(applied.slices.map(function textOf(slice,): readonly [number, string] {
              return [slice.sliceIndex, slice.text,];
            },),).toEqual([
              [1, '## Two\n\nThe smell of fish in the kitchen woke the kitten. So this cat must be a lazy little treasure.',],
              [
                2,
                '## Three\n\nIn the evening, the sunny window put the kitten to sleep, and the fish snacks smiled too. '
                + 'So this cat must be a sweet little treasure.',
              ],
              [3, '## Four\n\nThe rain in the yard sent the kitten running home. So this cat must be a warm little treasure.',],
            ],);
            expect(outcomesOf({ groups: applied.groups, },),).toEqual([
              ['chosen', 'replaced',],
              ['chosen', 'replaced', 'replaced', 'replaced',],
            ],);
            expect([applied.findings, lines,],).toEqual([[], [],],);
          },
        },),
        it({
          name: 'RECORDS EACH PLACE WITH ITS LABEL, SLICE, OFFSETS, LINE, SLOT OFFSETS AND RENDERING, and each group with its '
            + 'repeat, unplaced places and verdict as they were settled',
          fn: async () => {
            const page = settledCatPage({},);
            const applied = applyCat({ page, lines: [], },);
            const [sentence, frame,] = applied.groups;
            const [sentenceSettled, frameSettled,] = page.settled;
            expect(nonNullishOrThrow(frame,).occurrences[1],).toEqual({
              label: 'OCCURRENCE 2',
              sliceIndex: 1,
              startOffset: 56,
              endOffset: 70,
              line: 7,
              slotStartOffset: 64,
              slotEndOffset: 66,
              rendering: { kind: 'located', quote: 'So this cat is surely a lazy little treasure.', slot: 'lazy', },
              outcome: 'replaced',
            },);
            expect(nonNullishOrThrow(sentence,).occurrences[1],).toEqual({
              label: 'OCCURRENCE 2',
              sliceIndex: 2,
              startOffset: 85,
              endOffset: 97,
              line: 11,
              rendering: { kind: 'located', quote: 'the sunlight on the sill lulled the kitten to sleep', },
              outcome: 'replaced',
            },);
            expect([sentence, frame,].map(function carried(group,): unknown {
              return [group?.repeat, group?.unplaced, group?.verdict,];
            },),).toEqual([sentenceSettled, frameSettled,].map(function settledOf(group,): unknown {
              return [group?.repeat, group?.unplaced, group?.verdict,];
            },),);
          },
        },),
        it({
          name: 'RECORDS A PLACE WHOSE QUOTE WAS NOT LOCATED AS UNLOCATED WITH ITS REASON, and replaces the others',
          fn: async () => {
            const applied = applyCat({
              page: settledCatPage({
                sentenceQuotes: [
                  nonNullishOrThrow(SENTENCE_QUOTES[0],),
                  { label: 'OCCURRENCE 2', quote: 'the lamp on the sill lulled the kitten to sleep', },
                ],
              },),
              lines: [],
            },);
            expect(nonNullishOrThrow(applied.groups[0],).occurrences[1],).toMatchObject({
              rendering: { kind: 'unlocated', reason: 'not-found', },
              outcome: 'unlocated',
            },);
            expect(applied.slices.map(function indexOf(slice,): number {
              return slice.sliceIndex;
            },),).toEqual([1, 2, 3,],);
          },
        },),
        it({
          name: 'CHANGES NO SLICE AND KEEPS EVERY OUTCOME WHERE NO GROUP PLANNED A REPLACEMENT',
          fn: async () => {
            const page = settledCatPage({},);
            const applied = applyConsistency({
              settled: page.settled
                .map(function withoutEdits(group,): SettledGroup {
                  return {
                    ...group,
                    edits: [],
                    outcomes: group.outcomes
                      .map(function untouched(): 'untouched' {
                        return 'untouched';
                      },),
                  };
                },),
              slices: page.slices,
              declared: [],
              declaredNames: [],
              l: levelCapturingLogger({ lines: [], },),
            },);
            expect([applied.slices, applied.findings, outcomesOf({ groups: applied.groups, },),],).toEqual([
              [],
              [],
              [['untouched', 'untouched',], ['untouched', 'untouched', 'untouched', 'untouched',],],
            ],);
          },
        },),
        it({
          name: 'LEAVES THE LATER OF TWO GROUPS\' REPLACEMENTS OUT WHERE THEIR WORDS OVERLAP, recording overlapped and making '
            + 'the earlier group\'s replacement',
          fn: async () => {
            const applied = applyCat({
              page: settledCatPage({
                sentenceQuotes: [
                  nonNullishOrThrow(SENTENCE_QUOTES[0],),
                  {
                    label: 'OCCURRENCE 2',
                    quote: 'the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too. '
                      + 'So this cat has to be a sweet little darling',
                  },
                ],
              },),
              lines: [],
            },);
            expect(outcomesOf({ groups: applied.groups, },),).toEqual([
              ['chosen', 'replaced',],
              ['chosen', 'replaced', 'overlapped', 'replaced',],
            ],);
            expect(applied.slices.find(function third(slice,): boolean {
              return slice.sliceIndex === 2;
            },),).toEqual({ sliceIndex: 2, text: '## Three\n\nIn the evening, the sunny window put the kitten to sleep.', },);
          },
        },),
        it({
          name: 'KEEPS A SLICE\'S WORDING WHEN A FLOOR REFUSES IT, recording kept-floor for the replacement meant for it, the '
            + 'finding and a warning, and leaves the other slices changed',
          fn: async () => {
            const page = settledCatPage({
              english: [
                nonNullishOrThrow(ENGLISH[0],),
                '## Two\n\nThe smell of fish in the kitchen woke the kitten. So this cat is surely Mittens, a lazy little treasure.',
                nonNullishOrThrow(ENGLISH[2],),
                nonNullishOrThrow(ENGLISH[3],),
              ],
              frameQuotes: [
                nonNullishOrThrow(REFRAIN_QUOTES[0],),
                { label: 'OCCURRENCE 2', quote: 'So this cat is surely Mittens, a lazy little treasure.', slot: 'lazy', },
                nonNullishOrThrow(REFRAIN_QUOTES[2],),
                nonNullishOrThrow(REFRAIN_QUOTES[3],),
              ],
            },);
            const lines: string[] = [];
            const applied = applyConsistency({
              settled: page.settled,
              slices: page.slices,
              declared: [],
              declaredNames: ['Mittens',],
              l: levelCapturingLogger({ lines, },),
            },);
            const slice = nonNullishOrThrow(page.slices[1],);
            const refused = consistencyFloorVerdict({
              sliceIndex: 1,
              sourceText: slice.sourceText,
              currentText: slice.current.kind === 'present' ? slice.current.text : '',
              candidateText: '## Two\n\nThe smell of fish in the kitchen woke the kitten. So this cat must be a lazy little treasure.',
              lineStructured: false,
              declared: [],
              declaredNames: ['Mittens',],
              disputedWordings: [],
            },);
            if (refused.kind !== 'refused')
              throw new Error('Expected the floors to refuse the slice without its declared name',);
            expect(outcomesOf({ groups: applied.groups, },)[1],).toEqual(['chosen', 'kept-floor', 'replaced', 'replaced',],);
            expect(applied.slices.map(function indexOf(changed,): number {
              return changed.sliceIndex;
            },),).toEqual([2, 3,],);
            expect(applied.findings,).toEqual([
              `slice 1: the floors refused the consistency replacement: ${refused.findings.join(' | ',)}`,
            ],);
            expect(lines,).toEqual([
              `warn [applyConsistency] slice 1: the floors refused the consistency replacement, so the slice keeps its wording: ${
                refused.findings.join(' | ',)
              }`,
            ],);
          },
        },),
        it({
          name: 'KEEPS OVERLAPPED AS THE OUTCOME OF A REPLACEMENT LEFT OUT EVEN WHEN A FLOOR THEN REFUSES THE SLICE, and records '
            + 'kept-floor for the replacement that was made in it',
          fn: async () => {
            const page = settledCatPage({
              sentenceQuotes: [
                nonNullishOrThrow(SENTENCE_QUOTES[0],),
                {
                  label: 'OCCURRENCE 2',
                  quote: 'the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too. '
                    + 'So this cat has to be a sweet little darling',
                },
              ],
            },);
            const applied = applyConsistency({
              settled: page.settled,
              slices: page.slices,
              declared: [],
              declaredNames: ['sunlight',],
              l: levelCapturingLogger({ lines: [], },),
            },);
            expect(outcomesOf({ groups: applied.groups, },),).toEqual([
              ['chosen', 'kept-floor',],
              ['chosen', 'replaced', 'overlapped', 'replaced',],
            ],);
            expect(applied.slices.map(function indexOf(slice,): number {
              return slice.sliceIndex;
            },),).toEqual([1, 3,],);
          },
        },),
        it({
          name: 'REFUSES A SETTLED GROUP WHOSE RENDERINGS OR OUTCOMES ARE FEWER THAN ITS PLACES, naming the place and the group',
          fn: async () => {
            const page = settledCatPage({},);
            const [first,] = page.settled;
            const group = nonNullishOrThrow(first,);
            /**
             The text of the refusal applying a changed group raises.
             */
            function refusalOf({ changed, }: { readonly changed: SettledGroup; },): string {
              return String(caught(function applies(): unknown {
                return applyConsistency({
                  settled: [changed,],
                  slices: page.slices,
                  declared: [],
                  declaredNames: [],
                  l: levelCapturingLogger({ lines: [], },),
                },);
              },),);
            }
            expect(caught(function applies(): unknown {
              return applyConsistency({
                settled: [{ ...group, outcomes: [], },],
                slices: page.slices,
                declared: [],
                declaredNames: [],
                l: levelCapturingLogger({ lines: [], },),
              },);
            },),).toBeInstanceOf(ConsistencyInvariantError,);
            expect([
              refusalOf({ changed: { ...group, renderings: group.renderings.slice(0, 1,), }, }),
              refusalOf({ changed: { ...group, outcomes: [], }, }),
            ],).toEqual([
              'ConsistencyInvariantError: unreachable: place 1 of group 0 has no rendering or outcome, '
              + 'and both are made for every place',
              'ConsistencyInvariantError: unreachable: place 0 of group 0 has no rendering or outcome, '
              + 'and both are made for every place',
            ],);
          },
        },),
        it({
          name: 'REFUSES A PLACE TO BE REPLACED WHOSE REPLACEMENT NEVER REACHED A SLICE THE PASS READS, naming the place and the group',
          fn: async () => {
            const page = settledCatPage({},);
            const absent = page.slices
              .map(function withoutSecond(facts,): ConsistencySliceFacts {
                return (facts.sliceIndex === 2) ? { ...facts, current: { kind: 'absent', }, } : facts;
              },);
            const refusal = caught(function applies(): unknown {
              return applyConsistency({
                settled: page.settled,
                slices: absent,
                declared: [],
                declaredNames: [],
                l: levelCapturingLogger({ lines: [], },),
              },);
            },);
            expect(refusal,).toBeInstanceOf(ConsistencyInvariantError,);
            expect(String(refusal,),).toBe(
              'ConsistencyInvariantError: unreachable: place 1 of group 0 was to be replaced and no replacement was applied, '
              + 'left out or refused, and every pending replacement is one of the three',
            );
          },
        },),
      ],
    },),
  ],
},);
