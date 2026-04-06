import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { compareAll, } from './client.multi.compare.ts';
import { embedAll, } from './client.multi.ts';
import {
  compare,
  embed,
  embedBatch,
} from './client.ts';
import type { Provider, } from './types.ts';

/**
 * Generate a minimal 1x1 PNG as a base64 data URI.
 * The color parameter controls the RGBA pixel value to produce distinct images.
 *
 * @param red - red channel value (0-255)
 * @param green - green channel value (0-255)
 * @param blue - blue channel value (0-255)
 * @returns 1x1 PNG as base64 data URI
 */
function makeMinimalPngDataUri(red: number, green: number, blue: number,): string {
  /**
   * Minimal 1x1 RGBA PNG built from raw bytes.
   * Structure: PNG signature + IHDR + IDAT (zlib-compressed scanline) + IEND.
   */
  const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,];

  /** CRC32 lookup table, computed once. */
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      // oxlint-disable-next-line no-bitwise -- CRC32 requires bitwise ops
      c = c & 1 ? 0xED_B8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    crcTable.push(c,);
  }

  /** Compute CRC32 of a byte array. */
  function crc32(bytes: number[],): number {
    let crc = 0xFF_FF_FF_FF;
    for (const byte of bytes) {
      // oxlint-disable-next-line no-bitwise -- CRC32 requires bitwise operations
      crc = (crcTable[(crc ^ byte) & 0xFF] ?? 0) ^ (crc >>> 8);
    }
    // oxlint-disable-next-line no-bitwise, prefer-math-trunc -- final XOR; bitwise truncation is intentional for CRC32
    return Math.trunc((crc ^ 0xFF_FF_FF_FF) >>> 0,);
  }

  /** Encode a 4-byte big-endian unsigned integer. */
  function uint32be(value: number,): number[] {
    return [
      // oxlint-disable-next-line no-bitwise -- byte extraction
      (value >>> 24) & 0xFF,
      // oxlint-disable-next-line no-bitwise
      (value >>> 16) & 0xFF,
      // oxlint-disable-next-line no-bitwise
      (value >>> 8) & 0xFF,
      // oxlint-disable-next-line no-bitwise
      value & 0xFF,
    ];
  }

  /** Build a PNG chunk: length + type + data + CRC. */
  function makeChunk(type: number[], data: number[],): number[] {
    const typeAndData = [...type, ...data,];
    return [...uint32be(data.length,), ...typeAndData,
      ...uint32be(crc32(typeAndData,),),];
  }

  /** IHDR: 1x1, 8-bit RGBA */
  const ihdr = makeChunk(
    [0x49, 0x48, 0x44, 0x52,],
    [...uint32be(1,), ...uint32be(1,), 8, 6, 0, 0, 0,],
  );

  /** Raw scanline: filter byte (0=None) + RGBA pixel. */
  const rawScanline = [0, red, green, blue, 255,];

  /**
   * Zlib wrapper around a single uncompressed deflate block.
   * CMF=0x78 (deflate, 32K window), FLG=0x01 (check bits for CMF).
   * BFINAL=1, BTYPE=00 (no compression), LEN=5, NLEN=~5.
   */
  const len = rawScanline.length;
  // oxlint-disable-next-line no-bitwise -- complement for deflate NLEN
  const nlen = len ^ 0xFF_FF;
  const deflateBlock = [
    0x78,
    0x01,
    0x01,
    // oxlint-disable-next-line no-bitwise
    len & 0xFF,
    (len >>> 8) & 0xFF,
    // oxlint-disable-next-line no-bitwise
    nlen & 0xFF,
    (nlen >>> 8) & 0xFF,
    ...rawScanline,
  ];

  /** Adler-32 checksum of the raw scanline data. */
  let a = 1;
  let b = 0;
  for (const byte of rawScanline) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  // oxlint-disable-next-line no-bitwise, prefer-math-trunc -- Adler-32 packing; bitwise truncation is intentional
  const adler32 = Math.trunc(((b << 16) | a) >>> 0,);
  deflateBlock.push(...uint32be(adler32,),);

  const idat = makeChunk([0x49, 0x44, 0x41, 0x54,], deflateBlock,);
  const iend = makeChunk([0x49, 0x45, 0x4E, 0x44,], [],);

  const pngBytes = new Uint8Array([...pngSignature, ...ihdr, ...idat, ...iend,],);
  let binary = '';
  for (const byte of pngBytes)
    binary += String.fromCodePoint(byte,);
  return `data:image/png;base64,${btoa(binary,)}`;
}

