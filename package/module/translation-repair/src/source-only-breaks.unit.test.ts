/**
 * Protects explicit source line breaks where no archive rendering exists.
 * Cat fixtures reproduce Mio10's source-only poem without corpus wording.
 *
 * @module
 */

import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

import {
  isLineStructured,
  validateTranslatedSlice,
  wrapReplacementText,
} from '../dist/final/node/index.mjs';

/** Single-block verse missed by the blank-separated-block heuristic. */
const SOURCE = '> 猫醒了。  \n> 鸟唱了。';

/** Physical newlines without authored rendered breaks. */
const FLAT = '> The cat wakes.\n> The bird sings.';

await describe({
  name: 'source-only explicit line breaks',
  children: [
    it({
      name: 'REFUSES a source-only quote whose physical lines lost their rendered break',
      fn: async () => {
        expect(isLineStructured({ text: SOURCE, },),).toBe(false,);
        /** Real structural gate must catch what physical line counting misses. */
        const result = validateTranslatedSlice({ sourceText: SOURCE, candidateText: FLAT, },);
        expect(result.kind,).toBe('invalid',);
        if (result.kind === 'invalid')
          expect(result.findings.join('\n',),).toContain('explicit line break',);
      },
    },),
    ...[
      '> The cat wakes.  \n> The bird sings.',
      '> The cat wakes.\\\n> The bird sings.',
      '> The cat wakes.<br/>The bird sings.',
      '> The cat wakes.  \n> The bird sings.  \n> The cat listens.',
    ].map(function preservesBreaks(candidateText,) {
      return it({
        name: `ACCEPTS explicit breaks or expansion: ${JSON.stringify(candidateText,)}`,
        fn: async () => {
          expect(validateTranslatedSlice({ sourceText: SOURCE, candidateText, },).kind,).toBe('valid',);
        },
      },);
    },),
    it({
      name: 'REFUSES removing a source intrinsic br while accepting Markdown spelling',
      fn: async () => {
        /** Equivalent explicit source spelling under the MDX grammar. */
        const sourceText = '> 猫醒了。<br/>鸟唱了。';
        expect(validateTranslatedSlice({ sourceText, candidateText: FLAT, },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText,
          candidateText: '> The cat wakes.  \n> The bird sings.',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'LEAVES archive-backed and ordinary soft-wrapped prose unchanged',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          pageText: FLAT,
          candidateText: FLAT,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '> 猫醒了。\n> 鸟唱了。',
          candidateText: FLAT,
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'DOES NOT borrow an unrelated block break to flatten the source verse',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: `${SOURCE}\n\n猫吃饭。`,
          candidateText: `${FLAT}\n\nThe cat eats.  \nShe purrs.`,
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'DOES NOT treat a capitalized component as an intrinsic break',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: '> The cat wakes.<Br/>The bird sings.',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'KEEPS accepted hard breaks through the actual semantic wrapper',
      fn: async () => {
        /** Production wrapper must preserve the render-bearing spaces. */
        const candidateText = wrapReplacementText({ text: '> The cat wakes.  \n> The bird sings.', },);
        expect(candidateText,).toContain('  \n',);
        expect(validateTranslatedSlice({ sourceText: SOURCE, candidateText, },).kind,).toBe('valid',);
      },
    },),
  ],
},);
