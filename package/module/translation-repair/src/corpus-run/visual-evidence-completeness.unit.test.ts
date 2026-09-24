/**
 Tests visual evidence cannot bypass publication review.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertVisualEvidenceComplete,
  SEAT_HYPER_OPENROUTER_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  type ChunkPair,
  VisualEvidenceInterruptedError,
} from '../../dist/final/node/index.mjs';

/**
 Prepared slice fixture naming one entry photo.
 */
const SLICES = [{
  source: {
    text: `<PhotoScroll photos={[ '\${path}/photos/tabby.webp' ]} />`,
  },
}] as unknown as readonly ChunkPair[];

await describe({
  name: assertVisualEvidenceComplete.name,
  children: [
    it({
      name: 'ACCEPTS CORROBORATED OR REVIEWED NO-TEXT outcome',
      fn: async () => {
        expect(() => assertVisualEvidenceComplete({
          slices: SLICES,
          readings: new Map([[
            'tabby.webp',
            { kind: 'no-text', characters: 0, },
          ],]),
        },),).not.toThrow();
        expect(() => assertVisualEvidenceComplete({
          slices: SLICES,
          readings: new Map([[
            'tabby.webp',
            {
              kind: 'corroborated',
              readings: [
                { modelId: SEAT_SYNTHETIC_VISION_WITHHELD, text: 'Mittens 555-0134', },
                { modelId: SEAT_HYPER_OPENROUTER_VISION_EDITOR, text: 'Mittens 555-0134', },
              ],
              overlap: 1,
            },
          ],]),
        },),).not.toThrow();
      },
    },),

    it({
      name: 'PAUSES MISSING OR UNAVAILABLE visual evidence',
      fn: async () => {
        expect(() => assertVisualEvidenceComplete({
          slices: SLICES,
          readings: new Map(),
        },),).toThrow(VisualEvidenceInterruptedError,);
        expect(() => assertVisualEvidenceComplete({
          slices: SLICES,
          readings: new Map([[
            'tabby.webp',
            {
              kind: 'unavailable',
              reason: 'readers-disagree',
              transient: false,
              perReader: [],
            },
          ],]),
        },),).toThrow(VisualEvidenceInterruptedError,);
      },
    },),
  ],
},);
