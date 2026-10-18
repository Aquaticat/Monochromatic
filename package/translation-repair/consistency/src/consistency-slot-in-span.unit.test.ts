/**
 Tests for the slot a frame's ballots agree on inside the span a place was located by: given as the span holds it with its
 offset when a strict majority gave it beside the agreed words and it stands once inside the span, and none when no majority
 gave one, when it shows a reader nothing, when it stands nowhere or twice in the span, when it is all of the span, or when it
 cuts markup. Each refusal stands beside a twin that differs from it in that one respect and gives its slot.

 Fixtures are cat-themed invention.

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
  foldedWordsOf,
  quotesByLabelOf,
  slotInSpan,
} from '../dist/final/node/index.mjs';

/**
 The span of the first place, as its English holds it, with a curly apostrophe.
 */
const SPAN = 'So she was a girl, wasn’t she';

/**
 Ballots that quote the span for the first place, each beside the slot given in its turn, as a list of zero or one.

 @param span - the quoted words

 @param slots - each ballot's slot as a list of zero or one, in seat order

 @returns The ballots

 @example
 ```ts
 const voices = ballotsGiving({ span: SPAN, slots: [['a girl',], ['a girl',],], },);
 ```
 */
function ballotsGiving(
  {
    span,
    slots,
  }: {
    readonly span: string;
    readonly slots: readonly (readonly string[])[];
  },
): readonly ConsistencyVoice[] {
  return slots.map(function ballotOf(slot, index,): ConsistencyVoice {
    /**
     The slot this ballot gave, absent when it gave none.
     */
    const [given,] = slot;
    return {
      seat: `seat ${String(index,)}`,
      reason: 'It words the first place best.',
      quotes: [{ label: 'OCCURRENCE 1', quote: span, ...((given === undefined) ? {} : { slot: given, }), },],
      choice: 'OCCURRENCE 1',
      keep: [],
    };
  },);
}

/**
 The slot of the first place in a span whose ballots gave these slots, the words agreed being the span's own in the fold.

 @param span - the span as its English holds it

 @param slots - each ballot's slot as a list of zero or one, in seat order

 @returns What `slotInSpan` gives

 @example
 ```ts
 const found = slotOf({ span: SPAN, slots: [['a girl',], ['a girl',],], },);
 ```
 */
function slotOf(
  {
    span,
    slots,
  }: {
    readonly span: string;
    readonly slots: readonly (readonly string[])[];
  },
): readonly unknown[] {
  return slotInSpan({
    voices: ballotsGiving({ span, slots, },),
    label: 'OCCURRENCE 1',
    words: foldedWordsOf({ text: span, },),
    span,
  },);
}

await describe({
  name: slotInSpan.name,
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    it({
      name: 'GIVES THE SLOT A STRICT MAJORITY GAVE BESIDE THE AGREED WORDS, as the span holds it and with its offset, a ballot '
        + 'that gave none counting against it, and reads the quotes the same when the caller hands them in',
      fn: async () => {
        /**
         Three ballots, two of which gave the slot.
         */
        const voices = ballotsGiving({ span: SPAN, slots: [['a girl',], ['a girl',], [],], },);
        expect({
          read: slotInSpan({ voices, label: 'OCCURRENCE 1', words: foldedWordsOf({ text: SPAN, },), span: SPAN, },),
          handed: slotInSpan({
            voices,
            label: 'OCCURRENCE 1',
            words: foldedWordsOf({ text: SPAN, },),
            span: SPAN,
            quotesByLabel: quotesByLabelOf({ voices, },),
          },),
        },).toEqual({
          read: [{ slot: 'a girl', slotStart: 11, },],
          handed: [{ slot: 'a girl', slotStart: 11, },],
        },);
      },
    },),
    it({
      name: 'GIVES NO SLOT WHEN NO STRICT MAJORITY OF THE BALLOTS GAVE ONE',
      fn: async () => {
        expect(slotOf({ span: SPAN, slots: [['a girl',], ['a boy',], [],], },),).toEqual([],);
      },
    },),
    it({
      name: 'GIVES NO SLOT THAT SHOWS A READER NOTHING, as a zero-width space folds to no words',
      fn: async () => {
        expect(slotOf({ span: 'So she was\u{200B} a girl', slots: [['\u{200B}',], ['\u{200B}',],], },),).toEqual([],);
      },
    },),
    it({
      name: 'GIVES NO SLOT THAT STANDS NOWHERE OR MORE THAN ONCE IN THE SPAN, beside a slot standing once in the same span',
      fn: async () => {
        expect({
          nowhere: slotOf({ span: SPAN, slots: [['a dog',], ['a dog',],], },),
          twice: slotOf({ span: 'the cat and the cat naps', slots: [['the cat',], ['the cat',],], },),
          once: slotOf({ span: 'the cat and the cat naps', slots: [['naps',], ['naps',],], },),
        },).toEqual({
          nowhere: [],
          twice: [],
          once: [{ slot: 'naps', slotStart: 20, },],
        },);
      },
    },),
    it({
      name: 'GIVES NO SLOT THAT IS ALL OF THE SPAN, beside the same slot in a longer span',
      fn: async () => {
        expect({
          whole: slotOf({ span: 'a girl', slots: [['a girl',], ['a girl',],], },),
          part: slotOf({ span: 'a girl naps', slots: [['a girl',], ['a girl',],], },),
        },).toEqual({
          whole: [],
          part: [{ slot: 'a girl', slotStart: 0, },],
        },);
      },
    },),
    it({
      name: 'GIVES NO SLOT THAT CUTS MARKUP, beside a slot of the same span that cuts none',
      fn: async () => {
        expect({
          cutting: slotOf({ span: 'a *black cat* naps', slots: [['cat* naps',], ['cat* naps',],], },),
          clear: slotOf({ span: 'a *black cat* naps', slots: [['naps',], ['naps',],], },),
        },).toEqual({
          cutting: [],
          clear: [{ slot: 'naps', slotStart: 14, },],
        },);
      },
    },),
  ],
},);
