/**
 * Protects explicit source line breaks where no archive rendering exists.
 * Cat fixtures reproduce Mio10's source-only poem without corpus wording.
 *
 * @module
 */

import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

import {
  isLineStructured,
  readSliceSkeleton,
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
    ...[
      '> The cat wakes.<Br/>The bird sings.',
      '> The cat wakes.<Cat.br/>The bird sings.',
      '> The cat wakes.`<br/>`The bird sings.',
      '> The cat wakes.\\<br/>The bird sings.',
      '',
    ].map(function cannotSupplyBreak(candidateText,) {
      return it({
        name: `REFUSES non-break substitutes: ${JSON.stringify(candidateText,)}`,
        fn: async () => {
          /** An independent atom or block refusal must not mask the break check. */
          const result = validateTranslatedSlice({ sourceText: SOURCE, candidateText, },);
          expect(result.kind,).toBe('invalid',);
          if (result.kind === 'invalid')
            expect(result.findings.join('\n',),).toContain('explicit line break',);
        },
      },);
    },),
    it({
      name: 'COUNTS flow br nodes, but not br text in fenced code',
      fn: async () => {
        /** Flow and text JSX use separate parser node kinds. */
        const flow = readSliceSkeleton({ text: '<br/>', },);
        /** Fenced contents must not be mistaken for rendered markup. */
        const code = readSliceSkeleton({ text: '```html\n<br/>\n```', },);
        expect(flow.kind,).toBe('read',);
        expect(code.kind,).toBe('read',);
        if ((flow.kind === 'read') && (code.kind === 'read')) {
          expect(flow.skeleton.explicitBreaks,).toEqual([1,],);
          expect(code.skeleton.explicitBreaks,).toEqual([0,],);
        }
      },
    },),
    it({
      name: 'TREATS nonempty whitespace as a present caller input, not inferred absence',
      fn: async () => {
        expect(validateTranslatedSlice({ sourceText: SOURCE, pageText: ' ', candidateText: FLAT, },).kind,)
          .toBe('valid',);
      },
    },),
    it({
      name: 'READS CRLF hard breaks without turning a soft wrap into a break',
      fn: async () => {
        /** Source line endings vary without changing the authored structure. */
        const sourceText = SOURCE.replaceAll('\n', '\r\n',);
        expect(validateTranslatedSlice({ sourceText, candidateText: FLAT, },).kind,).toBe('invalid',);
        expect(validateTranslatedSlice({
          sourceText,
          candidateText: '> The cat wakes.  \r\n> The bird sings.',
        },).kind,).toBe('valid',);
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
