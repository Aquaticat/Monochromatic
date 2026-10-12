/**
 Tests for the texts offered for a receiving place's paragraph beside its
 current one: the English a located place has, the chosen words moved in by code
 where that is possible and every floor passes it, and the paragraphs the writer
 bench writes for the place that pass the floors.

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

import {
  type CarryBlock,
  type CarryContext,
  type CarryReceiver,
  ConsistencyInvariantError,
  englishOf,
  splicedParagraphOf,
  writtenOffers,
} from '../../dist/final/node/index.mjs';
import type { SeatBehaviour, } from './consistency-page.test-fixture.ts';
import { sheetKindOf, } from './consistency-sheet-reading.test-fixture.ts';
import {
  CARRY_REPEAT,
  carryScene,
  RECEIVING_ENGLISH,
  SPLICED_PARAGRAPH,
} from './consistency-carry.test-fixture.ts';

/**
 The one body block of the receiving English.
 */
const BLOCK: CarryBlock = { start: 0, end: RECEIVING_ENGLISH.length, text: RECEIVING_ENGLISH, };

/**
 What a seat does when every writer returns a paragraph with the chosen words in it, and a judge is never asked.

 @param seat - the seat asked

 @param sheet - the sheet it was shown

 @returns The seat's reply

 @example
 ```ts
 const behave: SeatScript = writersAnswer;
 ```
 */
function writersAnswer({ seat, sheet, }: { readonly seat: string; readonly sheet: string; },): SeatBehaviour {
  return (sheetKindOf({ sheet, },) === 'writer')
    ? { kind: 'answers', text: JSON.stringify({ translation: `Later the cat dozes in the sun (${seat}).`, },), }
    : { kind: 'throws', };
}

/**
 The receiving place with another plan.

 @param receiver - the receiving place

 @param plan - the plan for it

 @returns The receiver

 @example
 ```ts
 const unavailable = withPlan({ receiver, plan: { kind: 'unavailable', }, },);
 ```
 */
function withPlan(
  {
    receiver,
    plan,
  }: {
    readonly receiver: CarryReceiver;
    readonly plan: CarryReceiver['plan'];
  },
): CarryReceiver {
  return { ...receiver, plan, };
}

/**
 The context with the floors told of a declared name.

 @param context - the context

 @param declaredNames - names the front matter declares

 @returns The context

 @example
 ```ts
 const named = withDeclaredNames({ context, declaredNames: ['kitten',], },);
 ```
 */
