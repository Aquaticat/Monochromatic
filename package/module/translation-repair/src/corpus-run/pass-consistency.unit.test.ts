/**
 Tests for the page-level consistency pass: when it asks the bench, how the
 ballots settle a repeated sentence and a refrain, what it leaves as it stands
 and why, what the floors refuse, what a resumed page reads back, and that no
 trouble stops a run from shipping.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { chmodSync, } from 'node:fs';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactConsistency,
  NO_CONSISTENCY,
  parseConsistency,
  prepareDocumentPair,
  type RosterModelId,
  runPassConsistency,
} from '../../dist/final/node/index.mjs';
import { HANG_STOP_MS, } from '../hang-stop.test-fixture.ts';
import { warnLinesDuring, } from '../console-warn-lines.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { SCRIPTED_STAGE_SETTINGS, } from '../stage-settings.test-fixture.ts';
import {
  archiveEnglishOf,
  ballotText,
  firstPlaceWins,
  isRefrainSheet,
  preparedCatPage,
  projectedCatPage,
  REFRAIN_QUOTES,
  refrainAnsweredInOrder,
  refrainChoosing,
  scriptedJudgeClient,
  type SeatBehaviour,
  SENTENCE_QUOTES,
} from './consistency-page.test-fixture.ts';
import {
  type CatRun,
  DIGEST,
  runCatPass,
} from './consistency-run.test-fixture.ts';

/**
 Logger the pass writes to, whose lines are not under test.
 */
const l = tagged({ tag: 'pass-consistency-test', },);

/**
 What the pass left of the page's second slice: the refrain carried to the
 first slice's pattern with its own slot.
 */
const SLICE_ONE_AFTER = '## Two\n\nThe smell of fish in the kitchen woke the kitten. So this cat must be a lazy little treasure.';

/**
 What the pass left of the third slice: the sentence carried from the first
 slice and the refrain carried to its pattern.
 */
const SLICE_TWO_AFTER = '## Three\n\nIn the evening, the sunny window put the kitten to sleep, and the fish snacks smiled too. '
  + 'So this cat must be a sweet little treasure.';

/**
 What the pass left of the fourth slice.
 */
const SLICE_THREE_AFTER = '## Four\n\nThe rain in the yard sent the kitten running home. So this cat must be a warm little treasure.';

/**
 Makes a directory unwritable until the scope that holds the result ends.

 @param path - directory to close to writing

 @returns Its path, with the means of opening it again on disposal

 @example
 ```ts
 using closed = readOnlyDirectory({ path: dir.path, },);
 ```
 */
function readOnlyDirectory({ path, }: { readonly path: string; },): Disposable & { readonly path: string; } {
  chmodSync(
    path,
    0o500,
  );
  return {
    path,
    [Symbol.dispose]: function reopen(): void {
      chmodSync(
        path,
        0o700,
      );
    },
  };
}

/**
 The texts the pass changed, by slice.

 @param consistency - the section

 @returns Slice index and text of every changed slice

 @example
 ```ts
 const changed = changedTexts({ consistency, },);
 ```
 */
function changedTexts(
  { consistency, }: { readonly consistency: ArtifactConsistency; },
): readonly (readonly [number, string])[] {
  return consistency.slices
    .map(function pair(slice,): readonly [number, string] {
      return [slice.sliceIndex, slice.text,];
    },);
}

/**
 Outcomes of a group's places, in order.

 @param consistency - the section

 @param group - position of the group on the page

 @returns One outcome per place

 @example
 ```ts
 const outcomes = outcomesOf({ consistency, group: 0, },);
 ```
 */
