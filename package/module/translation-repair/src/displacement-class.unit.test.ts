/**
 * Tests for the size screen that says WHAT a translation's size anomalies are:
 * a passage moved across a section boundary, a section nobody translated,
 * content that exists only in the translation, or nothing at all.
 *
 * WHAT THESE ARE FOR. The screen's first version reported one bucket, and its
 * count went into `#107` and Question 5 before anyone checked what was in it.
 * These fixtures are the labelled cases that check came back with: the two
 * relocations verified by reading both documents, the three anomalous entries
 * that turned out to be other phenomena, and an ordinary document that must stay
 * silent. Each carries the shape of a real reading with invented counts.
 *
 * Fixtures are invented counts, not corpus text.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  classifyDisplacement,
  CORPUS_REFERENCE_EXPANSION,
  documentBaseline,
  type SliceSize,
  sliceRatios,
} from '../dist/final/node/index.mjs';

/**
 * Builds a slice of a given original length at a given expansion.
 *
 * @param sourceChars - original characters
 *
 * @param ratio - translated characters per original character
 *
 * @returns Slice sizes carrying that expansion
 *
 * @example
 * ```ts
 * const slice = at({ sourceChars: 300, ratio: 3, },);
 * ```
 */
function at(
  {
    sourceChars,
    ratio,
  }: {
    readonly sourceChars: number;
    readonly ratio: number;
  },
): SliceSize {
  return {
    sourceChars,
    targetChars: Math.round(sourceChars * ratio,),
  };
}

await describe({
  name: sliceRatios.name,
  children: [
    it({
      name: 'KEEPS a slice with no original at all and reads its ratio as the translated length, '
        + 'since an insertion anchor is a real state rather than an input to sanitize, and '
        + 'dividing by a floored one would have called it ordinary',
      fn: async () => {
        const readings = sliceRatios({
          slices: [
            {
              sourceChars: 0,
              targetChars: 900,
            },
            at({
              sourceChars: 300,
              ratio: 3,
            },),
          ],
        },);
        expect(readings.length,).toBe(2,);
        expect(readings[0]
          ?.ratio,).toBe(900,);
      },
    },),
    it({
      name: 'DROPS NOTHING, in slice order, so a caller can index a reading by its slice: the '
        + 'previous version filtered short originals here and lost the strongest evidence in '
        + 'the corpus before anything looked at it',
      fn: async () => {
        const readings = sliceRatios({
          slices: [
            {
              sourceChars: 4,
              targetChars: 6,
            },
            {
              sourceChars: 41,
              targetChars: 3_652,
            },
            at({
              sourceChars: 300,
              ratio: 3,
            },),
          ],
        },);
        expect(readings.length,).toBe(3,);
        expect(readings.map(function toIndex(reading,) {
          return reading.sliceIndex;
        },),).toEqual([
          0,
          1,
          2,
        ],);
      },
    },),
  ],
},);

await describe({
  name: documentBaseline.name,
  children: [
    it({
      name: 'reads a document own expansion by LENGTH rather than by slice, so a long section '
        + 'counts for more than a short one',
      fn: async () => {
        const baseline = documentBaseline({
          slices: [
            at({
              sourceChars: 1_200,
              ratio: 3,
            },),
            at({
              sourceChars: 50,
              ratio: 9,
            },),
          ],
        },);
        expect(baseline.from,).toBe('document',);
        expect(baseline.expansion,).toBeLessThan(3.5,);
      },
    },),
    it({
      name: 'REFUSES a document whose expansion is outside any plausible band and falls back to '
        + 'the corpus, which is what stops an untranslated document setting its own bar',
      fn: async () => {
        for (const ratio of [
          0.3,
          16,
        ]) {
          const baseline = documentBaseline({
            slices: [at({
              sourceChars: 900,
              ratio,
            },),],
          },);
          expect(baseline.from,).toBe('corpus-reference',);
          expect(baseline.expansion,).toBe(CORPUS_REFERENCE_EXPANSION,);
        }
      },
    },),
    it({
      name: 'falls back rather than dividing by nothing when handed no slices at all',
      fn: async () => {
        expect(documentBaseline({ slices: [], },).from,).toBe('corpus-reference',);
      },
    },),
  ],
},);

