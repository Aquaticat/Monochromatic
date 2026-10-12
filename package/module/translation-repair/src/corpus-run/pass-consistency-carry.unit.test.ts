/**
 Tests for carrying the chosen rendering to one receiving place by writing,
 not by splicing: the writers are asked for the receiving paragraph, the bench
 chooses among the current paragraph, the code splice and each writer's
 paragraph, and the winner makes the replacement; a place whose words lie in no
 single block, or whose carry goes wrong, keeps its English with a record and a
 finding, and a caller's abort is not contained.

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
  type CarryReceiver,
  carryToPlace,
  type PlaceCarried,
} from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import {
  choosing,
  type SeatBehaviour,
} from './consistency-page.test-fixture.ts';
import {
  candidateTextsOf,
  sheetKindOf,
} from './consistency-sheet-reading.test-fixture.ts';
import {
  CARRY_REPEAT,
  carryScene,
  type CarryScene,
  RECEIVING_ENGLISH,
  SPLICED_PARAGRAPH,
} from './consistency-carry.test-fixture.ts';

/**
 What a writer wrote.
 */
const WRITTEN = 'Later the cat dozes in the sun.';

/**
 Writers that all write the same paragraph, and judges that all choose the candidate holding a text.

 @param choice - the text of the candidate every judge chooses

 @returns What each seat does

 @example
 ```ts
 const behave = writtenAndChosen({ choice: WRITTEN, },);
 ```
 */
function writtenAndChosen({ choice, }: { readonly choice: string; },) {
  return function behaves({ sheet, }: { readonly sheet: string; },): SeatBehaviour {
    if (sheetKindOf({ sheet, },) === 'writer')
      return { kind: 'answers', text: JSON.stringify({ translation: WRITTEN, },), };
    return choosing({
      choice: candidateTextsOf({ sheet, },)
        .find(function holdsIt(candidate,): boolean {
          return candidate.text === choice;
        },)
        ?.label ?? '',
    },);
  };
}

/**
 Carries the chosen words to the scene's receiving place.

 @param scene - the scene

 @param receiver - the receiving place, the scene's by default

 @returns How the carry ended

 @example
 ```ts
 const carried = await carried({ scene: carryScene({ behave, },), },);
 ```
 */
