/**
 Guards class one hundred fifteen (yingying10, 2026-09-24): a translate
 candidate turned the original's linked title into plain words followed by
 the bare destination in parentheses, and every floor passed it, since the
 destination floor reads the bare URL as an autolink and the declared link
 name floor (class one hundred fourteen) is silent where the rendering
 carries no link under the href. It reached the slate and drew a ballot. A
 rendering that keeps a source link's destination but no longer carries it
 as a worded link is refused before any judge reads it.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  floorTranslateVoices,
  type RosterModelId,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original definition linking a post by its title.
 */
const SOURCE = '[^2]: [窗台上的午睡](https://example.invalid/windowsill-nap.html)';

/**
 Rendering keeping the title as the link's words.
 */
const LINKED = '[^2]: [A Nap on the Windowsill](https://example.invalid/windowsill-nap.html)';

/**
 Rendering with the title as plain words and the destination bare after it.
 */
const UNWRAPPED = '[^2]: A Nap on the Windowsill (https://example.invalid/windowsill-nap.html)';

/**
 Rendering whose link words became the destination itself.
 */
const URL_WORDED = '[^2]: A Nap on the Windowsill [https://example.invalid/windowsill-nap.html](https://example.invalid/windowsill-nap.html)';

await describe({
  name: 'a source link rendered as words and a bare destination (class one hundred fifteen)',
  children: [
    it({
      name: 'REFUSES a rendering that unwraps the link, and names the destination',
      fn: async () => {
        /**
         Verdict on the unwrapped rendering.
         */
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: UNWRAPPED,
          pageText: LINKED,
        },);
        expect(verdict.kind,).toBe('invalid',);
        if (verdict.kind !== 'invalid')
          throw new Error('unreachable',);
        expect(verdict.findings.join('\n',),).toContain('https://example.invalid/windowsill-nap.html',);
      },
    },),
    it({
      name: 'REFUSES a rendering whose link words became the destination',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: URL_WORDED,
          pageText: LINKED,
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'ACCEPTS the worded link, and stays silent where the source link is worded by its own destination',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: SOURCE,
          candidateText: LINKED,
          pageText: LINKED,
        },).kind,).toBe('valid',);
        expect(validateTranslatedSlice({
          sourceText: '猫的博客：[https://example.invalid/](https://example.invalid/)',
          candidateText: 'The cat\'s blog: https://example.invalid/',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'WITHHOLDS the unwrapped candidate from the translate slate',
      fn: async () => {
        /**
         Slate after the floor.
         */
        const floored = floorTranslateVoices({
          voices: [
            {
              modelId: 'hf:cat/Cat-A' as unknown as RosterModelId,
              value: { translation: UNWRAPPED, },
            },
            {
              modelId: 'hf:cat/Cat-B' as unknown as RosterModelId,
              value: { translation: LINKED, },
            },
          ],
          sourceText: SOURCE,
          incumbentText: LINKED,
          lineStructured: false,
        },);
        expect(floored.voices.map(function text(voice,): string {
          return voice.value.translation;
        },),).toEqual([LINKED,],);
      },
    },),
  ],
},);
