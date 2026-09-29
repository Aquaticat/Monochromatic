/**
 Tests that the editor width control REFUSES a draw it cannot damage.
 
 WHAT THE CONTROL IS FOR. It cuts one sentence out of a translation and asks
 the panel which reads better. A panel that cannot tell the cut version from
 the whole one is not measuring anything, so the probe stops before it spends.
 That question can only be asked of a passage holding MORE THAN ONE sentence:
 cut the only sentence a slice has and nothing is left to judge, which is a
 different question from whether the panel notices a deletion.
 
 WHAT WAS MEASURED. On 2026-08-25, inverting the filter that selects damageable
 slices, so the ones holding a single sentence are the ones kept, failed no
 test in this package. The probe would then have run its control over passages
 it could not damage, and reported whatever the panel said about an empty arm
 as though it were evidence the panel works.
 
 THE FIXTURE IS ASSERTED FIRST. `withoutASentence` decides what damageable
 means, so each fixture is put to it directly before the control sees it. A
 fixture that quietly stopped being a single sentence would otherwise turn
 this into a test that passes for the wrong reason.
 
 NO NETWORK. The refusal happens before any judge is seated, and the client
 there refuses every exchange by name so a control that got past the filter
 would say so rather than quietly buying rounds. The one case that seats a
 panel scripts its judges to back a passage by its text, wherever the seating
 puts it (ledger T8).
 
 Fixtures are cat-themed invention. No corpus content appears here.
 
 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  messageText,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  StatedRefusalError,
  type BenchSlice,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type SyntheticClient,
  widthControlHolds,
  withoutASentence,
} from '../../dist/final/node/index.mjs';

import { candidateNumber, } from '../archive-selection.test-fixture.ts';

/**
 Logger for the control under test.
 */
const l = tagged({ tag: 'editor-width-control-usable-test', },);

//region Fixtures

/**
 Slice whose translation is one sentence, so cutting it leaves nothing.
 
 The terminator sits at the very end, which is what makes it undamageable:
 there is no text after it to keep.
 */
const ONE_SENTENCE: BenchSlice = {
  entryId: 'mittens-window',
  index: 4,
  sourceText: '小猫在窗台上打盹。',
  incumbentText: 'The kitten dozes on the windowsill.',
  lineStructured: false,
};

/**
 Second undamageable slice, so the refusal is not resting on a draw of one.
 */
const ALSO_ONE_SENTENCE: BenchSlice = {
  entryId: 'whiskers-birds',
  index: 7,
  sourceText: '白胡子数着外面的鸟。',
  incumbentText: 'Whiskers counted the birds outside.',
  lineStructured: false,
};

/**
 Slice whose translation holds two sentences, which a cut can be taken from.
 */
const TWO_SENTENCES: BenchSlice = {
  entryId: 'tabby-radiator',
  index: 2,
  sourceText: '虎斑猫睡在暖气旁。它的尾巴垂在地板上。',
  incumbentText: 'The tabby sleeps by the radiator. Its tail hangs to the floor.',
  lineStructured: false,
};

/**
 Client refusing every exchange, since a control that reached one has already
 failed the question this file asks.
 */
const CLIENT: SyntheticClient = {
  chatText: async () => {
    throw new Error('the width control must refuse an undamageable draw before asking anyone',);
  },
  chatJson: async () => {
    throw new Error('the width control must refuse an undamageable draw before asking anyone',);
  },
  quotas: async () => {
    throw new Error('quotas unused by the width control',);
  },
};

/**
 A client whose one judge backs the candidate carrying a given text, wherever
 the seating puts it, and answers nothing else.

 @param wanted - passage the judge backs

 @returns The client
 */
