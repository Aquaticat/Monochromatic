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
  type DecidedGroup,
  placesOf,
  prepareDocumentPair,
  repeatGroupsOf,
  repeatOf,
  type SettledGroup,
  settleAsked,
  settleCarried,
  type UnitCarried,
  unplacedOf,
} from '../../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '../capturing-logger.test-fixture.ts';
import {
  archiveEnglishOf,
  preparedCatPage,
  projectedCatPage,
} from './consistency-page.test-fixture.ts';
import {
  REFRAIN_QUOTES,
  SENTENCE_QUOTES,
} from './consistency-quotes.test-fixture.ts';

/**
 What the pass made of each slice of the cat page when the archive stands everywhere.
 */
const ENGLISH = archiveEnglishOf({ prepared: preparedCatPage(), },);

/**
 The ballots of three judges who all choose one place and keep none.

 @param quotes - the quotes every judge gives

 @param choice - the label every judge chooses

 @returns The voices, in seat order

 @example
 ```ts
 const voices = alikeVoices({ quotes: SENTENCE_QUOTES, choice: 'OCCURRENCE 1', },);
 ```
 */
function alikeVoices(
  {
    quotes,
    choice,
  }: {
    readonly quotes: readonly Record<string, string>[];
    readonly choice: string;
  },
) {
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
      choice,
      keep: [] as string[],
    };
  },);
}

/**
 The carry of every receiving place when the bench chooses the chosen words moved in by code, as the
 pass would record it where the writers wrote nothing; a place the code cannot reach keeps its English.

 @param decided - the group with its receivers

 @returns One carried place per receiver, in the order of the receivers

 @example
 ```ts
 const carried = carriedBySplice({ decided, },);
 ```
 */
function carriedBySplice({ decided, }: { readonly decided: DecidedGroup; },): readonly UnitCarried[] {
  return decided.receivers
    .map(function carryOf(receiver,): UnitCarried {
      /**
       The paragraph the receiving place has now.
       */
      const current = receiver.place.slice.current.kind === 'present' ? receiver.place.slice.current.text : '';
      if (receiver.plan.kind !== 'replace') {
        return {
          carries: [
            {
              label: receiver.label,
              candidates: [{ label: 'CANDIDATE 1', kind: 'current', writers: [], text: current, },],
              ballots: [],
              usable: 0,
              quorum: 0,
              decision: { kind: 'none', reason: 'no-alternative', },
            },
          ],
          edits: [],
          findings: [],
        };
      }
      return {
        carries: [
          {
            label: receiver.label,
            candidates: [
              { label: 'CANDIDATE 1', kind: 'current', writers: [], text: current, },
              { label: 'CANDIDATE 2', kind: 'splice', writers: [], text: receiver.plan.text, },
            ],
            ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotOf(seat,) {
              return { seat, reason: 'The chosen words belong here.', choice: 'CANDIDATE 2', };
            },),
            usable: 3,
            quorum: 2,
            decision: { kind: 'chosen', label: 'CANDIDATE 2', },
          },
        ],
        edits: [
          {
            kind: 'splice',
            placePositions: [receiver.position,],
            sliceIndex: receiver.place.slice.sliceIndex,
            start: receiver.plan.start,
            end: receiver.plan.end,
            text: receiver.plan.text,
          },
        ],
        findings: [],
      };
    },);
}

/**
 The cat page's two groups settled from scripted ballots, beside the facts of its slices.

 @param prepared - preparation of the page, the cat page by default

 @param english - what each slice would ship, the archive by default

 @param sentenceQuotes - the quotes the judges give for the repeated sentence

 @param frameQuotes - the quotes the judges give for the refrain

 @param choice - the label the judges choose, the first place by default

 @returns The settled groups in page order and the facts of every slice

 @example
 ```ts
 const { settled, slices, } = settledCatPage({},);
 ```
 */
