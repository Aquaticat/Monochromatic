/**
 * Tests for reading a picture without a model: counting what OCR yields, and
 * refusing bytes no decoder can even turn into a picture.
 *
 * WHAT THIS PINS. `solidCharacters` is the count `readImageWithOcr` compares
 * against `MIN_OCR_CHARS` to decide `read` from `no-text`, so every shape of
 * whitespace the raw reading might carry has to be discounted the same way,
 * whether that is plain padding or the tabs and newlines a `.txt` file can
 * carry. The undecodable case pins the other end of the function: bytes that
 * are not a picture at all must come back as a named `unavailable` finding
 * rather than an unhandled rejection, and this needs neither `dwebp` nor
 * `magick` to succeed, only to fail, which arbitrary bytes buy on any machine
 * whether or not it carries either tool.
 *
 * THE `read` AND `no-text` PATHS ARE NOT EXERCISED HERE. Both depend on
 * `tesseract` actually transcribing a picture, which needs its `chi_sim`
 * language data installed, and a unit test must not depend on that. They are
 * verified at the user boundary instead, through the built artifact, on
 * 2026-08-19:
 *
 * ```
 * wangzihao980/Word1.webp       71288 bytes   read      405 chars
 * zheermao101/photo3.webp       33038 bytes   read      557 chars
 * dogesir_/intro.webp           95094 bytes   read      930 chars
 * Zha_Ke/letter.webp           628180 bytes   read     1718 chars
 * DarlinChit/photo1.webp       151352 bytes   read      139 chars
 * wangzihao980/picture4.webp    13728 bytes   no-text     0 chars
 * Uekawakuyuurei/img231.webp   169776 bytes   no-text     0 chars
 * ```
 *
 * `extensionOf` IS NOT COVERED HERE. It lives in `image-asset.ts` and
 * `readImageWithOcr` uses it to name the scratch file it writes before
 * decoding, but `translate-barrel.ts` never re-exports it, so it never reaches
 * `dist/final/node/index.mjs`: confirmed by grepping the built bundle and its
 * `.d.mts` export statement for the bare name. No import from this test can
 * reach a symbol the barrel does not carry, and adding it there is a second
 * file this pass does not touch.
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
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type OcrReading,
  readImageWithOcr,
  solidCharacters,
} from '../dist/final/node/index.mjs';

/**
 * Logger the reader writes its progress to.
 */
const l = tagged({ tag: 'image-ocr-test', },);

/**
 * A short run of arbitrary bytes that is not a picture in any format,
 * standing in for a corrupt file or an unrelated one landing where a picture
 * was expected. Ten bytes, no format's magic number among them.
 */
const UNDECODABLE_BYTES = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9,],);

await describe({
  name: solidCharacters.name,
  children: [
    it({
      name: 'COUNTS ZERO FOR AN EMPTY STRING, the base case every other whitespace rule in this '
        + 'function has to agree with',
      fn: async () => {
        expect(solidCharacters({ text: '', },),).toBe(0,);
      },
    },),

    it({
      name: 'COUNTS ZERO FOR TEXT THAT IS ONLY SPACES, so a picture that yields nothing but padding '
        + 'reads as bare rather than as a few characters of noise',
      fn: async () => {
        expect(solidCharacters({ text: '    ', },),).toBe(0,);
      },
    },),

    it({
      name: 'COUNTS ZERO FOR TEXT MADE ENTIRELY OF NEWLINES AND TABS, since the reading this counts '
        + 'comes from a raw `.txt` file read whitespace and all, and line breaks alone must never '
        + 'register as a character of transcript',
      fn: async () => {
        expect(solidCharacters({ text: '\n\t\n\t', },),).toBe(0,);
      },
    },),

    it({
      name: 'COUNTS ONLY THE NON-WHITESPACE RUN WHEN SPACES, TABS AND NEWLINES SIT BETWEEN LETTERS, '
        + 'since the raw reading is counted whitespace and all and only the solid characters decide '
        + 'whether a picture crosses `MIN_OCR_CHARS`',
      fn: async () => {
        expect(solidCharacters({ text: 'a b\tc\nd', },),).toBe(4,);
      },
    },),

    it({
      name: 'COUNTS EVERY CHARACTER WHEN THE TEXT CARRIES NO WHITESPACE AT ALL, so a dense '
        + 'transcript is never undercounted for having nothing to strip',
      fn: async () => {
        expect(solidCharacters({ text: 'abcdef', },),).toBe(6,);
      },
    },),

    it({
      name: 'COUNTS NON-WHITESPACE CHARACTERS IN CHINESE TEXT THE SAME WAY AS LATIN, since the '
        + 'corpus this reads is `chi_sim` and a count that only worked on Latin script would '
        + 'silently break on every real reading',
      fn: async () => {
        expect(solidCharacters({ text: '喵喵 喵', },),).toBe(3,);
      },
    },),
  ],
},);

await describe({
  name: readImageWithOcr.name,
  children: [
    it({
      name: 'REFUSES BYTES NO DECODER CAN READ RATHER THAN THROWING, returning `unavailable` with '
        + 'reason `undecodable` so a corrupt or unrecognisable asset is a named finding instead of '
        + 'an unhandled rejection reaching whatever called this. Neither `dwebp` nor `magick` needs '
        + 'to succeed here, only to fail on bytes that are not a picture at all, which is what makes '
        + 'this stable on a machine carrying neither tool, either, or both',
      fn: async () => {
        /**
         * What the reader made of bytes no decoder can parse.
         */
        const reading: OcrReading = await readImageWithOcr({
          bytes: UNDECODABLE_BYTES,
          assetName: 'mittens-noise.webp',
          l,
        },);

        expect(reading.kind,).toBe('unavailable',);
        if (reading.kind !== 'unavailable')
          throw new Error('unavailable by construction',);
        expect(reading.reason,).toBe('undecodable',);
      },
    },),
  ],
},);
