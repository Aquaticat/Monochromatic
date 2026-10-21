/**
 Tests the picture size read off a file header and the prompt tokens a request
 stands for once its pictures are counted by their patches.

 The headers are built by hand: a lossy, a lossless and an extended WebP, a
 PNG and a JPEG with a thumbnail segment before its frame header, plus
 files no reader here understands. The sizes 2400 by 2616 and 576 by 1280
 are those of the two pictures whose reported prompt tokens (8188 and 1156,
 XingZ6016 and zheermao101) the patch count is fitted to. Fixtures are
 cat-themed invention: headers and padding, no pixels.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  imagePixelSizeOf,
  NEURALWATT_UNSIZED_PICTURE_TOKENS,
  pictureTokensOfSize,
  pictureTokensOfUrl,
  promptTokensOfRequest,
} from '../dist/final/node/index.mjs';

/**
 A WebP file with the given first chunk.

 @param fourcc - chunk coding

 @param chunk - chunk payload

 @returns The file's bytes

 @example
 ```ts
 const bytes = webpOf({ fourcc: 'VP8L', chunk, },);
 ```
 */
function webpOf({ fourcc, chunk, }: { readonly fourcc: string; readonly chunk: Buffer; },): Buffer {
  /**
   Container header.
   */
  const riff = Buffer.alloc(20,);
  riff.write('RIFF', 0,);
  riff.writeUInt32LE(12 + chunk.length, 4,);
  riff.write('WEBP', 8,);
  riff.write(fourcc, 12,);
  riff.writeUInt32LE(chunk.length, 16,);
  return Buffer.concat([riff, chunk,],);
}

/**
 A lossy WebP of the stated size.

 @param width - pixels across

 @param height - pixels down

 @returns The file's bytes

 @example
 ```ts
 const bytes = lossy({ width: 576, height: 1280, },);
 ```
 */
function lossy({ width, height, }: { readonly width: number; readonly height: number; },): Buffer {
  /**
   Frame tag, start code and size.
   */
  const chunk = Buffer.alloc(40,);
  chunk[3] = 0x9D;
  chunk[4] = 0x01;
  chunk[5] = 0x2A;
  chunk.writeUInt16LE(width, 6,);
  chunk.writeUInt16LE(height, 8,);
  return webpOf({ fourcc: 'VP8 ', chunk, },);
}

/**
 A base64 data URI around bytes.

 @param bytes - the file

 @returns URI as the reading stage builds it

 @example
 ```ts
 const url = uriOf({ bytes, },);
 ```
 */
function uriOf({ bytes, }: { readonly bytes: Buffer; },): string {
  return `data:image/webp;base64,${bytes.toString('base64',)}`;
}

await describe({
  name: imagePixelSizeOf.name,
  children: [
    it({
      name: 'READS A LOSSY WEBP, the coding of the corpus\'s pictures',
      fn: async () => {
        await Promise.resolve();
        expect(imagePixelSizeOf({ bytes: lossy({ width: 2_400, height: 2_616, }), },),).toEqual({
          kind: 'sized',
          width: 2_400,
          height: 2_616,
        },);
      },
    },),

    it({
      name: 'READS A LOSSLESS WEBP, whose size is stored less one in 14 bits each',
      fn: async () => {
        await Promise.resolve();
        /**
         Signature byte, then 14 bits of width less one and 14 of height less one.
         */
        const chunk = Buffer.alloc(40,);
        chunk[0] = 0x2F;
        chunk.writeUInt32LE((575) | (1_279 << 14), 1,);
        expect(imagePixelSizeOf({ bytes: webpOf({ fourcc: 'VP8L', chunk, },), },),).toEqual({
          kind: 'sized',
          width: 576,
          height: 1_280,
        },);
      },
    },),

    it({
      name: 'READS AN EXTENDED WEBP, whose canvas is stored less one in 24 bits each',
      fn: async () => {
        await Promise.resolve();
        /**
         Flags, reserved bytes, then the canvas.
         */
        const chunk = Buffer.alloc(40,);
        chunk.writeUIntLE(1_224, 4, 3,);
        chunk.writeUIntLE(532, 7, 3,);
        expect(imagePixelSizeOf({ bytes: webpOf({ fourcc: 'VP8X', chunk, },), },),).toEqual({
          kind: 'sized',
          width: 1_225,
          height: 533,
        },);
      },
    },),

    it({
      name: 'READS A PNG off its header chunk',
      fn: async () => {
        await Promise.resolve();
        /**
         Signature, header chunk length and name, then the size.
         */
        const bytes = Buffer.alloc(40,);
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,],).copy(bytes, 0,);
        bytes.writeUInt32BE(13, 8,);
        bytes.write('IHDR', 12,);
        bytes.writeUInt32BE(300, 16,);
        bytes.writeUInt32BE(200, 20,);
        expect(imagePixelSizeOf({ bytes, },),).toEqual({ kind: 'sized', width: 300, height: 200, },);
      },
    },),

    it({
      name: 'READS A JPEG PAST A SEGMENT BEFORE ITS FRAME HEADER, such as the metadata a camera writes first',
      fn: async () => {
        await Promise.resolve();
        /**
         Start of image, a 6-byte application segment, then the frame header.
         */
        const bytes = Buffer.alloc(40,);
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x06, 0x01, 0x02, 0x03, 0x04, 0xFF, 0xC0, 0x00, 0x11, 0x08,],).copy(bytes, 0,);
        bytes.writeUInt16BE(1_280, 15,);
        bytes.writeUInt16BE(576, 17,);
        expect(imagePixelSizeOf({ bytes, },),).toEqual({ kind: 'sized', width: 576, height: 1_280, },);
      },
    },),

    it({
      name: 'REPORTS UNSIZED for a file in no format it reads, a header cut short, and a zero size',
      fn: async () => {
        await Promise.resolve();
        expect(imagePixelSizeOf({ bytes: Buffer.alloc(300, 7,), },),).toEqual({ kind: 'unsized', },);
        expect(imagePixelSizeOf({ bytes: Buffer.from('RIFF',), },),).toEqual({ kind: 'unsized', },);
        expect(imagePixelSizeOf({ bytes: Buffer.alloc(0,), },),).toEqual({ kind: 'unsized', },);
        expect(imagePixelSizeOf({ bytes: lossy({ width: 0, height: 10, }), },),).toEqual({ kind: 'unsized', },);
        expect(imagePixelSizeOf({ bytes: Buffer.from([0xFF, 0xD8, 0xFF, 0xC0,],), },),).toEqual({ kind: 'unsized', },);
      },
    },),
  ],
},);

