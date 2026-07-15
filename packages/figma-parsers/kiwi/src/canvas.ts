/**
 * canvas.fig header and payload parsing.
 *
 * @example
 * ```ts
 * parseCanvasHeader(new Uint8Array([102, 105, 103, 45, 107, 105, 119, 105, 101, 0, 0, 0, 0, 0, 0, 0])).fileType;
 * // 'fig'
 * ```
 */

import { promisify, } from 'node:util';
import {
  inflateRaw,
  zstdDecompress,
} from 'node:zlib';

import { caughtValueText as caughtErrorMessage, } from '@monochromatic-dev/module-caught-value/ts';
import type { FigmaFileType, } from './types.ts';

/**
 * Magic bytes at the start of canvas.fig for each Figma file type.
 *
 * @example
 * ```ts
 * CANVAS_FIG_MAGIC.fig;
 * // 'fig-kiwie'
 * ```
 */
export const CANVAS_FIG_MAGIC = {
  deck: 'fig-decke',
  fig: 'fig-kiwie',
  jam: 'fig-jam.e',
} as const;

/**
 * Byte offset where deflate-compressed schema starts in canvas.fig.
 *
 * @example
 * ```ts
 * CANVAS_HEADER_SIZE;
 * // 16
 * ```
 */
export const CANVAS_HEADER_SIZE = 16;

/**
 * Number of bytes reserved for the null-terminated magic string.
 */
const MAGIC_FIELD_LENGTH = 10;

/**
 * Byte length of zstd size prefix before frame data.
 */
const ZSTD_SIZE_PREFIX_LENGTH = 4;

/**
 * First byte of Zstandard frame magic.
 */
const ZSTD_MAGIC_BYTE_ONE = 0x28;

/**
 * Second byte of Zstandard frame magic.
 */
const ZSTD_MAGIC_BYTE_TWO = 0xB5;

/**
 * Third byte of Zstandard frame magic.
 */
const ZSTD_MAGIC_BYTE_THREE = 0x2F;

/**
 * Fourth byte of Zstandard frame magic.
 */
const ZSTD_MAGIC_BYTE_FOUR = 0xFD;

/**
 * Async raw-deflate decompressor.
 */
const inflateRawAsync = promisify(inflateRaw,);

/**
 * Async Zstandard decompressor.
 */
const zstdDecompressAsync = promisify(zstdDecompress,);

/**
 * Zstandard frame magic bytes.
 */
const ZSTD_MAGIC = new Uint8Array([
  ZSTD_MAGIC_BYTE_ONE,
  ZSTD_MAGIC_BYTE_TWO,
  ZSTD_MAGIC_BYTE_THREE,
  ZSTD_MAGIC_BYTE_FOUR,
],);

/**
 * Parsed canvas.fig header.
 *
 * @example
 * ```ts
 * const header: CanvasHeader = { fileType: 'fig', reserved: new Uint8Array() };
 * ```
 */
export type CanvasHeader = {
  readonly fileType: FigmaFileType;
  readonly reserved: Uint8Array;
};

/**
 * Parsed canvas.fig payload sections.
 *
 * @example
 * ```ts
 * const parsed: CanvasFigSections = { fileType: 'fig', schemaBytes: new Uint8Array(), documentBytes: new Uint8Array() };
 * ```
 */
export type CanvasFigSections = {
  readonly documentBytes: Uint8Array;
  readonly fileType: FigmaFileType;
  readonly schemaBytes: Uint8Array;
};

/**
 * Parses 16-byte header of a canvas.fig binary blob.
 *
 * @param data - Raw canvas.fig bytes.
 *
 * @returns {@link CanvasHeader} file type and reserved bytes.
 *
 * @example
 * ```ts
 * parseCanvasHeader(new Uint8Array([102, 105, 103, 45, 107, 105, 119, 105, 101, 0, 0, 0, 0, 0, 0, 0])).fileType;
 * // 'fig'
 * ```
 */
export function parseCanvasHeader(data: Uint8Array,): CanvasHeader {
  if (data.length < CANVAS_HEADER_SIZE)
    throw new Error(`canvas.fig header too short: ${data.length} bytes (need ${CANVAS_HEADER_SIZE})`);

  /**
   * Length before null terminator.
   */
  const magicLength = findMagicLength({ data, },);
  /**
   * ASCII-decoded magic string.
   */
  const magic = new TextDecoder('ascii',).decode(data.subarray(
    0,
    magicLength,
  ),);
  /**
   * File type resolved from magic.
   */
  const fileType = fileTypeFromMagic({ magic, },);
  return {
    fileType,
    reserved: data.subarray(
      magicLength + 1,
      CANVAS_HEADER_SIZE,
    ),
  };
}

/**
 * Parses canvas.fig binary blob into schema and document bytes.
 *
 * @param canvasData - Raw canvas.fig bytes.
 *
 * @returns parsed {@link CanvasFigSections} (file type, schema bytes, and document bytes).
 *
 * @example
 * ```ts
 * await parseCanvasFig(new Uint8Array([102, 105, 103, 45, 107, 105, 119, 105, 101, 0, 0, 0, 0, 0, 0, 0]));
 * ```
 */
export async function parseCanvasFig(canvasData: Uint8Array,): Promise<CanvasFigSections> {
  /**
   * File type pulled from header.
   */
  const { fileType, } = parseCanvasHeader(canvasData,);
  /**
   * Start offset of zstd document frame.
   */
  const zstdOffset = findZstdOffset({ canvasData, },);
  /**
   * Deflate-compressed schema slice.
   */
  const compressedSchema = canvasData.subarray(
    CANVAS_HEADER_SIZE,
    zstdOffset >= 0 ? zstdOffset - ZSTD_SIZE_PREFIX_LENGTH : undefined,
  );
  /**
   * Decompressed schema bytes.
   */
  const schemaBytes = await inflateSchema({ compressedSchema, },);
  /**
   * Decompressed document bytes.
   */
  const documentBytes = zstdOffset >= 0
    ? await decompressZstd(zstdPayload({
      canvasData,
      zstdOffset,
    },),)
    : new Uint8Array();

  return {
    documentBytes,
    fileType,
    schemaBytes,
  };
}