await describe({
  name: '',
  children: [
    //region Single-provider tests (Voyage)

    describe({
      name: 'embed (voyage)',
      children: [
        it({
          name: 'returns an embedding vector from a minimal PNG',
          fn: async () => {
            const dataUri = makeMinimalPngDataUri(255, 0, 0,);
            const result = await embed({ base64: dataUri, }, { provider: 'voyage', },);

            expect(result.embedding.length,).toBeGreaterThan(0,);
            expect(result.usage.totalTokens,).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
    describe({
      name: 'embedBatch (voyage)',
      children: [
        it({
          name: 'returns embeddings for multiple images',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const blue = makeMinimalPngDataUri(0, 0, 255,);
            const result = await embedBatch([{ base64: red, }, { base64: blue, },], {
              provider: 'voyage',
            },);

            expect(result.embeddings.length,).toBe(2,);
            const [first, second,] = result.embeddings;
            if (first === undefined || second === undefined)
              throw new Error('missing embeddings',);
            expect(first.length,).toBeGreaterThan(0,);
            expect(second.length,).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
    describe({
      name: 'compare (voyage)',
      children: [
        it({
          name: 'identical images have similarity near 1',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const result = await compare({ base64: red, }, { base64: red, }, {
              provider: 'voyage',
            },);

            expect(result.similarity,).toBeGreaterThan(0.99,);
            expect(result.distance,).toBeLessThan(0.01,);
          },
        },),
        it({
          name: 'different-colored images have lower similarity',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const blue = makeMinimalPngDataUri(0, 0, 255,);
            const result = await compare({ base64: red, }, { base64: blue, }, {
              provider: 'voyage',
            },);

            expect(result.similarity,).toBeLessThan(1,);
            expect(result.distance,).toBeGreaterThan(0,);
            expect(result.embeddingA.length,).toBe(result.embeddingB.length,);
          },
        },),
      ],
    },),

    //endregion Single-provider tests (Voyage)

    //region Single-provider tests (Gemini)

    describe({
      name: 'embed (gemini)',
      children: [
        it({
          name: 'returns an embedding vector from a minimal PNG',
          fn: async () => {
            const dataUri = makeMinimalPngDataUri(255, 0, 0,);
            const result = await embed({ base64: dataUri, }, { provider: 'gemini', },);

            expect(result.embedding.length,).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
    describe({
      name: 'embedBatch (gemini)',
      children: [
        it({
          name: 'returns embeddings for multiple images',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const blue = makeMinimalPngDataUri(0, 0, 255,);
            const result = await embedBatch([{ base64: red, }, { base64: blue, },], {
              provider: 'gemini',
            },);

            expect(result.embeddings.length,).toBe(2,);
            const [first, second,] = result.embeddings;
            if (first === undefined || second === undefined)
              throw new Error('missing embeddings',);
            expect(first.length,).toBeGreaterThan(0,);
            expect(second.length,).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
    describe({
      name: 'compare (gemini)',
      children: [
        it({
          name: 'identical images have similarity near 1',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const result = await compare({ base64: red, }, { base64: red, }, {
              provider: 'gemini',
            },);

            expect(result.similarity,).toBeGreaterThan(0.99,);
            expect(result.distance,).toBeLessThan(0.01,);
          },
        },),
        it({
          name: 'different-colored images have lower similarity',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const blue = makeMinimalPngDataUri(0, 0, 255,);
            const result = await compare({ base64: red, }, { base64: blue, }, {
              provider: 'gemini',
            },);

            expect(result.similarity,).toBeLessThan(1,);
            expect(result.distance,).toBeGreaterThan(0,);
            expect(result.embeddingA.length,).toBe(result.embeddingB.length,);
          },
        },),
      ],
    },),

    //endregion Single-provider tests (Gemini)

    //region Multi-provider tests

    describe({
      name: compareAll.name,
      children: [
        it({
          name: 'returns results from both providers',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const blue = makeMinimalPngDataUri(0, 0, 255,);
            const results = await compareAll({ base64: red, }, { base64: blue, },);

            expect(results.length,).toBe(2,);
            const providers = results.map(function getProvider(r,) {
              return r.provider;
            },);
            expect(providers,).toContain('voyage' as Provider,);
            expect(providers,).toContain('gemini' as Provider,);

            for (const entry of results) {
              expect(entry.result.similarity,).toBeLessThan(1,);
              expect(entry.result.embeddingA.length,).toBeGreaterThan(0,);
            }
          },
        },),
      ],
    },),
    describe({
      name: embedAll.name,
      children: [
        it({
          name: 'returns embeddings from both providers',
          fn: async () => {
            const red = makeMinimalPngDataUri(255, 0, 0,);
            const results = await embedAll({ base64: red, },);

            expect(results.length,).toBe(2,);
            for (const entry of results)
              expect(entry.result.embedding.length,).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
    //endregion Multi-provider tests
  ],
},);
