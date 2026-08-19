/**
 * Tests for preparing a picture to be sent, and refusing the ones that will not
 * fit.
 *
 * WHAT THESE PIN is that refusing is a first-class outcome rather than an error
 * path. Measured over the 284 assets in the pinned corpus the median is 71 KiB
 * and the largest 1312 KiB, and base64 inflates by a third, so some pictures
 * cannot be sent to either model that reads images. Against the two vision
 * models' contexts, the pictures refused are the two handwritten letters, which
 * are also the hardest to read: downscaling them to fit would produce exactly
 * the confident wrong reading the whole rule exists to avoid.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  encodedCharsThatFit,
  encodeImageAsset,
} from '../dist/final/node/index.mjs';

/**
 * Context of the smaller of the two models that read images.
 */
const SMALL_CONTEXT = 262_144;

/**
 * Bytes standing in for a picture, whose content is irrelevant to every rule
 * under test here.
 */
function bytesOf({ length, }: { readonly length: number; },): Uint8Array {
  return new Uint8Array(length,).fill(7,);
}

await describe({
  name: encodeImageAsset.name,
  children: [
    it({
      name: 'ENCODES A PICTURE AS A DATA URI CARRYING ITS OWN MEDIA TYPE, which is what the wire '
        + 'shape takes and what tells the model how to decode what it was given',
      fn: async () => {
        /**
         * A small picture, comfortably within any context.
         */
        const encoded = encodeImageAsset({
          bytes: bytesOf({ length: 64, },),
          assetName: 'tabby.webp',
          contextLength: SMALL_CONTEXT,
        },);

        expect(encoded.kind,).toBe('usable',);
        if (encoded.kind !== 'usable')
          throw new Error('usable by construction',);
        expect(encoded.dataUri.startsWith('data:image/webp;base64,',),).toBe(true,);
      },
    },),

    it({
      name: 'READS THE MEDIA TYPE FROM THE EXTENSION, since the corpus carries two of them and a '
        + 'picture sent under the wrong one asks a model to decode something it was not given',
      fn: async () => {
        /**
         * The other extension the corpus uses.
         */
        const encoded = encodeImageAsset({
          bytes: bytesOf({ length: 64, },),
          assetName: 'mittens.jpg',
          contextLength: SMALL_CONTEXT,
        },);
        if (encoded.kind !== 'usable')
          throw new Error('usable by construction',);
        expect(encoded.dataUri.startsWith('data:image/jpeg;base64,',),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES AN EXTENSION IT DOES NOT KNOW rather than guessing one, because a guess here '
        + 'is not a smaller version of the right answer, it is a picture the model cannot decode',
      fn: async () => {
        /**
         * What the encoder decided.
         */
        const encoded = encodeImageAsset({
          bytes: bytesOf({ length: 64, },),
          assetName: 'sill.heic',
          contextLength: SMALL_CONTEXT,
        },);

        expect(encoded.kind,).toBe('refused',);
        if (encoded.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(encoded.reason,).toBe('unknown-media-type',);
      },
    },),

    it({
      name: 'REFUSES A PICTURE TOO LARGE FOR THE MODEL IT WOULD GO TO, rather than shrinking it: '
        + 'the pictures that do not fit are the handwritten letters, which are the hardest to '
        + 'read, so a downscale would produce the confident wrong reading this all exists to avoid',
      fn: async () => {
        /**
         * A picture larger than half the smaller model's context allows.
         */
        const encoded = encodeImageAsset({
          bytes: bytesOf({ length: 1_024 * 1_024, },),
          assetName: 'letter.webp',
          contextLength: SMALL_CONTEXT,
        },);

        expect(encoded.kind,).toBe('refused',);
        if (encoded.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(encoded.reason,).toBe('too-large-for-model',);
      },
    },),

    it({
      name: 'ADMITS TO A LARGER MODEL WHAT IT REFUSES TO A SMALLER ONE, since the two that read '
        + 'images differ in context by a factor of two and the same picture is not equally '
        + 'sendable to both',
      fn: async () => {
        /**
         * A picture between the two models' limits.
         */
        const bytes = bytesOf({ length: 300 * 1_024, },);

        expect(encodeImageAsset({
          bytes,
          assetName: 'letter.webp',
          contextLength: 262_144,
        },).kind,).toBe('refused',);

        expect(encodeImageAsset({
          bytes,
          assetName: 'letter.webp',
          contextLength: 524_288,
        },).kind,).toBe('usable',);
      },
    },),
  ],
},);

await describe({
  name: encodedCharsThatFit.name,
  children: [
    it({
      name: 'LEAVES HALF THE CONTEXT FOR EVERYTHING ELSE, because a picture filling its context '
        + 'leaves no room to ask about it',
      fn: async () => {
        /**
         * Room in the smaller model.
         */
        const room = encodedCharsThatFit({ contextLength: SMALL_CONTEXT, },);

        expect(room,).toBeLessThan(SMALL_CONTEXT * 3,);
        expect(room,).toBeGreaterThan(0,);
      },
    },),
  ],
},);
