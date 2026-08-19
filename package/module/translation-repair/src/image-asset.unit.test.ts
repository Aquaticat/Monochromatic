/**
 * Tests for preparing a picture to be sent, and refusing the ones that will not
 * fit.
 *
 * WHAT THESE PIN is that refusing is a first-class outcome rather than an error
 * path, and that the CALLER decides the ceiling.
 *
 * THE CEILING USED TO BE DERIVED HERE and it measured the wrong thing: half a
 * model's context, converted to characters, compared against base64 length. A
 * vision model tokenizes by resolution rather than by encoded length, so that
 * number was not conservative but unrelated. Measured on 2026-08-19, the
 * provider accepted `gqt/photo1.webp` at 1274028 bytes, more than four times
 * what the derivation allowed, and read 2631 characters from it. This file no
 * longer asserts anything about contexts, because this module no longer knows
 * about them.
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

import { encodeImageAsset, } from '../dist/final/node/index.mjs';

/**
 * A ceiling a caller might set, standing in for whatever bound it chooses.
 */
const CEILING = 1_000_000;

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
          maxBytes: CEILING,
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
          maxBytes: CEILING,
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
          maxBytes: CEILING,
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
          maxBytes: CEILING,
        },);

        expect(encoded.kind,).toBe('refused',);
        if (encoded.kind !== 'refused')
          throw new Error('refused by construction',);
        expect(encoded.reason,).toBe('too-large-for-model',);
      },
    },),

    it({
      name: 'ADMITS UNDER ONE CEILING WHAT IT REFUSES UNDER ANOTHER, since the bound belongs to '
        + 'whoever is sending rather than to this function. A picture is not large or small in '
        + 'itself, only against a limit somebody chose',
      fn: async () => {
        /**
         * A picture between the two ceilings below.
         */
        const bytes = bytesOf({ length: 300 * 1_024, },);

        expect(encodeImageAsset({
          bytes,
          assetName: 'letter.webp',
          maxBytes: 200 * 1_024,
        },).kind,).toBe('refused',);

        expect(encodeImageAsset({
          bytes,
          assetName: 'letter.webp',
          maxBytes: 400 * 1_024,
        },).kind,).toBe('usable',);
      },
    },),

    it({
      name: 'ACCEPTS A PICTURE THE OLD DERIVATION WOULD HAVE REFUSED, which is the whole reason '
        + 'the derivation is gone. Sent as it is, the provider read 2631 characters out of this '
        + 'size while the derived ceiling for the same model stopped at 294912 bytes',
      fn: async () => {
        expect(encodeImageAsset({
          bytes: bytesOf({ length: 1_274_028, },),
          assetName: 'photo1.webp',
          maxBytes: 8_388_608,
        },).kind,).toBe('usable',);
      },
    },),
  ],
},);