await describe({
  name: 'picture tokens',
  children: [
    it({
      name: 'FITS THE TWO REPORTED COUNTS: 2400 by 2616 is 7998 and 576 by 1280 is 966, each 190 under what the '
        + 'provider reported with its text (8188 and 1156)',
      fn: async () => {
        await Promise.resolve();
        expect(pictureTokensOfSize({ width: 2_400, height: 2_616, },),).toBe(7_998,);
        expect(pictureTokensOfSize({ width: 576, height: 1_280, },),).toBe(966,);
        expect(7_998 + 190,).toBe(8_188,);
        expect(966 + 190,).toBe(1_156,);
      },
    },),

    it({
      name: 'COUNTS AT LEAST ONE PATCH ON A SIDE, so a sliver is never free',
      fn: async () => {
        await Promise.resolve();
        expect(pictureTokensOfSize({ width: 3, height: 3, },),).toBe(1,);
      },
    },),

    it({
      name: 'HOLDS AN INLINE PICTURE OF READABLE SIZE AT ITS PATCHES, and anything else at the ceiling: unreadable '
        + 'bytes, a data URI that is not base64, and a remote address',
      fn: async () => {
        await Promise.resolve();
        expect(pictureTokensOfUrl({ url: uriOf({ bytes: lossy({ width: 576, height: 1_280, }), }), },),).toBe(966,);
        expect(pictureTokensOfUrl({ url: uriOf({ bytes: Buffer.alloc(100, 7,), }), },),).toBe(
          NEURALWATT_UNSIZED_PICTURE_TOKENS,
        );
        expect(pictureTokensOfUrl({ url: 'data:text/plain,whiskers', },),).toBe(NEURALWATT_UNSIZED_PICTURE_TOKENS,);
        expect(pictureTokensOfUrl({ url: 'https://example.invalid/cat.webp', },),).toBe(NEURALWATT_UNSIZED_PICTURE_TOKENS,);
      },
    },),
  ],
},);

await describe({
  name: promptTokensOfRequest.name,
  children: [
    it({
      name: 'COUNTS A TEXT-ONLY REQUEST AS ITS BODY BYTES OVER FOUR, rounded up, as the body-only count did',
      fn: async () => {
        await Promise.resolve();
        expect(promptTokensOfRequest({
          messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
          bodyBytes: 4_001,
        },),).toBe(1_001,);
      },
    },),

    it({
      name: 'TAKES AN INLINE PICTURE OUT OF THE TEXT BYTES AND ADDS ITS PATCHES, one count per picture part',
      fn: async () => {
        await Promise.resolve();
        /**
         Two copies of one picture's URI.
         */
        const url = uriOf({ bytes: lossy({ width: 576, height: 1_280, }), });
        expect(promptTokensOfRequest({
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Read these.', },
              { type: 'image_url', image_url: { url, }, },
              { type: 'image_url', image_url: { url, }, },
            ],
          },],
          bodyBytes: 400 + (2 * url.length),
        },),).toBe(100 + (2 * 966),);
      },
    },),
  ],
},);