function settledCatPage(
  {
    prepared = preparedCatPage(),
    english = archiveEnglishOf({ prepared, },),
    sentenceQuotes = SENTENCE_QUOTES,
    frameQuotes = REFRAIN_QUOTES,
    choice = 'OCCURRENCE 1',
  }: {
    readonly prepared?: ReturnType<typeof preparedCatPage>;
    readonly english?: readonly string[];
    readonly sentenceQuotes?: readonly Record<string, string>[];
    readonly frameQuotes?: readonly Record<string, string>[];
    readonly choice?: string;
  },
): {
  readonly settled: readonly SettledGroup[];
  readonly slices: readonly ConsistencySliceFacts[];
} {
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
        const decided = settleAsked({
          repeat: repeatOf({ group, text, },),
          places,
          unplaced: unplacedOf({ group, },),
          asked: {
            quorum: 2,
            voices: alikeVoices({ quotes: (group.kind === 'refrain') ? frameQuotes : sentenceQuotes, choice, },),
            findings: [],
            resumed: false,
          },
        },);
        return settleCarried({ decided, carried: carriedBySplice({ decided, },), },);
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
 The text the third slice ships once the replacements are applied, as a list of zero or one.

 @param applied - what applying came to

 @returns The text of the third slice when it changed, none when it did not

 @example
 ```ts
 const third = thirdSliceOf({ applied, },);
 ```
 */
function thirdSliceOf({ applied, }: { readonly applied: ReturnType<typeof applyConsistency>; },): readonly string[] {
  return applied.slices
    .filter(function isThird({ sliceIndex, },): boolean {
      return sliceIndex === 2;
    },)
    .map(function textOf({ text, },): string {
      return text;
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
          name: 'MAKES THE REPLACEMENTS OF TWO PLACES OF ONE GROUP IN ONE SLICE TOGETHER, neither being left out as '
            + 'overlapping its own group, whether the carries are one for each place or one for the block',
          fn: async () => {
            const prepared = prepareDocumentPair({
              sourceText: '## 一\n\n窗台上的阳光让小猫睡着了。厨房里很暖和。窗台上的阳光让小猫睡着了。\n\n## 二\n\n窗台上的阳光让小猫睡着了。\n',
              targetText: '## One\n\nThe sunny window put the kitten to sleep. The kitchen was warm. The sun on the sill sent the '
                + 'kitten off to sleep.\n\n## Two\n\nThe window sun made the kitten fall asleep.\n',
            },);
            const page = settledCatPage({
              prepared,
              sentenceQuotes: [
                { label: 'OCCURRENCE 1', quote: 'The sunny window put the kitten to sleep', },
                { label: 'OCCURRENCE 2', quote: 'The sun on the sill sent the kitten off to sleep', },
                { label: 'OCCURRENCE 3', quote: 'The window sun made the kitten fall asleep', },
              ],
              choice: 'OCCURRENCE 3',
            },);
            const lines: string[] = [];
            const applied = applyCat({ page, lines, },);
            /**
             The same edits as one edit naming both places, as a writer's block would make.
             */
            const [group,] = page.settled;
            const [first, second,] = group?.edits ?? [];
            const together = applyCat({
              page: {
                ...page,
                settled: page.settled.map(function asOneBlock(settled,): SettledGroup {
                  return {
                    ...settled,
                    edits: ((first === undefined) || (second === undefined))
                      ? settled.edits
                      : [
                        {
                          kind: 'block',
                          placePositions: [...first.placePositions, ...second.placePositions,],
                          sliceIndex: first.sliceIndex,
                          start: first.start,
                          end: second.end,
                          text: 'The window sun made the kitten fall asleep. The kitchen was warm. The window sun made the kitten fall asleep',
                        },
                      ],
                  };
                },),
              },
              lines,
            },);
            expect({
              outcomes: outcomesOf({ groups: applied.groups, },),
              changed: applied.slices.map(function textOf(slice,): readonly [number, string] {
                return [slice.sliceIndex, slice.text,];
              },),
              editsPlanned: group?.edits.map(function positionsOf({ placePositions, },): readonly number[] {
                return placePositions;
              },),
              findings: applied.findings,
              lines,
              togetherOutcomes: outcomesOf({ groups: together.groups, },),
              togetherChanged: together.slices.map(function textOf(slice,): readonly [number, string] {
                return [slice.sliceIndex, slice.text,];
              },),
            },).toEqual({
              outcomes: [['replaced', 'replaced', 'chosen',],],
              changed: [
                [
                  0,
                  '## One\n\nThe window sun made the kitten fall asleep. The kitchen was warm. '
                  + 'The window sun made the kitten fall asleep.',
                ],
              ],
              editsPlanned: [[0,], [1,],],
              findings: [],
              lines: [],
              togetherOutcomes: [['replaced', 'replaced', 'chosen',],],
              togetherChanged: [
                [
                  0,
                  '## One\n\nThe window sun made the kitten fall asleep. The kitchen was warm. '
                  + 'The window sun made the kitten fall asleep.',
                ],
              ],
            },);
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
              rendering: { kind: 'located', quote: 'So this cat is surely a lazy little treasure', start: 58, slot: 'lazy', },
              outcome: 'replaced',
            },);
            expect(nonNullishOrThrow(sentence,).occurrences[1],).toEqual({
              label: 'OCCURRENCE 2',
              sliceIndex: 2,
              startOffset: 85,
              endOffset: 97,
              line: 11,
              rendering: { kind: 'located', quote: 'the sunlight on the sill lulled the kitten to sleep', start: 26, },
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
          name: 'RECORDS EACH GROUP\'S CARRIES AS THEY WERE SETTLED, one for each receiving place, beside its places',
          fn: async () => {
            const page = settledCatPage({},);
            const applied = applyCat({ page, lines: [], },);
            expect(applied.groups.map(function carriesOf(group,): unknown {
              return group.carries?.map(function labelOf({ label, decision, },): unknown {
                return [label, decision,];
              },);
            },),).toEqual([
              [['OCCURRENCE 2', { kind: 'chosen', label: 'CANDIDATE 2', },],],
              [
                ['OCCURRENCE 2', { kind: 'chosen', label: 'CANDIDATE 2', },],
                ['OCCURRENCE 3', { kind: 'chosen', label: 'CANDIDATE 2', },],
                ['OCCURRENCE 4', { kind: 'chosen', label: 'CANDIDATE 2', },],
              ],
            ],);
            expect(applied.groups.map(function carriesOf(group,): unknown {
              return group.carries;
            },),).toEqual(page.settled.map(function carriesOf(group,): unknown {
              return group.carries;
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
          name: 'LEAVES OUT A BLOCK REPLACEMENT THAT CHANGES THE WORDS ANOTHER GROUP LOCATED IN IT, whichever order the groups '
            + 'come in, recording overlapped for the places it carried and keeping a finding that names both groups',
          fn: async () => {
            const page = settledCatPage({},);
            const third = nonNullishOrThrow(page.slices[2],);
            const english = third.current.kind === 'present' ? third.current.text : '';
            const blockStart = english.indexOf('In the evening',);
            /**
             The page with the sentence group's replacement in the third slice made over the whole paragraph, as a
             writer's block would be.
             */
            function withBlockText({ text, }: { readonly text: string; },): ReturnType<typeof settledCatPage> {
              return {
                ...page,
                settled: page.settled.map(function rewritten(group, at,): SettledGroup {
                  return (at === 0)
                    ? {
                      ...group,
                      edits: [
                        {
                          kind: 'block',
                          placePositions: [1,],
                          sliceIndex: 2,
                          start: blockStart,
                          end: english.length,
                          text,
                        },
                      ],
                    }
                    : group;
                },),
              };
            }
            const rewritten = withBlockText({
              text: 'In the evening, the sunny window put the kitten to sleep, and the fish snacks smiled too. '
                + 'So this cat is a darling.',
            },);
            const lines: string[] = [];
            const forward = applyCat({ page: rewritten, lines, },);
            const backwardLines: string[] = [];
            const backward = applyCat({
              page: { ...rewritten, settled: rewritten.settled.toReversed(), },
              lines: backwardLines,
            },);
            const kept = '## Three\n\nIn the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks '
              + 'smiled too. So this cat must be a sweet little treasure.';
            expect({
              forward: outcomesOf({ groups: forward.groups, },),
              backward: outcomesOf({ groups: backward.groups, },),
              forwardThird: thirdSliceOf({ applied: forward, },),
              backwardThird: thirdSliceOf({ applied: backward, },),
              forwardFindings: forward.findings,
              backwardFindings: backward.findings,
              forwardWarned: lines,
              backwardWarned: backwardLines,
            },).toEqual({
              forward: [['chosen', 'overlapped',], ['chosen', 'replaced', 'replaced', 'replaced',],],
              backward: [['chosen', 'replaced', 'replaced', 'replaced',], ['chosen', 'overlapped',],],
              forwardThird: [kept,],
              backwardThird: [kept,],
              forwardFindings: [
                'slice 2: the consistency replacement of group 1 OCCURRENCE 2 was left out because it changes the words that '
                + 'group 2 OCCURRENCE 3 located',
              ],
              backwardFindings: [
                'slice 2: the consistency replacement of group 2 OCCURRENCE 2 was left out because it changes the words that '
                + 'group 1 OCCURRENCE 3 located',
              ],
              forwardWarned: [
                'warn [applyConsistency] slice 2: the consistency replacement of group 1 OCCURRENCE 2 was left out because it '
                + 'changes the words that group 2 OCCURRENCE 3 located',
              ],
              backwardWarned: [
                'warn [applyConsistency] slice 2: the consistency replacement of group 2 OCCURRENCE 2 was left out because it '
                + 'changes the words that group 1 OCCURRENCE 3 located',
              ],
            },);
          },
        },),
        it({
          name: 'MAKES A BLOCK REPLACEMENT THAT STILL HOLDS THE WORDS ANOTHER GROUP LOCATED, the later group\'s replacement '
            + 'there being left out as overlapping it, and leaves out one that cuts those words in half',
          fn: async () => {
            const page = settledCatPage({},);
            const third = nonNullishOrThrow(page.slices[2],);
            const english = third.current.kind === 'present' ? third.current.text : '';
            const blockStart = english.indexOf('In the evening',);
            /**
             What applying the page comes to with the sentence group's replacement in the third slice changed.
             */
            function appliedWith(
              { start, text, }: { readonly start: number; readonly text: string; },
            ): ReturnType<typeof applyConsistency> {
              return applyCat({
                page: {
                  ...page,
                  settled: page.settled.map(function rewritten(group, at,): SettledGroup {
                    return (at === 0)
                      ? {
                        ...group,
                        edits: [
                          { kind: 'block', placePositions: [1,], sliceIndex: 2, start, end: english.length, text, },
                        ],
                      }
                      : group;
                  },),
                },
                lines: [],
              },);
            }
            const holding = appliedWith({
              start: blockStart,
              text: 'In the evening, the sunny window put the kitten to sleep, and the fish snacks smiled too. '
                + 'So this cat has to be a sweet little darling.',
            },);
            const cutting = appliedWith({
              start: english.indexOf('this cat',),
              text: 'cat is a darling.',
            },);
            expect({
              holding: outcomesOf({ groups: holding.groups, },),
              holdingFindings: holding.findings,
              cutting: outcomesOf({ groups: cutting.groups, },),
              cuttingFindings: cutting.findings,
            },).toEqual({
              holding: [['chosen', 'replaced',], ['chosen', 'replaced', 'overlapped', 'replaced',],],
              holdingFindings: [],
              cutting: [['chosen', 'overlapped',], ['chosen', 'replaced', 'replaced', 'replaced',],],
              cuttingFindings: [
                'slice 2: the consistency replacement of group 1 OCCURRENCE 2 was left out because it changes the words that '
                + 'group 2 OCCURRENCE 3 located',
              ],
            },);
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
              'ConsistencyInvariantError: unreachable: OCCURRENCE 2 of group 1 has no rendering or outcome, '
              + 'and both are made for every place',
              'ConsistencyInvariantError: unreachable: OCCURRENCE 1 of group 1 has no rendering or outcome, '
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
              'ConsistencyInvariantError: unreachable: OCCURRENCE 2 of group 1 was to be replaced and no replacement was applied, '
              + 'left out or refused, and every pending replacement is one of the three',
            );
          },
        },),
      ],
    },),
  ],
},);