function outcomesOf(
  {
    consistency,
    group,
  }: {
    readonly consistency: ArtifactConsistency;
    readonly group: number;
  },
): readonly string[] {
  return nonNullishOrThrow(consistency.groups[group],)
    .occurrences
    .map(function outcomeOf(occurrence,): string {
      return occurrence.outcome;
    },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: runPassConsistency.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'FINDS THE TWO GROUPS OF THE CAT PAGE, a repeated sentence and a refrain of four lines, in page '
            + 'order, so the cases here run over the shape the pass was built for',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            expect(run.consistency.groups.map(function repeatOf(group,): string {
              return group.repeat.kind;
            },),).toEqual(['maximal', 'refrain',],);
            expect(run.consistency.groups.map(function placedOf(group,): number {
              return group.occurrences.length;
            },),).toEqual([2, 4,],);
          },
        },),
        it({
          name: 'ASKS NOBODY AND CHANGES NOTHING for a page that repeats no wording',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = prepareDocumentPair({
              sourceText: '## 一\n\n小猫在窗台上打盹。\n\n## 二\n\n小鱼在水里游来游去。\n',
              targetText: '## One\n\nThe kitten naps on the sill.\n\n## Two\n\nThe fish swims about in the water.\n',
            },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, },);
            expect(run.consistency,).toEqual(NO_CONSISTENCY,);
            expect(run.asked,).toEqual([],);
          },
        },),
        it({
          name: 'CARRIES A REPEATED SENTENCE AND A REFRAIN TO ONE RENDERING EACH where the archive stands in every '
            + 'slice, the live case\'s shape: four lines one way, two sentences one way',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            expect(changedTexts({ consistency: run.consistency, },),).toEqual([
              [1, SLICE_ONE_AFTER,],
              [2, SLICE_TWO_AFTER,],
              [3, SLICE_THREE_AFTER,],
            ],);
            expect([
              outcomesOf({ consistency: run.consistency, group: 0, },),
              outcomesOf({ consistency: run.consistency, group: 1, },),
            ],).toEqual([
              ['chosen', 'replaced',],
              ['chosen', 'replaced', 'replaced', 'replaced',],
            ],);
          },
        },),
        it({
          name: 'RECORDS A GROUP\'S WORDING, EVERY BALLOT, THE USABLE COUNT, THE QUORUM, THE WINNER AND EACH PLACE\'S '
            + 'OFFSETS AND LOCATED QUOTE, and the record reads back through the reader',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            const [sentence,] = run.consistency.groups;
            const group = nonNullishOrThrow(sentence,);
            expect(group.repeat,).toEqual({ kind: 'maximal', wording: '窗台上的阳光让小猫睡着了', },);
            expect(group.occurrences,).toEqual([
              {
                label: 'OCCURRENCE 1',
                sliceIndex: 0,
                startOffset: 6,
                endOffset: 18,
                line: 3,
                rendering: { kind: 'located', quote: 'The sunny window put the kitten to sleep.', },
                outcome: 'chosen',
              },
              {
                label: 'OCCURRENCE 2',
                sliceIndex: 2,
                startOffset: 85,
                endOffset: 97,
                line: 11,
                rendering: { kind: 'located', quote: 'the sunlight on the sill lulled the kitten to sleep', },
                outcome: 'replaced',
              },
            ],);
            expect(group.unplaced,).toEqual([],);
            expect(group.verdict.kind,).toBe('asked',);
            if (group.verdict.kind === 'asked') {
              expect(group.verdict.usable,).toBe(group.verdict.ballots.length,);
              expect(group.verdict.winner,).toEqual({ kind: 'chosen', label: 'OCCURRENCE 1', },);
              expect(group.verdict.ballots[0],).toEqual({
                seat: run.asked[0],
                reason: 'The first rendering is the most faithful to the original, and the others differ in wording only.',
                quotes: SENTENCE_QUOTES,
                choice: 'OCCURRENCE 1',
                keep: [],
              },);
            }
            expect(parseConsistency({
              value: structuredClone(run.consistency,),
              path: 'cat.consistency',
              writesSection: true,
              sliceIndexes: new Set([0, 1, 2, 3,],),
            },),).toEqual(run.consistency,);
          },
        },),
        it({
          name: 'RECORDS A REFRAIN\'S FRAME AND EACH LINE\'S SLOT OFFSETS AND SLOT',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            const group = nonNullishOrThrow(run.consistency.groups[1],);
            expect(group.repeat,).toEqual({ kind: 'refrain', prefix: '所以这只猫一定是', suffix: '的小宝贝', },);
            expect(group.occurrences[1],).toEqual({
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
          },
        },),
        it({
          name: 'PUTS THE SAME CARRIED WORDING IN THE SLICE WHERE THE LANES SHIPPED WORDING OTHER THAN THE ARCHIVE\'S, '
            + 'since the pass reads what each slice would ship and not what the archive holds',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const archive = archiveEnglishOf({ prepared, },);
            const run = await runCatPass({
              behave: firstPlaceWins,
              entryCacheDir: dir.path,
              prepared,
              english: [
                archive[0] as string,
                '## Two\n\nThe smell of fish woke the kitten in the kitchen. So this cat is surely a lazy little treasure.',
                archive[2] as string,
                archive[3] as string,
              ],
            },);
            expect(changedTexts({ consistency: run.consistency, },)[0],).toEqual([
              1,
              '## Two\n\nThe smell of fish woke the kitten in the kitchen. So this cat must be a lazy little treasure.',
            ],);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'replaced',
              'replaced',
              'replaced',
            ],);
          },
        },),
        it({
          name: 'ASKS NO JUDGE ABOUT A GROUP WHOSE PLACES ALREADY READ ALIKE, each alone in a slice with one '
            + 'English, and records it consistent',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const english = [...archiveEnglishOf({ prepared, },),];
            english[2] = english[0] as string;
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, english, },);
            const group = nonNullishOrThrow(run.consistency.groups[0],);
            expect(group.verdict,).toEqual({ kind: 'not-asked', reason: 'consistent', },);
            expect(outcomesOf({ consistency: run.consistency, group: 0, },),).toEqual(['consistent', 'consistent',],);
            expect(run.sheets.every(function asksAboutFrame(sheet,): boolean {
              return isRefrainSheet({ sheet, },);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'ASKS THE JUDGES ABOUT A GROUP WHOSE TWO PLACES SHARE ONE SLICE even where the slice\'s English is one '
            + 'text, since the slice may render the wording twice',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = prepareDocumentPair({
              sourceText: '窗台上的阳光让小猫睡着了。\n\n傍晚的时候，窗台上的阳光让小猫睡着了，小鱼干也笑了。\n',
              targetText: 'The sunny window put the kitten to sleep.\n\nIn the evening, the sunlight on the sill '
                + 'lulled the kitten to sleep, and the fish snacks smiled too.\n',
            },);
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, },);
            expect(nonNullishOrThrow(run.consistency.groups[0],).verdict.kind,).toBe('asked',);
            expect(changedTexts({ consistency: run.consistency, },),).toEqual([
              [
                0,
                'The sunny window put the kitten to sleep.\n\nIn the evening, the sunny window put the '
                + 'kitten to sleep, and the fish snacks smiled too.',
              ],
            ],);
          },
        },),
        it({
          name: 'ASKS NOBODY WHEN EVERY GROUP ALREADY READS ALIKE, reading no seat and recording the group consistent',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = prepareDocumentPair({
              sourceText: '## 一\n\n窗台上的阳光让小猫睡着了。\n\n## 二\n\n窗台上的阳光让小猫睡着了。\n',
              targetText: '## One\n\nThe sunny window put the kitten to sleep.\n\n## Two\n\nThe sunny window put the kitten to sleep.\n',
            },);
            const alike = '## One\n\nThe sunny window put the kitten to sleep.';
            const run = await runCatPass({
              behave: firstPlaceWins,
              entryCacheDir: dir.path,
              prepared,
              english: [alike, alike,],
            },);
            expect(run.asked,).toEqual([],);
            expect(run.consistency.slices,).toEqual([],);
            expect(nonNullishOrThrow(run.consistency.groups[0],).verdict,).toEqual({ kind: 'not-asked', reason: 'consistent', },);
          },
        },),
        it({
          name: 'RECORDS A PLACE THAT ALREADY CARRIES THE CHOSEN PATTERN AS CONSISTENT, and replaces the others',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const archive = archiveEnglishOf({ prepared, },);
            const run = await runCatPass({
              behave: function fourthAlreadyFollows({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [
                        ...REFRAIN_QUOTES.slice(0, 3,),
                        { label: 'OCCURRENCE 4', quote: 'So this cat must be a warm little treasure.', slot: 'warm', },
                      ],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  }
                  : firstPlaceWins({ sheet, },);
              },
              entryCacheDir: dir.path,
              prepared,
              english: [
                archive[0] as string,
                archive[1] as string,
                archive[2] as string,
                '## Four\n\nThe rain in the yard sent the kitten running home. So this cat must be a warm little treasure.',
              ],
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'replaced',
              'replaced',
              'consistent',
            ],);
            expect(changedTexts({ consistency: run.consistency, },).map(function indexOf([index,],): number {
              return index;
            },),).toEqual([1, 2,],);
          },
        },),
        it({
          name: 'RECORDS AND SKIPS A GROUP WITH FEWER THAN TWO PLACED OCCURRENCES, listing the occurrence no slice holds '
            + 'as unplaced and leaving it as it stands',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const whole = preparedCatPage();
            const prepared = {
              ...whole,
              slices: whole.slices.filter(function notThird(slice,): boolean {
                return slice.source.sliceIndex !== 2;
              },),
            };
            const run = await runCatPass({
              behave: function threePlaces({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [
                        REFRAIN_QUOTES[0] as Record<string, string>,
                        REFRAIN_QUOTES[1] as Record<string, string>,
                        { ...REFRAIN_QUOTES[3], label: 'OCCURRENCE 3', } as Record<string, string>,
                      ],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  }
                  : firstPlaceWins({ sheet, },);
              },
              entryCacheDir: dir.path,
              prepared,
            },);
            const sentence = nonNullishOrThrow(run.consistency.groups[0],);
            expect(sentence.verdict,).toEqual({ kind: 'not-asked', reason: 'too-few-placed', },);
            expect(sentence.unplaced,).toEqual([
              { startOffset: 85, endOffset: 97, line: 11, reason: 'in-no-slice', },
            ],);
            expect(outcomesOf({ consistency: run.consistency, group: 0, },),).toEqual(['untouched',],);
            const refrain = nonNullishOrThrow(run.consistency.groups[1],);
            expect(refrain.occurrences.length,).toBe(3,);
            expect(refrain.unplaced.length,).toBe(1,);
            expect(changedTexts({ consistency: run.consistency, },),).toEqual([
              [1, SLICE_ONE_AFTER,],
              [3, SLICE_THREE_AFTER,],
            ],);
          },
        },),
        it({
          name: 'ASKS NOBODY ABOUT A GROUP WITH ENGLISH IN FEWER THAN TWO PLACES, since there is nothing to carry between them',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const english = [...archiveEnglishOf({ prepared, },),];
            english[2] = '';
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, english, },);
            expect(nonNullishOrThrow(run.consistency.groups[0],).verdict,).toEqual({
              kind: 'not-asked',
              reason: 'no-english',
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 0, },),).toEqual(['untouched', 'untouched',],);
          },
        },),
        it({
          name: 'KEEPS A PLACE WHOSE CONTEXT CALLS FOR DIFFERENT WORDING when a strict majority list it, and still '
            + 'carries the other group to it',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: function keepsTheSecond({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? firstPlaceWins({ sheet, },)
                  : {
                    kind: 'answers',
                    text: ballotText({ quotes: SENTENCE_QUOTES, choice: 'OCCURRENCE 1', keep: ['OCCURRENCE 2',], },),
                  };
              },
              entryCacheDir: dir.path,
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 0, },),).toEqual(['chosen', 'kept-context',],);
            expect(changedTexts({ consistency: run.consistency, },)[1],).toEqual([
              2,
              '## Three\n\nIn the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks '
              + 'smiled too. So this cat must be a sweet little treasure.',
            ],);
          },
        },),
        it({
          name: 'LEAVES A GROUP AS IT STANDS ON A TIE between two places, four usable ballots splitting two and two',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: refrainAnsweredInOrder({
                answers: [
                  refrainChoosing({ choice: 'OCCURRENCE 1', },),
                  refrainChoosing({ choice: 'OCCURRENCE 1', },),
                  refrainChoosing({ choice: 'OCCURRENCE 2', },),
                  refrainChoosing({ choice: 'OCCURRENCE 2', },),
                ],
              },),
              entryCacheDir: dir.path,
            },);
            const refrain = nonNullishOrThrow(run.consistency.groups[1],);
            expect(refrain.verdict.kind === 'asked' ? [refrain.verdict.usable, refrain.verdict.winner,] : [],).toEqual([
              4,
              { kind: 'none', reason: 'no-majority', },
            ],);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'untouched',
              'untouched',
              'untouched',
              'untouched',
            ],);
            expect(changedTexts({ consistency: run.consistency, },).map(function indexOf([index,],): number {
              return index;
            },),).toEqual([2,],);
            // The gather reached its quorum with one seat short, so it was stored with its findings and a resume reads them back.
            const again = await runCatPass({
              behave: function throwsAlways(): SeatBehaviour {
                return { kind: 'throws', };
              },
              entryCacheDir: dir.path,
            },);
            expect(again.asked,).toEqual([],);
            expect(again.consistency,).toEqual(run.consistency,);
          },
        },),
        it({
          name: 'LEAVES A GROUP AS IT STANDS WHEN NO PLACE HAS A MAJORITY, five usable ballots splitting two, two and one',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: refrainAnsweredInOrder({
                answers: [
                  refrainChoosing({ choice: 'OCCURRENCE 1', },),
                  refrainChoosing({ choice: 'OCCURRENCE 1', },),
                  refrainChoosing({ choice: 'OCCURRENCE 2', },),
                  refrainChoosing({ choice: 'OCCURRENCE 2', },),
                  refrainChoosing({ choice: 'OCCURRENCE 3', },),
                ],
              },),
              entryCacheDir: dir.path,
            },);
            const refrain = nonNullishOrThrow(run.consistency.groups[1],);
            expect(refrain.verdict.kind === 'asked' ? [refrain.verdict.usable, refrain.verdict.winner,] : [],).toEqual([
              5,
              { kind: 'none', reason: 'no-majority', },
            ],);
          },
        },),
        it({
          name: 'LEAVES A GROUP AS IT STANDS BELOW THE QUORUM THE GATHER CLOSED ON, and stores nothing for a resume',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const behave = refrainAnsweredInOrder({
              answers: [
                refrainChoosing({ choice: 'OCCURRENCE 1', },),
                refrainChoosing({ choice: 'OCCURRENCE 1', },),
                refrainChoosing({ choice: 'OCCURRENCE 1', },),
              ],
            },);
            const first = await runCatPass({ behave, entryCacheDir: dir.path, },);
            const refrain = nonNullishOrThrow(first.consistency.groups[1],);
            expect(refrain.verdict.kind === 'asked'
              ? [refrain.verdict.usable, refrain.verdict.quorum, refrain.verdict.winner,]
              : [],).toEqual([
                3,
                4,
                { kind: 'none', reason: 'no-quorum', },
              ],);
            const again = await runCatPass({
              behave: refrainAnsweredInOrder({ answers: [], },),
              entryCacheDir: dir.path,
            },);
            // The repeated sentence's gather reached its quorum and was stored; the refrain's did not, so it is asked again.
            expect(again.asked.length,).toBeGreaterThan(0,);
            expect(again.sheets.every(function asksFrame(sheet,): boolean {
              return isRefrainSheet({ sheet, },);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'SHIPS THE PAGE UNCHANGED WHEN EVERY JUDGE THROWS, recording the groups it asked about and no slice changed',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: function throwsAlways(): SeatBehaviour {
                return { kind: 'throws', };
              },
              entryCacheDir: dir.path,
            },);
            expect(run.consistency.slices,).toEqual([],);
            expect(run.consistency.groups.map(function verdictOf(group,): unknown {
              return group.verdict.kind === 'asked' ? [group.verdict.usable, group.verdict.winner,] : group.verdict.kind;
            },),).toEqual([
              [0, { kind: 'none', reason: 'no-quorum', },],
              [0, { kind: 'none', reason: 'no-quorum', },],
            ],);
            expect(run.consistency.groups.flatMap(function outcomes(group,): readonly string[] {
              return group.occurrences.map(function outcomeOf(occurrence,): string {
                return occurrence.outcome;
              },);
            },).every(function untouched(outcome,): boolean {
              return outcome === 'untouched';
            },),).toBe(true,);
          },
        },),
        it({
          name: 'LEAVES A PLACE UNLOCATED WHEN ITS QUOTE IS MISSING FROM, EMPTY OR AMBIGUOUS IN ITS ENGLISH, the group\'s '
            + 'other places and the other group carried all the same',
          fn: async () => {
            /**
             Runs the pass with a quote for the second place of the sentence.
             */
            async function withQuote(
              { quote, english, }: { readonly quote: string; readonly english?: readonly string[]; },
            ): Promise<CatRun> {
              await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
              return await runCatPass({
                behave: function quotesTheSecond({ sheet, },): SeatBehaviour {
                  return isRefrainSheet({ sheet, },)
                    ? firstPlaceWins({ sheet, },)
                    : {
                      kind: 'answers',
                      text: ballotText({
                        quotes: [SENTENCE_QUOTES[0] as Record<string, string>, { label: 'OCCURRENCE 2', quote, },],
                        choice: 'OCCURRENCE 1',
                        keep: [],
                      },),
                    };
                },
                entryCacheDir: dir.path,
                ...((english === undefined) ? {} : { english, }),
              },);
            }
            const prepared = preparedCatPage();
            const archive = archiveEnglishOf({ prepared, },);
            const twice = [
              archive[0] as string,
              archive[1] as string,
              '## Three\n\nIn the evening, the sunlight lulled the kitten to sleep, and the kitten to sleep again. '
              + 'So this cat has to be a sweet little darling.',
              archive[3] as string,
            ];
            const [missing, empty, ambiguous,] = [
              await withQuote({ quote: 'the lamp on the sill lulled the kitten to sleep', },),
              await withQuote({ quote: '', },),
              await withQuote({ quote: 'the kitten to sleep', english: twice, },),
            ];
            expect([missing, empty, ambiguous,].map(function placeOf(run,): unknown {
              const [, occurrence,] = nonNullishOrThrow(run.consistency.groups[0],).occurrences;
              return [occurrence?.outcome, occurrence?.rendering,];
            },),).toEqual([
              ['unlocated', { kind: 'unlocated', reason: 'not-found', },],
              ['unlocated', { kind: 'unlocated', reason: 'empty', },],
              ['unlocated', { kind: 'unlocated', reason: 'ambiguous', },],
            ],);
            expect(changedTexts({ consistency: missing.consistency, },).map(function indexOf([index,],): number {
              return index;
            },),).toEqual([1, 2, 3,],);
            expect(nonNullishOrThrow(missing.consistency.slices[1],).text,).toBe(
              '## Three\n\nIn the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks '
              + 'smiled too. So this cat must be a sweet little treasure.',
            );
          },
        },),
        it({
          name: 'LEAVES THE GROUP AS IT STANDS WHEN THE PLACE A MAJORITY CHOSE HAS NO LOCATED QUOTE',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: function quotesNothingForTheFirst({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? firstPlaceWins({ sheet, },)
                  : {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [SENTENCE_QUOTES[1] as Record<string, string>,],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  };
              },
              entryCacheDir: dir.path,
            },);
            const sentence = nonNullishOrThrow(run.consistency.groups[0],);
            expect(sentence.verdict.kind === 'asked' ? sentence.verdict.winner : null,).toEqual({
              kind: 'none',
              reason: 'chosen-unlocated',
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 0, },),).toEqual(['untouched', 'untouched',],);
          },
        },),
        it({
          name: 'LEAVES A FRAME\'S PLACE UNLOCATED WHEN ITS SLOT IS NOT IN ITS QUOTE, and carries the frame to the others',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: function slotNotInQuote({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [
                        REFRAIN_QUOTES[0] as Record<string, string>,
                        { ...REFRAIN_QUOTES[1], slot: 'bored', } as Record<string, string>,
                        REFRAIN_QUOTES[2] as Record<string, string>,
                        REFRAIN_QUOTES[3] as Record<string, string>,
                      ],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  }
                  : firstPlaceWins({ sheet, },);
              },
              entryCacheDir: dir.path,
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'unlocated',
              'replaced',
              'replaced',
            ],);
            expect(nonNullishOrThrow(run.consistency.groups[1],).occurrences[1]?.rendering,).toEqual({
              kind: 'unlocated',
              reason: 'slot-not-found',
            },);
          },
        },),
        it({
          name: 'LEAVES THE LATER OF TWO GROUPS\' REPLACEMENTS OUT WHEN THEIR WORDS OVERLAP IN ONE SLICE, recording '
            + 'overlapped, the earlier group winning',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const run = await runCatPass({
              behave: function sentenceQuoteSpansTheRefrain({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? firstPlaceWins({ sheet, },)
                  : {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [
                        SENTENCE_QUOTES[0] as Record<string, string>,
                        {
                          label: 'OCCURRENCE 2',
                          quote: 'the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too. '
                            + 'So this cat has to be a sweet little darling',
                        },
                      ],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  };
              },
              entryCacheDir: dir.path,
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'replaced',
              'overlapped',
              'replaced',
            ],);
            expect(changedTexts({ consistency: run.consistency, },)[1],).toEqual([
              2,
              '## Three\n\nIn the evening, the sunny window put the kitten to sleep.',
            ],);
          },
        },),
        it({
          name: 'READS BACK THE BALLOTS OF A SETTLED GATHER ON A RESUME, asking nobody and landing on the same page',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const first = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            const second = await runCatPass({
              behave: function throwsAlways(): SeatBehaviour {
                return { kind: 'throws', };
              },
              entryCacheDir: dir.path,
            },);
            expect(first.asked.length,).toBeGreaterThan(0,);
            expect(second.asked,).toEqual([],);
            expect(second.consistency,).toEqual(first.consistency,);
          },
        },),
        it({
          name: 'ASKS AGAIN WHEN THE SHEET HAS CHANGED, since the key holds the whole sheet: a slice\'s English changed '
            + 'between runs is a new question',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, },);
            const prepared = preparedCatPage();
            const archive = archiveEnglishOf({ prepared, },);
            const second = await runCatPass({
              behave: firstPlaceWins,
              entryCacheDir: dir.path,
              prepared,
              english: [
                archive[0] as string,
                archive[1] as string,
                archive[2] as string,
                '## Four\n\nThe rain in the yard sent the kitten running home. So this cat is certainly a warm little treasure box.',
              ],
            },);
            expect(second.asked.length,).toBeGreaterThan(0,);
          },
        },),
        it({
          name: 'SHOWS EVERY SHEET THE PAGE\'S DECLARED NAMES AND CITED REFERENCES, and a bare page neither',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const whole = preparedCatPage();
            const named = await runCatPass({
              behave: firstPlaceWins,
              entryCacheDir: dir.path,
              prepared: {
                ...whole,
                identityContext: '- name: ORIGINAL declares "咪咪", TRANSLATION declares "Mittens"',
                referenceContext: '- reference 1 https://example.org/mittens ("Mittens"): Mittens had a sister.',
              },
            },);
            await using other = await scratchDir({ prefix: 'pass-consistency-', },);
            const bare = await runCatPass({ behave: firstPlaceWins, entryCacheDir: other.path, },);
            expect([
              named.sheets.every(function carries(sheet,): boolean {
                return sheet.includes('TRANSLATION declares "Mittens"',) && sheet.includes('Mittens had a sister.',);
              },),
              bare.sheets.some(function carries(sheet,): boolean {
                return sheet.includes('Mittens',);
              },),
            ],).toEqual([true, false,],);
          },
        },),
        it({
          name: 'LEAVES A GROUP WHOSE HANDLING FAILED AS IT STANDS and says so in its verdict, without stopping the '
            + 'other groups or the pass',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const whole = preparedCatPage();
            const prepared = {
              ...whole,
              slices: whole.slices.map(function blanked(slice,) {
                return {
                  ...slice,
                  source: {
                    ...slice.source,
                    nodes: slice.source.nodes.map(function wrong(node,) {
                      return { ...node, text: '＊'.repeat(node.text.length,), };
                    },),
                  },
                };
              },),
            };
            const run = await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, },);
            /**
             What each group's handling failed with: the offsets of its first place read other words in the block shown.
             */
            const detail = 'refused by ConsistencyInvariantError';
            expect(run.consistency.groups.map(function verdictOf(group,): unknown {
              return group.verdict;
            },),).toEqual([
              { kind: 'failed', detail, },
              { kind: 'failed', detail, },
            ],);
            expect(run.consistency.slices,).toEqual([],);
            expect(run.asked,).toEqual([],);
          },
        },),
        it({
          name: 'KEEPS THE WHOLE PAGE AS IT STOOD WHEN THE PASS CANNOT RUN, recording the trouble in its findings',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const projected = projectedCatPage({ prepared, english: archiveEnglishOf({ prepared, },), });
            const asked: RosterModelId[] = [];
            const consistency = await runPassConsistency({
              client: scriptedJudgeClient({ behave: firstPlaceWins, asked, sheets: [], },),
              prepared,
              projected: { ...projected, comparison: projected.comparison.slice(0, 2,), },
              contestSlices: [],
              consolidateSlices: [],
              archiveDisputes: new Map(),
              entryCacheDir: dir.path,
              pipelineDigest: DIGEST,
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              overlap: 2,
              l,
              stageSettings: SCRIPTED_STAGE_SETTINGS,
            },);
            expect(consistency,).toEqual({
              groups: [],
              slices: [],
              findings: [
                'the consistency pass stopped (refused by ConsistencyInvariantError), so no slice was changed',
              ],
            },);
            expect(asked,).toEqual([],);
          },
        },),
        it({
          name: 'PASSES AN ABORT ON instead of recording it as trouble, since a stop is the caller\'s and not this pass\'s',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const stop = new AbortController();
            stop.abort(new Error('the entry was stopped',),);
            await expect(runCatPass({
              behave: firstPlaceWins,
              entryCacheDir: dir.path,
              signal: stop.signal,
            },),).rejects.toBe(stop.signal.reason,);
          },
        },),
      ],
    },),
    describe({
      name: `${runPassConsistency.name} logging a refusal`,
      concurrency: 1,
      children: [
        it({
          name: 'REFUSES A REPLACEMENT A FLOOR REFUSES, keeping the slice\'s wording, recording kept-floor and the '
            + 'floor\'s finding, and warning',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const whole = preparedCatPage();
            const prepared = { ...whole, declaredNames: ['Mittens',], };
            const archive = archiveEnglishOf({ prepared, },);
            const named = '## Two\n\nThe smell of fish in the kitchen woke the kitten. '
              + 'So this cat is surely Mittens, a lazy little treasure.';
            const { result: run, warned: warnings, } = await warnLinesDuring({
              run: async function passWithTheNameDropped(): Promise<CatRun> {
                return await runCatPass({
              behave: function slotWithTheName({ sheet, },): SeatBehaviour {
                return isRefrainSheet({ sheet, },)
                  ? {
                    kind: 'answers',
                    text: ballotText({
                      quotes: [
                        REFRAIN_QUOTES[0] as Record<string, string>,
                        {
                          label: 'OCCURRENCE 2',
                          quote: 'So this cat is surely Mittens, a lazy little treasure.',
                          slot: 'lazy',
                        },
                        REFRAIN_QUOTES[2] as Record<string, string>,
                        REFRAIN_QUOTES[3] as Record<string, string>,
                      ],
                      choice: 'OCCURRENCE 1',
                      keep: [],
                    },),
                  }
                  : firstPlaceWins({ sheet, },);
              },
              entryCacheDir: dir.path,
              prepared,
              english: [archive[0] as string, named, archive[2] as string, archive[3] as string,],
                },);
              },
            },);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'kept-floor',
              'replaced',
              'replaced',
            ],);
            expect(changedTexts({ consistency: run.consistency, },).map(function indexOf([index,],): number {
              return index;
            },),).toEqual([2, 3,],);
            expect(run.consistency.findings.length,).toBe(1,);
            expect(run.consistency.findings[0]?.startsWith('slice 1: the floors refused the consistency replacement: ',),)
              .toBe(true,);
            expect(warnings.some(function namesTheSlice(line,): boolean {
              return line.includes('slice 1: the floors refused the consistency replacement, so the slice keeps its wording',);
            },),).toBe(true,);
          },
        },),
        it({
          name: 'COUNTS THE BALLOTS IN HAND WHEN THE STORE REFUSES THEM, warning that a resume will ask again and '
            + 'leaving the page as the ballots decide',
          fn: async () => {
            await using dir = await scratchDir({ prefix: 'pass-consistency-', },);
            const prepared = preparedCatPage();
            const archive = archiveEnglishOf({ prepared, },);
            // The first run opens the store, so the second finds it and can only fail on writing an answer.
            await runCatPass({ behave: firstPlaceWins, entryCacheDir: dir.path, prepared, },);
            using readOnly = readOnlyDirectory({ path: dir.path, },);
            const { result: run, warned: warnings, } = await warnLinesDuring({
              run: async function passWithAStoreThatRefuses(): Promise<CatRun> {
                return await runCatPass({
                  behave: firstPlaceWins,
                  entryCacheDir: dir.path,
                  prepared,
                  english: [
                    archive[0] as string,
                    archive[1] as string,
                    archive[2] as string,
                    '## Four\n\nThe rain in the yard sent the kitten running home soon. So this cat is certainly a warm little dumpling.',
                  ],
                },);
              },
            },);
            expect(readOnly.path,).toBe(dir.path,);
            expect(outcomesOf({ consistency: run.consistency, group: 1, },),).toEqual([
              'chosen',
              'replaced',
              'replaced',
              'replaced',
            ],);
            expect(warnings.some(function namesTheStore(line,): boolean {
              return line.includes('the ballots could not be stored (',)
                && line.includes('); they are counted all the same',);
            },),).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);
