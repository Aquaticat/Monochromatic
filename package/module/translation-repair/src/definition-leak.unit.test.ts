/**
 Guards class forty-nine (shi_Yumiaoya3, 2026-09-17): a candidate that
 defines a footnote the original passage only refers to is refused before
 any judge reads it, since the definition lives in another slice and a
 second one makes the assembly withdraw both carriers. Cat-themed invention
 throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original passage that refers to a note defined elsewhere on the page.
 */
const REFERRING = '猫在窗台上打盹[^1]。';

/**
 Rendering that keeps the marker and leaves the definition where it lives.
 */
const CLEAN = 'The cat naps on the windowsill[^1].';

/**
 Rendering that wrote the definition into the passage as well.
 */
const LEAKED = `${CLEAN}\n\n[^1]: That is its favourite spot.`;

await describe({
  name: 'a footnote definition the original passage does not carry (class forty-nine)',
  children: [
    it({
      name: 'REFUSES a candidate defining a note the ORIGINAL only refers to',
      fn: async () => {
        const result = validateTranslatedSlice({
          sourceText: REFERRING,
          candidateText: LEAKED,
        },);
        expect(result.kind,).toBe('invalid',);
        if (result.kind === 'invalid')
          expect(result.findings.join('\n',),).toContain('[^1]',);
      },
    },),
    it({
      name: 'REFUSES it under the full-width convention too, since the identifiers are one note',
      fn: async () => {
        const result = validateTranslatedSlice({
          sourceText: '猫在窗台上打盹〔1〕。',
          candidateText: LEAKED,
        },);
        expect(result.kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS the marker alone, and ACCEPTS a definition where the ORIGINAL passage defines it',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: REFERRING,
          candidateText: CLEAN,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '[^1]: 那是它最喜欢的位置。',
          candidateText: '[^1]: That is its favourite spot.',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