function withDeclaredNames(
  {
    context,
    declaredNames,
  }: {
    readonly context: CarryContext;
    readonly declaredNames: readonly string[];
  },
): CarryContext {
  return { ...context, declaredNames, };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: englishOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'GIVES THE ENGLISH OF A SLICE THAT CARRIES ANY, and refuses a slice that carries none, since a rendering is '
            + 'located only in English',
          fn: async () => {
            const { receiver, } = carryScene({ behave: writersAnswer, },);
            const absent = {
              ...receiver.place,
              slice: { ...receiver.place.slice, current: { kind: 'absent', }, },
            } as const;
            expect(englishOf({ place: receiver.place, },),).toBe(RECEIVING_ENGLISH,);
            const refusal = caught(function readsAbsent(): unknown {
              return englishOf({ place: absent, },);
            },);
            expect(refusal,).toBeInstanceOf(ConsistencyInvariantError,);
            expect(String(refusal,),).toContain('slice 1 carries no English',);
          },
        },),
      ],
    },),
    describe({
      name: splicedParagraphOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'OFFERS THE PARAGRAPH WITH THE CHOSEN WORDS MOVED IN BY CODE when the plan replaces the words and every floor passes',
          fn: async () => {
            const { receiver, context, } = carryScene({ behave: writersAnswer, },);
            expect(splicedParagraphOf({ receiver, english: RECEIVING_ENGLISH, block: BLOCK, context, },),).toEqual({
              spliced: [SPLICED_PARAGRAPH,],
              findings: [],
            },);
          },
        },),
        it({
          name: 'OFFERS NOTHING WHEN THE WORDS CANNOT BE MOVED BY CODE, whether the receiving place already carries them or has no slot',
          fn: async () => {
            const { receiver, context, } = carryScene({ behave: writersAnswer, },);
            expect([
              splicedParagraphOf({
                receiver: withPlan({ receiver, plan: { kind: 'same', }, },),
                english: RECEIVING_ENGLISH,
                block: BLOCK,
                context,
              },),
              splicedParagraphOf({
                receiver: withPlan({ receiver, plan: { kind: 'unavailable', }, },),
                english: RECEIVING_ENGLISH,
                block: BLOCK,
                context,
              },),
            ],).toEqual([{ spliced: [], findings: [], }, { spliced: [], findings: [], },],);
          },
        },),
        it({
          name: 'WITHHOLDS THE SPLICE A FLOOR REFUSES, with a finding naming the place and a warning',
          fn: async () => {
            const scene = carryScene({ behave: writersAnswer, },);
            const { spliced, findings, } = splicedParagraphOf({
              receiver: scene.receiver,
              english: RECEIVING_ENGLISH,
              block: BLOCK,
              context: withDeclaredNames({ context: scene.context, declaredNames: ['kitten',], },),
            },);
            expect({
              spliced,
              finding: findings.map(function head(finding,): string {
                return finding.slice(0, 'consistency-candidate-refused (splice of OCCURRENCE 2): '.length,);
              },),
              warned: scene.lines.map(function head(line,): string {
                return line.slice(
                  0,
                  'warn [splicedParagraphOf] withheld the splice for OCCURRENCE 2 from the bench: '.length,
                );
              },),
            },).toEqual({
              spliced: [],
              finding: ['consistency-candidate-refused (splice of OCCURRENCE 2): ',],
              warned: ['warn [splicedParagraphOf] withheld the splice for OCCURRENCE 2 from the bench: ',],
            },);
          },
        },),
      ],
    },),
    describe({
      name: writtenOffers.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS THE WRITER BENCH FOR THE RECEIVING PARAGRAPH AND KEEPS EACH PARAGRAPH THE FLOORS PASS, in roster order',
          fn: async () => {
            const scene = carryScene({ behave: writersAnswer, },);
            const { written, findings, } = await writtenOffers({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              english: RECEIVING_ENGLISH,
              block: BLOCK,
              chosenParagraph: 'The cat naps. It is warm.',
            },);
            expect({
              seats: written.map(function seatOf({ seat, },): string {
                return seat;
              },).toSorted(),
              texts: written.map(function textOf({ text, },): boolean {
                return text.startsWith('Later the cat dozes in the sun (',);
              },),
              findings,
              askedWriters: scene.sheets.every(function isWriterSheet(sheet,): boolean {
                return sheetKindOf({ sheet, },) === 'writer';
              },),
              showsChosenParagraph: scene.sheets.every(function showsIt(sheet,): boolean {
                return sheet.includes('The cat naps. It is warm.',);
              },),
            },).toEqual({
              seats: [...scene.context.writerModelIds,].toSorted(),
              texts: [true, true, true,],
              findings: [],
              askedWriters: true,
              showsChosenParagraph: true,
            },);
          },
        },),
        it({
          name: 'WITHHOLDS A WRITER\'S PARAGRAPH THE FLOORS REFUSE, reporting it beside what the asking reported',
          fn: async () => {
            const scene = carryScene({
              behave: function oneAddsABlock({ seat, sheet, },): SeatBehaviour {
                return (seat === scene.context.writerModelIds[0])
                  ? { kind: 'answers', text: JSON.stringify({ translation: 'Later the cat dozes.\n\nAnd purrs.', },), }
                  : writersAnswer({ seat, sheet, },);
              },
            },);
            const { written, findings, } = await writtenOffers({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              english: RECEIVING_ENGLISH,
              block: BLOCK,
              chosenParagraph: 'The cat naps. It is warm.',
            },);
            expect({
              seats: written.map(function seatOf({ seat, },): string {
                return seat;
              },),
              refused: findings.filter(function isRefusal(finding,): boolean {
                return finding.startsWith(`consistency-candidate-refused (${scene.context.writerModelIds[0]}): `,);
              },).length,
            },).toEqual({
              seats: scene.context.writerModelIds.slice(1,).toSorted(),
              refused: 1,
            },);
          },
        },),
        it({
          name: 'ASKS NO WRITER WHEN THE BENCH SEATS NONE, reporting that the writers are unseated',
          fn: async () => {
            const scene = carryScene({ behave: writersAnswer, writerModelIds: [], },);
            expect(await writtenOffers({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              english: RECEIVING_ENGLISH,
              block: BLOCK,
              chosenParagraph: 'The cat naps. It is warm.',
            },),).toEqual({
              written: [],
              findings: ['consistency-writers-unseated (OCCURRENCE 2)',],
            },);
            expect(scene.asked,).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