function judgeBacking({ wanted, }: { readonly wanted: string; },): SyntheticClient {
  return {
    ...CLIENT,
    chatJson: async function chatJson<ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> {
      /**
       The ballot sheet the judge was sent.
       */
      const sheet = request.messages
        .map(function content(message,): string {
          return messageText({ message, },);
        },)
        .join('\n',);
      /**
       Ballot naming the backed passage.
       */
      const ballot: unknown = {
        best: candidateNumber({
          text: sheet,
          wanted,
        },),
        reason: 'fixture',
      };
      if (!request.validate(ballot,))
        throw new Error('scripted ballot failed the candidate guard',);
      return {
        kind: 'ok',
        value: ballot,
        rawText: JSON.stringify(ballot,),
      };
    },
  };
}

/**
 Runs a call that must refuse and hands back what it threw.
 
 @param act - call expected to reject
 
 @returns Whatever it rejected with, unchanged
 
 @throws Error when the call resolved instead of rejecting
 
 @example
 ```ts
 const refusal = await refusalOf(async function overOneSentence() { ... },);
 ```
 */
async function refusalOf(act: () => Promise<unknown>,): Promise<unknown> {
  try {
    await act();
  }
  catch (error) {
    return error;
  }
  throw new Error(
    `Expected ${(act.name === '') ? 'the call' : act.name} to refuse, but it returned`,
  );
}

//endregion Fixtures

await describe({
  name: widthControlHolds.name,
  children: [
    it({
      name: 'READS damageable as holding a sentence to spare, which is what the fixtures in this file rest '
        + 'on and what the filter is asking about',
      fn: async () => {
        expect(withoutASentence(ONE_SENTENCE.incumbentText,),).toBe('',);
        expect(withoutASentence(ALSO_ONE_SENTENCE.incumbentText,),).toBe('',);
        expect(withoutASentence(TWO_SENTENCES.incumbentText,),).toBe('Its tail hangs to the floor.',);
      },
    },),

    it({
      name: 'REFUSES a draw whose every slice holds one sentence, since a control run over passages '
        + 'it cannot damage would report the panel as working without having asked it anything',
      fn: async () => {
        /**
         What the control said about a draw with nothing to cut.
         */
        const refusal = await refusalOf(async function overUndamageableSlices() {
          await widthControlHolds({
            client: CLIENT,
            slices: [
              ONE_SENTENCE,
              ALSO_ONE_SENTENCE,
            ],
            judgeModelIds: [SEAT_HYPER_OPENROUTER_VISION_EDITOR,],
            signal: AbortSignal.timeout(120_000,),
            l,
          },);
        },);

        // A STATED REFUSAL, not a bare Error: the boundary prints a stated one
        // in a line and exits 6, and printed a bare one as a fault with frames.
        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain('no drawn slice holds more than one sentence',);
      },
    },),

    it({
      name: 'HOLDS FOR A PANEL THAT PREFERS THE INTACT PASSAGE in both seatings, and fails one that prefers the '
        + 'passage missing a sentence (ledger T8)',
      fn: async () => {
        /**
         What the control concludes for a judge backing one passage wherever it sits.

         @param backs - which passage the judge backs

         @returns Whether the control held
         */
        async function holdsFor(backs: 'intact' | 'damaged',): Promise<boolean> {
          return await widthControlHolds({
            client: judgeBacking({
              wanted: (backs === 'intact')
                ? TWO_SENTENCES.incumbentText
                : withoutASentence(TWO_SENTENCES.incumbentText,),
            },),
            slices: [
              ONE_SENTENCE,
              TWO_SENTENCES,
            ],
            // THREE JUDGES, since the selection stage keeps its fallback under a
            // winning weight of two and one ballot carries one.
            judgeModelIds: [
              SEAT_HYPER_OPENROUTER_VISION_EDITOR,
              SEAT_SYNTHETIC_TEXT_EVERYWHERE,
              SEAT_HYPER_VISION,
            ],
            signal: AbortSignal.timeout(120_000,),
            l,
          },);
        }
        expect(await holdsFor('intact',),).toBe(true,);
        expect(await holdsFor('damaged',),).toBe(false,);
      },
    },),
  ],
},);