await describe({
  name: `${classifyDisplacement.name} nulls`,
  children: [
    it({
      name: 'flags NOTHING on a document that expands evenly, which is the null this screen has '
        + 'to produce on an ordinary entry',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            3,
            3.2,
            2.9,
            3.4,
            3.1,
          ].map(function toSlice(ratio,) {
            return at({
              sourceChars: 300,
              ratio,
            },);
          },),
        },);
        expect(reading.relocationCandidates,).toEqual([],);
        expect(reading.untranslated,).toEqual([],);
        expect(reading.targetOnly,).toEqual([],);
        expect(reading.otherImbalances,).toEqual([],);
      },
    },),
    it({
      name: 'flags NOTHING on ratios 2.0, 4.1 and 1.9, an ordinary document the OLD screen '
        + 'reported as a moved pair: 4.1 is above twice that document median of 2.0 while being '
        + 'a perfectly normal expansion',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            2,
            4.1,
            1.9,
          ].map(function toSlice(ratio,) {
            return at({
              sourceChars: 300,
              ratio,
            },);
          },),
        },);
        expect(reading.relocationCandidates,).toEqual([],);
      },
    },),
    it({
      name: 'does not call a document of untranslated sections a document of relocations: every '
        + 'zero-ratio slice was HIGH under the old screen, because a median of zero makes twice '
        + 'the median zero',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            {
              sourceChars: 500,
              targetChars: 0,
            },
            {
              sourceChars: 500,
              targetChars: 0,
            },
            at({
              sourceChars: 500,
              ratio: 3,
            },),
          ],
        },);
        expect(reading.untranslated,).toEqual([
          0,
          1,
        ],);
        expect(reading.relocationCandidates,).toEqual([],);
      },
    },),
    it({
      name: 'produces NOTHING from the twenty-three character slice in `noname3031`, whose '
        + 'residual is a handful of characters: too small to be a passage in either direction, '
        + 'which is what a length floor was reaching for and got wrong',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            at({
              sourceChars: 300,
              ratio: 1.2,
            },),
            {
              sourceChars: 23,
              targetChars: 62,
            },
            at({
              sourceChars: 300,
              ratio: 1,
            },),
          ],
        },);
        expect(Math.abs(reading.slices[1]
          ?.residual ?? 0,),).toBeLessThan(60,);
        expect(reading.relocationCandidates,).toEqual([],);
        expect(reading.otherImbalances,).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: `${classifyDisplacement.name} classes`,
  children: [
    it({
      name: 'POSITIVE CONTROL, the `Dethelly` counts: 403 translated characters against 35 '
        + 'original beside 268 against 129 is the relocation this whole instrument was built '
        + 'from, and it must survive every guard added since',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            {
              sourceChars: 35,
              targetChars: 403,
            },
            {
              sourceChars: 129,
              targetChars: 268,
            },
            at({
              sourceChars: 600,
              ratio: 3.2,
            },),
            at({
              sourceChars: 600,
              ratio: 3.3,
            },),
          ],
        },);
        expect(reading.relocationCandidates
          .length,).toBe(1,);
        expect(reading.relocationCandidates[0]
          ?.high,).toBe(0,);
        expect(reading.relocationCandidates[0]
          ?.low,).toBe(1,);
        expect(reading.targetOnly,).toEqual([],);
      },
    },),
    it({
      name: 'the `lintong` counts: a donor of 43 original characters against 25 translated must '
        + 'still be a donor. A rule dismissing SHORT slices dismissed this verified relocation, '
        + 'so what makes a slice evidence is its residual and not its length',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            at({
              sourceChars: 400,
              ratio: 3.2,
            },),
            at({
              sourceChars: 400,
              ratio: 3.3,
            },),
            {
              sourceChars: 43,
              targetChars: 25,
            },
            {
              sourceChars: 55,
              targetChars: 439,
            },
            at({
              sourceChars: 400,
              ratio: 3.2,
            },),
          ],
        },);
        expect(reading.relocationCandidates
          .length,).toBe(1,);
        expect(reading.relocationCandidates[0]
          ?.high,).toBe(3,);
        expect(reading.relocationCandidates[0]
          ?.low,).toBe(2,);
      },
    },),
    it({
      name: 'REFUSES a neighbour whose deficit is far too small to account for the surplus, even '
        + 'though the deficit is real: without this a large surplus pairs with whichever '
        + 'neighbour phrased one sentence tersely, and every high slice finds a donor',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            {
              sourceChars: 200,
              targetChars: 1_600,
            },
            {
              sourceChars: 1_000,
              targetChars: 3_350,
            },
            at({
              sourceChars: 1_000,
              ratio: 3.05,
            },),
            at({
              sourceChars: 1_000,
              ratio: 3.1,
            },),
          ],
        },);
        expect(reading.relocationCandidates,).toEqual([],);
        expect(reading.otherImbalances,).toEqual([0,],);
      },
    },),
    it({
      name: 'the `shi_Yumiaoya` shape: three untranslated sections must be reported as '
        + 'untranslated AND must not drag the baseline down onto the two ordinary translations '
        + 'beside them, which is exactly what the old median did',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            {
              sourceChars: 165,
              targetChars: 300,
            },
            {
              sourceChars: 162,
              targetChars: 436,
            },
            {
              sourceChars: 715,
              targetChars: 14,
            },
            {
              sourceChars: 1_016,
              targetChars: 13,
            },
            {
              sourceChars: 1_313,
              targetChars: 12,
            },
          ],
        },);
        expect(reading.untranslated,).toEqual([
          2,
          3,
          4,
        ],);
        expect(reading.relocationCandidates,).toEqual([],);
        expect(reading.baseline,).toBeGreaterThan(1.6,);
      },
    },),
    it({
      name: 'the `Zha_Ke` shape: 41 original characters against 3652 translated is content the '
        + 'original does not carry, and the OLD screen dropped it entirely because it filtered '
        + 'on original length before classifying anything',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            at({
              sourceChars: 430,
              ratio: 3,
            },),
            {
              sourceChars: 41,
              targetChars: 3_652,
            },
            at({
              sourceChars: 560,
              ratio: 2.9,
            },),
          ],
        },);
        expect(reading.targetOnly,).toEqual([1,],);
        expect(reading.relocationCandidates,).toEqual([],);
      },
    },),
    it({
      name: 'reports a surplus NO neighbour accounts for as an other imbalance rather than as a '
        + 'relocation, since a passage that went somewhere has two ends',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            at({
              sourceChars: 400,
              ratio: 3.1,
            },),
            {
              sourceChars: 400,
              targetChars: 3_400,
            },
            at({
              sourceChars: 400,
              ratio: 3.2,
            },),
          ],
        },);
        expect(reading.relocationCandidates,).toEqual([],);
        expect(reading.otherImbalances,).toEqual([1,],);
      },
    },),
    it({
      name: 'does not pair a high slice with an UNTRANSLATED neighbour, which would report every '
        + 'section nobody rendered as a passage that moved into the one beside it',
      fn: async () => {
        const reading = classifyDisplacement({
          slices: [
            {
              sourceChars: 350,
              targetChars: 2_400,
            },
            {
              sourceChars: 900,
              targetChars: 20,
            },
            at({
              sourceChars: 900,
              ratio: 3,
            },),
          ],
        },);
        expect(reading.untranslated,).toEqual([1,],);
        expect(reading.relocationCandidates,).toEqual([],);
      },
    },),
  ],
},);