/**
 * Decompresses a single zstd frame with Node's built-in zlib.
 *
 * @param data - Zstd-compressed frame bytes.
 *
 * @mutates data through Buffer.from value conversion and native byte access
 *
 * @returns Decompressed document bytes.
 *
 * @example
 * ```ts
 * await decompressZstd(new Uint8Array());
 * ```
 */
export async function decompressZstd(data: Uint8Array,): Promise<Uint8Array> {
  /**
   * Decompressed Zstandard frame.
   */
  const decompressed = await zstdDecompressAsync(Buffer.from(data,),);
  return new Uint8Array(decompressed,);
}

/**
 * Finds null terminator in header magic field.
 *
 * @param data - Canvas bytes.
 *
 * @returns Magic length.
 *
 * @example
 * ```ts
 * findMagicLength({ data: new Uint8Array([65, 0]) });
 * // 1
 * ```
 */
function findMagicLength({ data, }: { readonly data: Uint8Array; },): number {
  for (let index = 0; index < MAGIC_FIELD_LENGTH; index++) {
    if (data[index] === 0)
      return index;
  }
  return MAGIC_FIELD_LENGTH;
}

/**
 * Resolves file type from magic string.
 *
 * @param magic - Magic string.
 *
 * @returns {@link FigmaFileType}.
 *
 * @example
 * ```ts
 * fileTypeFromMagic({ magic: 'fig-kiwie' });
 * // 'fig'
 * ```
 */
function fileTypeFromMagic({ magic, }: { readonly magic: string; },): FigmaFileType {
  if (magic === CANVAS_FIG_MAGIC.fig)
    return 'fig';
  if (magic === CANVAS_FIG_MAGIC.deck)
    return 'deck';
  if (magic === CANVAS_FIG_MAGIC.jam)
    return 'jam';
  throw new Error(`Unknown canvas.fig magic: "${magic}"`);
}

/**
 * Finds zstd frame offset in canvas data.
 *
 * @param canvasData - Canvas bytes.
 *
 * @returns Frame offset, or -1 when absent.
 *
 * @example
 * ```ts
 * findZstdOffset({ canvasData: new Uint8Array() });
 * // -1
 * ```
 */
function findZstdOffset({ canvasData, }: { readonly canvasData: Uint8Array; },): number {
  for (let offset = CANVAS_HEADER_SIZE; offset < (canvasData.length - ZSTD_SIZE_PREFIX_LENGTH); offset++) {
    if (zstdMagicMatches({
      canvasData,
      offset,
    }))
      return offset;
  }
  return -1;
}

/**
 * Returns whether zstd magic bytes match at offset.
 *
 * @param canvasData - Canvas bytes.
 *
 * @param offset - Candidate offset.
 *
 * @returns Whether magic matches.
 *
 * @example
 * ```ts
 * zstdMagicMatches({ canvasData: new Uint8Array([0x28, 0xB5, 0x2F, 0xFD]), offset: 0 });
 * // true
 * ```
 */
function zstdMagicMatches(
  {
    canvasData,
    offset,
  }: {
    readonly canvasData: Uint8Array;
    readonly offset: number;
  },
): boolean {
  return ZSTD_MAGIC.every(function byteMatches(
    byte,
    index,
  ): boolean {
    return canvasData[offset + index] === byte;
  },);
}

/**
 * Inflates schema bytes and logs failures before rethrowing.
 *
 * @param compressedSchema - Compressed schema bytes.
 *
 * @mutates compressedSchema through Buffer.from value conversion and native byte access
 *
 * @returns Decompressed schema bytes.
 *
 * @example
 * ```ts
 * inflateSchema({ compressedSchema: new Uint8Array() });
 * ```
 */
async function inflateSchema({ compressedSchema, }: { readonly compressedSchema: Uint8Array; },): Promise<Uint8Array> {
  try {
    /**
     * Inflated schema bytes.
     */
    const inflatedSchema = await inflateRawAsync(Buffer.from(compressedSchema,),);
    return new Uint8Array(inflatedSchema,);
  }
  catch (error) {
    console.warn(`[figma-kiwi] schema inflate failed: ${caughtErrorMessage(error,)}`,);
    throw error;
  }
}

/**
 * Extracts zstd payload slice from canvas data.
 *
 * @param canvasData - Canvas bytes.
 *
 * @param zstdOffset - Zstandard frame offset.
 *
 * @returns Bounded zstd frame bytes.
 *
 * @example
 * ```ts
 * zstdPayload({ canvasData: new Uint8Array(20), zstdOffset: 4 });
 * ```
 */
function zstdPayload(
  {
    canvasData,
    zstdOffset,
  }: {
    readonly canvasData: Uint8Array;
    readonly zstdOffset: number;
  },
): Uint8Array {
  /**
   * Offset of little-endian zstd size prefix.
   */
  const sizePrefixOffset = zstdOffset - ZSTD_SIZE_PREFIX_LENGTH;
  /**
   * Declared compressed zstd size.
   */
  const zstdSize = new DataView(
    canvasData.buffer,
    canvasData.byteOffset + sizePrefixOffset,
    ZSTD_SIZE_PREFIX_LENGTH,
  ).getUint32(
    0,
    true,
  );
  return canvasData.subarray(
    zstdOffset,
    zstdOffset + zstdSize,
  );
}
