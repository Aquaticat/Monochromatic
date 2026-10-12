/**
 Tests for the bench's choice among a receiving place's candidates and what it
 comes to: the record of a carry that ended without a choice, and, for a choice,
 the carry's record and the replacement the winner makes (the words for the
 splice, the block for a writer's paragraph, nothing for the current paragraph).
 A place with no alternative to its own English is not put to the bench.

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
  type CarryBlock,
  carryOffersOf,
  carryWithoutChoice,
  choose,
} from '../../dist/final/node/index.mjs';
import {
  choosing,
  type SeatBehaviour,
  type SeatScript,
} from './consistency-page.test-fixture.ts';
import { candidateTextsOf, } from './consistency-sheet-reading.test-fixture.ts';
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
 What a writer wrote.
 */
const WRITTEN = 'Later the cat dozes in the sun.';

/**
 The three candidates: the current paragraph, the splice and one writer's paragraph.
 */
const OFFERS = carryOffersOf({
  current: RECEIVING_ENGLISH,
  splice: [SPLICED_PARAGRAPH,],
  written: [{ seat: 'hyper-cat', text: WRITTEN, },],
  lineStructured: false,
},);

/**
 Judges that all choose the candidate holding a text.

 @param text - the candidate's text

 @returns What each seat does

 @example
 ```ts
 const behave: SeatScript = allChoose({ text: WRITTEN, },);
 ```
 */
function allChoose({ text, }: { readonly text: string; },): SeatScript {
  return function choosesIt({ sheet, },): SeatBehaviour {
    return choosing({
      choice: candidateTextsOf({ sheet, },)
        .find(function holdsIt(candidate,): boolean {
          return candidate.text === text;
        },)
        ?.label ?? '',
    },);
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: carryWithoutChoice.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RECORDS A CARRY WITH NO BALLOTS, NO USABLE COUNT AND NO QUORUM, the decision and the candidates as given',
          fn: async () => {
            expect(carryWithoutChoice({
              label: 'OCCURRENCE 2',
              decision: { kind: 'failed', detail: 'Error', },
              candidates: [{ label: 'CANDIDATE 1', kind: 'current', writers: [], text: RECEIVING_ENGLISH, },],
            },),).toEqual({
              label: 'OCCURRENCE 2',
              candidates: [{ label: 'CANDIDATE 1', kind: 'current', writers: [], text: RECEIVING_ENGLISH, },],
              ballots: [],
              usable: 0,
              quorum: 0,
              decision: { kind: 'failed', detail: 'Error', },
            },);
          },
        },),
      ],
    },),
    describe({
      name: choose.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PUTS NO QUESTION TO THE BENCH WHEN ONLY THE CURRENT PARAGRAPH IS ON OFFER, recording no alternative and '
            + 'making no replacement',
          fn: async () => {
            const scene = carryScene({ behave: allChoose({ text: WRITTEN, }), },);
            const carried = await choose({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              block: BLOCK,
              offers: carryOffersOf({ current: RECEIVING_ENGLISH, splice: [], written: [], lineStructured: false, },),
              findings: ['consistency-writers-unseated (OCCURRENCE 2)',],
            },);
            expect({ carried, asked: scene.asked, },).toEqual({
              carried: {
                carry: {
                  label: 'OCCURRENCE 2',
                  candidates: [{ label: 'CANDIDATE 1', kind: 'current', writers: [], text: RECEIVING_ENGLISH, },],
                  ballots: [],
                  usable: 0,
                  quorum: 0,
                  decision: { kind: 'none', reason: 'no-alternative', },
                },
                edits: [],
                findings: ['consistency-writers-unseated (OCCURRENCE 2)',],
              },
              asked: [],
            },);
          },
        },),
        it({
          name: 'REPLACES THE WORDS WHEN THE BENCH CHOOSES THE SPLICE, the block when it chooses a writer\'s paragraph, and '
            + 'nothing when it chooses the current paragraph',
          fn: async () => {
            const results = await Promise.all([RECEIVING_ENGLISH, SPLICED_PARAGRAPH, WRITTEN,].map(
              async function chooses(text,) {
                const scene = carryScene({ behave: allChoose({ text, }), },);
                const { carry, edits, } = await choose({
                  context: scene.context,
                  repeat: CARRY_REPEAT,
                  chosen: scene.chosen,
                  receiver: scene.receiver,
                  block: BLOCK,
                  offers: OFFERS,
                  findings: [],
                },);
                return {
                  decided: OFFERS.find(function isNamed({ label, },): boolean {
                    return (carry.decision.kind === 'chosen') && (carry.decision.label === label);
                  },)?.kind,
                  edits,
                };
              },
            ),);
            expect(results,).toEqual([
              { decided: 'current', edits: [], },
              {
                decided: 'splice',
                edits: [{ placePosition: 1, sliceIndex: 1, start: 6, end: 21, text: 'the cat naps', },],
              },
              {
                decided: 'writer',
                edits: [{ placePosition: 1, sliceIndex: 1, start: 0, end: RECEIVING_ENGLISH.length, text: WRITTEN, },],
              },
            ],);
          },
        },),
        it({
          name: 'RECORDS EVERY CANDIDATE, EVERY BALLOT AND THE COUNT, with the quorum the gather closed on and the findings '
            + 'the candidates\' making and the asking reported',
          fn: async () => {
            const scene = carryScene({ behave: allChoose({ text: WRITTEN, }), },);
            const { carry, findings, } = await choose({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              block: BLOCK,
              offers: OFFERS,
              findings: ['consistency-candidate-refused (hyper-cat): none',],
            },);
            expect({
              labels: carry.candidates.map(function labelOf({ label, },): string {
                return label;
              },),
              kinds: carry.candidates.map(function kindOf({ kind, },): string {
                return kind;
              },).toSorted(),
              ballots: carry.ballots.length,
              usable: carry.usable,
              quorum: carry.quorum,
              findings,
            },).toEqual({
              labels: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3',],
              kinds: ['current', 'splice', 'writer',],
              ballots: 3,
              usable: 3,
              quorum: 2,
              findings: ['consistency-candidate-refused (hyper-cat): none',],
            },);
          },
        },),
        it({
          name: 'MAKES NO REPLACEMENT WHEN THE CHOICES HAVE NO STRICT MAJORITY, recording that decision',
          fn: async () => {
            const scene = carryScene({
              behave: function splitsThreeWays({ seat, sheet, },): SeatBehaviour {
                const candidates = candidateTextsOf({ sheet, },);
                const at = scene.context.judgeModelIds.indexOf(seat,);
                return choosing({ choice: candidates[at % candidates.length]?.label ?? '', },);
              },
            },);
            const { carry, edits, } = await choose({
              context: scene.context,
              repeat: CARRY_REPEAT,
              chosen: scene.chosen,
              receiver: scene.receiver,
              block: BLOCK,
              offers: OFFERS,
              findings: [],
            },);
            expect({ decision: carry.decision, edits, },).toEqual({
              decision: { kind: 'none', reason: 'no-majority', },
              edits: [],
            },);
          },
        },),
      ],
    },),
  ],
},);
