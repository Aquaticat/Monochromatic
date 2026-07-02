/**
 * Tests for the build-time favicon: the minimal PNG encoder and the
 * rasterized `w<` wordmark.
 *
 * @module
 */

import { Buffer, } from 'node:buffer';
import { inflateSync, } from 'node:zlib';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FAVICON_SIZE,
  renderFaviconPngBase64,
} from './favicon.ts';
import { encodePngRgb, } from './favicon-png.ts';

/**
 * Byte offset of IHDR's width field inside a PNG file (8 signature
 * bytes, 4 length bytes, 4 type bytes).
 */
const IHDR_WIDTH_OFFSET = 16;

/**
 * Byte offset of IHDR's height field: one uint32 past the width.
 */
const IHDR_HEIGHT_OFFSET = IHDR_WIDTH_OFFSET + (2 + 2);

/**
 * Byte offset of IHDR's bit-depth field: one uint32 past the height.
 */
const IHDR_BIT_DEPTH_OFFSET = IHDR_HEIGHT_OFFSET + (2 + 2);

/**
 * Byte offset of IHDR's color-type field, right after the bit depth.
 */
const IHDR_COLOR_TYPE_OFFSET = IHDR_BIT_DEPTH_OFFSET + 1;

/**
 * Eight-byte PNG signature in base64 (the standard prefix of every
 * base64-encoded PNG).
 */
const PNG_SIGNATURE_BASE64 = 'iVBORw0KGgo=';

/**
 * Channels per truecolor RGB pixel.
 */
const RGB_CHANNELS = 2 + 1;

/**
 * Byte count of a chunk's non-data framing (uint32 length, 4-byte
 * type, uint32 CRC).
 */
const CHUNK_FRAMING_BYTES = (2 + 2) * (2 + 1);

/**
 * Grayscale byte every ground (background) sample must stay at or
 * below: `oklch(0.1 0 0)` is nearly black in sRGB.
 */
const GROUND_BYTE_MAX = 10;

/**
 * Grayscale byte the ink must reach: `oklch(0.9 0 0)` is bright in
 * sRGB.
 */
const INK_BYTE_MIN = 200;

/**
 * Parsed shape of a PNG produced by the encoder under test.
 */
type ParsedPng = Readonly<{
  /**
   * IHDR width in pixels.
   */
  width: number;
  /**
   * IHDR height in pixels.
   */
  height: number;
  /**
   * IHDR bit depth.
   */
  bitDepth: number;
  /**
   * IHDR color type.
   */
  colorType: number;
  /**
   * Inflated scanline stream: per row, one filter byte then packed RGB.
   */
  raw: Buffer;
}>;

/**
 * Parses signature, IHDR fields, and the inflated IDAT stream out of a
 * PNG file, via linear chunk walking.
 *
 * @param png - PNG file bytes
 *
 * @returns parsed dimensions, format fields, and raw scanlines
 *
 * @throws Error when the signature is not PNG's
 */
function parsePng(png: Buffer,): ParsedPng {
  /**
   * Expected signature bytes.
   */
  const signature = Buffer.from(
    PNG_SIGNATURE_BASE64,
    'base64',
  );

  if (!png.subarray(
    0,
    signature.length,
  )
    .equals(signature,)
  ) {
    throw new Error('not a PNG: signature mismatch',);
  }

  /**
   * Collected IDAT payloads, concatenated before inflating; the chunk
   * walk lives in a named IIFE so its cursor stays scoped to it.
   */
  const idatParts = (function collectIdatParts(): Buffer[] {
    /**
     * IDAT payloads collected by the walk.
     */
    const parts: Buffer[] = [];

    /**
     * Chunk-walk cursor, starting past the signature.
     */
    let cursor = signature.length;

    while (cursor < png.length) {
      /**
       * Payload length of the chunk at cursor.
       */
      const dataLength = png.readUInt32BE(cursor,);

      /**
       * Offset where the chunk's payload starts, past the length and
       * type fields.
       */
      const dataStart = cursor + ((2 + 2) + (2 + 2));

      /**
       * Type of the chunk at cursor.
       */
      const type = png.toString(
        'latin1',
        cursor + (2 + 2),
        dataStart,
      );

      if (type === 'IDAT') {
        parts.push(png.subarray(
          dataStart,
          dataStart + dataLength,
        ),);
      }

      cursor += CHUNK_FRAMING_BYTES + dataLength;
    }

    return parts;
  })();

  return {
    width: png.readUInt32BE(IHDR_WIDTH_OFFSET,),
    height: png.readUInt32BE(IHDR_HEIGHT_OFFSET,),
    bitDepth: png.readUInt8(IHDR_BIT_DEPTH_OFFSET,),
    colorType: png.readUInt8(IHDR_COLOR_TYPE_OFFSET,),
    raw: inflateSync(Buffer.concat(idatParts,),),
  };
}

