import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { withoutSpans, } from '../../dist/final/node/index.mjs';

//region Coverage control cut
// What the absence control actually deletes.
//
// The control asks the coverage roster about a passage, deletes the spans it
// anchored on, and asks again. Everything the control concludes rests on the
// deletion being real: a cut that returned the document unchanged would let a
// wire that cannot see absence pass, and a cut that returned blank on
// everything would report a working wire as unmeasurable.
//
// Fixtures are invented cat prose, never corpus text.

await describe({
  name: withoutSpans.name,
  children: [
    it({
      name: 'REMOVES ONE ANCHORED SPAN and leaves the rest of the document standing, which is the '
        + 'ordinary case the control is built on',
      fn: async function removesOneSpan() {
        expect(
          withoutSpans({
            text: 'The tabby slept. The grey cat waited.',
            spans: ['The tabby slept. ',],
          },),
        ).toBe('The grey cat waited.',);
      },
    },),

    it({
      name: 'REMOVES EVERY OCCURRENCE of a span rather than the first, because a rendering that '
        + 'survives anywhere in the document is a rendering the roster can still anchor on',
      fn: async function removesEveryOccurrence() {
        expect(
          withoutSpans({
            text: 'a cat, a dog, a cat',
            spans: ['a cat',],
          },),
        ).toBe(', a dog, ',);
      },
    },),

    it({
      name: 'CUTS THE LONGEST SPAN FIRST so a span nested inside another is gone by its own turn '
        + 'rather than by accident, which keeps the result independent of roster answer order',
      fn: async function longestSpanGoesFirst() {
        // `waited` sits inside `The grey cat waited`, so a shortest-first cut
        // would leave `The grey cat ` behind and the two orders would disagree.
        expect(
          withoutSpans({
            text: 'The tabby slept. The grey cat waited.',
            spans: ['waited', 'The grey cat waited',],
          },),
        ).toBe('The tabby slept. .',);
      },
    },),

    it({
      name: 'REFUSES A DOCUMENT NO SPAN APPEARS IN by returning blank, since re-asking about text '
        + 'nothing was removed from would measure the provider rather than the wire',
      fn: async function absentSpanIsRefused() {
        expect(
          withoutSpans({
            text: 'The tabby slept.',
            spans: ['a sentence this document does not hold',],
          },),
        ).toBe('',);
      },
    },),

    it({
      name: 'REFUSES AN EMPTY SPAN LIST rather than reporting the document as damaged, which is '
        + 'the shape a roster that anchored nothing would hand it',
      fn: async function noSpansIsRefused() {
        expect(
          withoutSpans({
            text: 'The tabby slept.',
            spans: [],
          },),
        ).toBe('',);
      },
    },),

    it({
      name: 'REFUSES A BLANK SPAN instead of splitting the document on it, because a blank quote '
        + 'removes nothing and must not be counted as a rendering that was deleted',
      fn: async function blankSpanIsRefused() {
        expect(
          withoutSpans({
            text: 'The tabby slept.',
            spans: ['',],
          },),
        ).toBe('',);
      },
    },),
  ],
},);

//endregion Coverage control cut