async function carriedIn(
  {
    scene,
    receiver = scene.receiver,
  }: {
    readonly scene: CarryScene;
    readonly receiver?: CarryReceiver;
  },
): Promise<PlaceCarried> {
  return await carryToPlace({
    context: scene.context,
    repeat: CARRY_REPEAT,
    chosen: scene.chosen,
    receiver,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: carryToPlace.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'CARRIES THE CHOSEN WORDS BY WRITING: the writers are asked first, then the judges choose among the current '
            + 'paragraph, the splice and the writers\' paragraph, and the writer\'s paragraph replaces the block',
          fn: async () => {
            const scene = carryScene({ behave: writtenAndChosen({ choice: WRITTEN, }), },);
            const { carry, edits, findings, } = await carriedIn({ scene, },);
            expect({
              kinds: carry.candidates.map(function kindOf({ kind, },): string {
                return kind;
              },).toSorted(),
              decision: carry.decision.kind,
              edits,
              findings,
              order: scene.sheets.map(function kindOf(sheet,): string {
                return sheetKindOf({ sheet, },);
              },).filter(function isFirstOfRun(kind, at, kinds,): boolean {
                return kind !== kinds[at - 1];
              },),
            },).toEqual({
              kinds: ['current', 'splice', 'writer',],
              decision: 'chosen',
              edits: [{ placePosition: 1, sliceIndex: 1, start: 0, end: RECEIVING_ENGLISH.length, text: WRITTEN, },],
              findings: [],
              order: ['writer', 'choice',],
            },);
          },
        },),
        it({
          name: 'REPLACES ONLY THE WORDS WHEN THE BENCH CHOOSES THE SPLICE, and nothing when it chooses the current paragraph',
          fn: async () => {
            const spliced = await carriedIn({
              scene: carryScene({ behave: writtenAndChosen({ choice: SPLICED_PARAGRAPH, }), },),
            },);
            const kept = await carriedIn({
              scene: carryScene({ behave: writtenAndChosen({ choice: RECEIVING_ENGLISH, }), },),
            },);
            expect({ spliced: spliced.edits, kept: kept.edits, },).toEqual({
              spliced: [{ placePosition: 1, sliceIndex: 1, start: 6, end: 21, text: 'the cat naps', },],
              kept: [],
            },);
          },
        },),
        it({
          name: 'PUTS NO QUESTION TO THE BENCH WHEN NO WRITER IS SEATED AND THE SPLICE IS NOT POSSIBLE, so the place keeps its '
            + 'English with no alternative recorded',
          fn: async () => {
            const scene = carryScene({ behave: writtenAndChosen({ choice: WRITTEN, }), writerModelIds: [], },);
            const { carry, edits, findings, } = await carriedIn({
              scene,
              receiver: { ...scene.receiver, plan: { kind: 'unavailable', }, },
            },);
            expect({ decision: carry.decision, edits, findings, asked: scene.asked, },).toEqual({
              decision: { kind: 'none', reason: 'no-alternative', },
              edits: [],
              findings: ['consistency-writers-unseated (OCCURRENCE 2)',],
              asked: [],
            },);
          },
        },),
        it({
          name: 'KEEPS THE ENGLISH WHEN THE WORDS LIE IN NO SINGLE BLOCK, recording the failure and asking nobody',
          fn: async () => {
            const scene = carryScene({ behave: writtenAndChosen({ choice: WRITTEN, }), },);
            const english = 'Later the kitten\n\nnaps in the sun.';
            const { carry, edits, } = await carriedIn({
              scene,
              receiver: {
                ...scene.receiver,
                place: {
                  ...scene.receiver.place,
                  slice: { ...scene.receiver.place.slice, current: { kind: 'present', text: english, }, },
                },
                rendering: { kind: 'located', quote: 'the kitten\n\nnaps', core: 'the kitten\n\nnaps', start: 6, },
              },
            },);
            expect({ carry, edits, asked: scene.asked, },).toEqual({
              carry: {
                label: 'OCCURRENCE 2',
                candidates: [],
                ballots: [],
                usable: 0,
                quorum: 0,
                decision: {
                  kind: 'failed',
                  detail: 'the words that render the repeated wording lie in no single block of the English, so no paragraph can be rewritten',
                },
              },
              edits: [],
              asked: [],
            },);
          },
        },),
        it({
          name: 'CONTAINS A CARRY THAT GOES WRONG: the place keeps its English with a failed decision, a finding and an error '
            + 'line, whatever the failure was',
          fn: async () => {
            const scene = carryScene({ behave: writtenAndChosen({ choice: WRITTEN, }), },);
            const { carry, edits, findings, } = await carriedIn({
              scene,
              receiver: {
                ...scene.receiver,
                place: {
                  ...scene.receiver.place,
                  slice: { ...scene.receiver.place.slice, current: { kind: 'absent', }, },
                },
              },
            },);
            expect({
              decision: carry.decision.kind,
              edits,
              findings,
              logged: scene.lines.filter(function isError(line,): boolean {
                return line.startsWith('error [carryToPlace] the carry to OCCURRENCE 2 could not be made',);
              },).length,
            },).toEqual({
              decision: 'failed',
              edits: [],
              findings: ['consistency-carry-failed (OCCURRENCE 2): the place keeps its English',],
              logged: 1,
            },);
          },
        },),
        it({
          name: 'DOES NOT CONTAIN THE CALLER\'S ABORT: when the signal has fired the failure is thrown again',
          fn: async () => {
            const scene = carryScene({ behave: writtenAndChosen({ choice: WRITTEN, }), },);
            const refusal = await rejectionOf(async function carriesAfterAbort(): Promise<unknown> {
              return await carryToPlace({
                context: { ...scene.context, signal: AbortSignal.abort(new Error('the cat woke the run',),), },
                repeat: CARRY_REPEAT,
                chosen: scene.chosen,
                receiver: {
                  ...scene.receiver,
                  place: {
                    ...scene.receiver.place,
                    slice: { ...scene.receiver.place.slice, current: { kind: 'absent', }, },
                  },
                },
              },);
            },);
            expect(refusal,).toBeInstanceOf(Error,);
          },
        },),
      ],
    },),
  ],
},);
