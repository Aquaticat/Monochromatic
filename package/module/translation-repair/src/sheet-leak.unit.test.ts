/**
 Guards class forty-four (Mio27, 2026-09-17): a candidate that carries one of
 the sheet's own evidence blocks, copied from the writer's sheet, is refused
 before any judge reads it. Cat-themed invention throughout; no corpus content
 appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original with a picture component and a rule below it.
 */
const SOURCE = `<PhotoScroll photos={[\n'\${path}/photos/cat1.webp'\n]} />\n\n---`;

/**
 Rendering that copied the sheet's transcript block after the component.
 */
const LEAKED = `${SOURCE}\n\n===== WHAT THE PICTURES HERE SAY =====\nPICTURE cat1.webp\nreader-one:\n[left] 猫在睡觉`;

await describe({
  name: 'sheet evidence copied into a candidate (class forty-four)',
  children: [
    ...[
      'WHAT THE PICTURES HERE SAY',
      'ATTESTED DETAILS',
      'CITED REFERENCES',
      'EXISTING TRANSLATION',
    ].map(function refusesLabel(label,) {
      return it({
        name: `REFUSES a candidate carrying the sheet's ${label} block`,
        fn: async () => {
          const result = validateTranslatedSlice({
            sourceText: '猫在睡觉。',
            candidateText: `The cat is sleeping.\n\n===== ${label} =====\nsomething copied`,
          },);
          expect(result.kind,).toBe('invalid',);
          if (result.kind === 'invalid')
            expect(result.findings.join('\n',),).toContain(label,);
        },
      },);
    },),
    it({
      name: 'REFUSES the transcript block copied under a picture component, the Mio27 shape',
      fn: async () => {
        const result = validateTranslatedSlice({
          sourceText: SOURCE,
          pageText: SOURCE,
          candidateText: LEAKED,
        },);
        expect(result.kind,).toBe('invalid',);
        if (result.kind === 'invalid')
          expect(result.findings.join('\n',),).toContain('WHAT THE PICTURES HERE SAY',);
      },
    },),
    it({
      name: 'ACCEPTS a rendering that leaves the sheet blocks out',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: '猫在睡觉。',
          candidateText: 'The cat is sleeping.',
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          pageText: SOURCE,
          candidateText: SOURCE,
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