/**
 * Collects the packed RGB bytes of one parsed PNG, dropping each row's
 * leading filter byte.
 *
 * @param parsed - parsed PNG to read pixels from
 *
 * @returns packed RGB bytes, rows top to bottom
 */
function packedPixels(parsed: ParsedPng,): Buffer {
  /**
   * Byte count of one row of packed RGB pixels.
   */
  const rowBytes = parsed.width * RGB_CHANNELS;

  /**
   * Row buffers with the filter byte stripped.
   */
  const rows = Array.from(
    { length: parsed.height, },
    function stripFilterByte(
      _unused,
      row,
    ): Buffer {
      /**
       * Offset of this row's filter byte inside the raw stream.
       */
      const rowStart = row * (rowBytes + 1);

      return parsed.raw.subarray(
        rowStart + 1,
        rowStart + 1 + rowBytes,
      );
    },
  );

  return Buffer.concat(rows,);
}

await describe({
  name: '',
  children: [
    describe({
      name: encodePngRgb.name,
      children: [
        it({
          name: 'round-trips dimensions, format fields, and pixel bytes',
          fn: async function roundTripsPixels(): Promise<void> {
            /**
             * Distinct fixture bytes for a 2x1 image.
             */
            const pixels = Uint8Array.from(
              [
                1,
                2,
                10,
                100,
                200,
                255,
              ],
            );

            /**
             * Parsed form of the encoded fixture.
             */
            const parsed = parsePng(await encodePngRgb(
              {
                width: 2,
                height: 1,
                pixels,
              },
            ),);

            expect(parsed.width,).toBe(2,);
            expect(parsed.height,).toBe(1,);
            expect(parsed.bitDepth,).toBe(2 * (2 * 2),);
            expect(parsed.colorType,).toBe(2,);
            expect([...packedPixels(parsed,),],).toEqual([...pixels,],);
          },
        },),
        it({
          name: 'throws when the pixel byte count does not match the dimensions',
          fn: async function throwsOnByteCountMismatch(): Promise<void> {
            /**
             * Error thrown by the mismatched call, captured through a
             * named IIFE so no `let` leaks into the test body.
             */
            const caught = await (async function captureThrow(): Promise<unknown> {
              try {
                await encodePngRgb(
                  {
                    width: 2,
                    height: 2,
                    pixels: Uint8Array.from([0,],),
                  },
                );

                return undefined;
              }
              catch (error) {
                return error;
              }
            })();

            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('expected',);
          },
        },),
      ],
    },),
    describe({
      name: renderFaviconPngBase64.name,
      children: [
        it({
          name: 'renders a FAVICON_SIZE-square truecolor PNG',
          fn: async function rendersSquarePng(): Promise<void> {
            /**
             * Rendered favicon PNG bytes.
             */
            const png = Buffer.from(
              await renderFaviconPngBase64(),
              'base64',
            );

            /**
             * Parsed favicon PNG.
             */
            const parsed = parsePng(png,);

            expect(parsed.width,).toBe(FAVICON_SIZE,);
            expect(parsed.height,).toBe(FAVICON_SIZE,);
            expect(parsed.colorType,).toBe(2,);
          },
        },),
        it({
          name: 'draws achromatic ink on an achromatic near-black ground',
          fn: async function drawsGrayscaleWordmark(): Promise<void> {
            /**
             * Rendered favicon PNG bytes.
             */
            const png = Buffer.from(
              await renderFaviconPngBase64(),
              'base64',
            );

            /**
             * Packed RGB bytes of the rendered favicon.
             */
            const pixels = packedPixels(parsePng(png,),);

            /**
             * Gray value of every pixel; collecting them asserts each
             * pixel is achromatic (all three channels equal) on the way.
             */
            const grays = Array.from(
              { length: pixels.length / RGB_CHANNELS, },
              function grayOfPixel(
                _unused,
                index,
              ): number {
                /**
                 * Offset of this pixel's R byte.
                 */
                const offset = index * RGB_CHANNELS;

                /**
                 * Red channel, the gray value under test.
                 */
                const gray = pixels.readUInt8(offset,);

                expect(pixels.readUInt8(offset + 1,),).toBe(gray,);
                expect(pixels.readUInt8(offset + 2,),).toBe(gray,);

                return gray;
              },
            );

            // Corner pixel is bare ground; the wordmark is centered.
            expect(pixels.readUInt8(0,),).toBeLessThanOrEqual(GROUND_BYTE_MAX,);
            expect(Math.max(...grays,),).toBeGreaterThanOrEqual(INK_BYTE_MIN,);
          },
        },),
        it({
          name: 'is deterministic across calls',
          fn: async function isDeterministic(): Promise<void> {
            expect(await renderFaviconPngBase64(),).toBe(
              await renderFaviconPngBase64(),
            );
          },
        },),
      ],
    },),
  ],
},);
