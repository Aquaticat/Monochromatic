/**
 * Minimal ZIP extraction for Figma export archives.
 *
 * @example
 * ```ts
 * await extractZipEntries(new Uint8Array());
 * ```
 */

import { promisify, } from 'node:util';
import { inflateRaw, } from 'node:zlib';

/**
 * End of central directory signature.
 */
const EOCD_SIGNATURE = 0x06_05_4B_50;

/**
 * Central directory file header signature.
 */
const CENTRAL_DIRECTORY_SIGNATURE = 0x02_01_4B_50;

/**
 * Local file header signature.
 */
const LOCAL_FILE_SIGNATURE = 0x04_03_4B_50;

/**
 * Minimum EOCD record byte length.
 */
const EOCD_MIN_LENGTH = 22;

/**
 * EOCD offset for central directory entry count.
 */
const EOCD_ENTRY_COUNT_OFFSET = 10;

/**
 * EOCD offset for central directory start.
 */
const EOCD_CENTRAL_DIRECTORY_OFFSET = 16;

/**
 * Central directory fixed header byte length.
 */
const CENTRAL_DIRECTORY_HEADER_LENGTH = 46;

/**
 * Central directory compression-method offset.
 */
const CENTRAL_COMPRESSION_METHOD_OFFSET = 10;

/**
 * Central directory compressed-size offset.
 */
const CENTRAL_COMPRESSED_SIZE_OFFSET = 20;

/**
 * Central directory uncompressed-size offset.
 */
const CENTRAL_UNCOMPRESSED_SIZE_OFFSET = 24;

/**
 * Central directory filename-length offset.
 */
const CENTRAL_FILE_NAME_LENGTH_OFFSET = 28;

/**
 * Central directory extra-length offset.
 */
const CENTRAL_EXTRA_LENGTH_OFFSET = 30;

/**
 * Central directory comment-length offset.
 */
const CENTRAL_COMMENT_LENGTH_OFFSET = 32;

/**
 * Central directory local-header-offset field.
 */
const CENTRAL_LOCAL_HEADER_OFFSET = 42;

/**
 * Local header fixed byte length.
 */
const LOCAL_HEADER_LENGTH = 30;

/**
 * Local header filename-length offset.
 */
const LOCAL_FILE_NAME_LENGTH_OFFSET = 26;

/**
 * Local header extra-length offset.
 */
const LOCAL_EXTRA_LENGTH_OFFSET = 28;

/**
 * Stored ZIP compression method.
 */
const ZIP_METHOD_STORED = 0;

/**
 * Deflate ZIP compression method.
 */
const ZIP_METHOD_DEFLATE = 8;

/**
 * Async raw-deflate decompressor.
 */
const inflateRawAsync = promisify(inflateRaw,);

/**
 * ZIP entry pair for output map construction.
 *
 * @example
 * ```ts
 * const entry: ZipEntryPair = ['meta.json', new Uint8Array()];
 * ```
 */
type ZipEntryPair = readonly [
  string,
  Uint8Array
];

/**
 * Parsed central directory entry plus next cursor offset.
 *
 * @example
 * ```ts
 * const parsed: ParsedZipEntry = { entry: ['a', new Uint8Array()], nextOffset: 1 };
 * ```
 */
type ParsedZipEntry = {
  readonly contentPromise: Promise<Uint8Array>;
  readonly fileName: string;
  readonly nextOffset: number;
};

/**
 * Extracts entries from a ZIP buffer.
 *
 * @param buffer - Raw ZIP file content.
 *
 * @returns Map from entry name to decompressed content.
 *
 * @example
 * ```ts
 * await extractZipEntries(new Uint8Array());
 * ```
 */
export async function extractZipEntries(buffer: Uint8Array,): Promise<Map<string, Uint8Array>> {
  /**
   * Structured view over ZIP bytes.
   */
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  /**
   * EOCD offset.
   */
  const eocdOffset = findEocdOffset({
    view,
    bufferLength: buffer.length,
  },);
  /**
   * Central directory start offset.
   */
  const centralDirectoryOffset = view.getUint32(
    eocdOffset + EOCD_CENTRAL_DIRECTORY_OFFSET,
    true,
  );
  /**
   * Number of central directory entries.
   */
  const centralDirectoryEntries = view.getUint16(
    eocdOffset + EOCD_ENTRY_COUNT_OFFSET,
    true,
  );

  return new Map(await parseCentralDirectory({
    buffer,
    view,
    centralDirectoryOffset,
    centralDirectoryEntries,
  },),);
}

/**
 * Finds EOCD record offset.
 *
 * @param view - DataView.
 *
 * @param bufferLength - Buffer length.
 *
 * @returns EOCD offset.
 *
 * @example
 * ```ts
 * findEocdOffset({ view: new DataView(new ArrayBuffer(0)), bufferLength: 0 });
 * ```
 */
function findEocdOffset(
  {
    view,
    bufferLength,
  }: {
    readonly bufferLength: number;
    readonly view: DataView;
  },
): number {
  for (let offset = bufferLength - EOCD_MIN_LENGTH; offset >= 0; offset--) {
    if (view.getUint32(
      offset,
      true,
    ) === EOCD_SIGNATURE)
      return offset;
  }
  throw new Error('Cannot find ZIP end of central directory');
}

/**
 * Parses central directory entries.
 *
 * @param buffer - ZIP bytes.
 *
 * @param view - ZIP DataView.
 *
 * @param centralDirectoryOffset - Directory offset.
 *
 * @param centralDirectoryEntries - Entry count.
 *
 * @returns {@link ZipEntryPair} entries for map construction.
 *
 * @example
 * ```ts
 * parseCentralDirectory({ buffer: new Uint8Array(), view: new DataView(new ArrayBuffer(0)), centralDirectoryOffset: 0, centralDirectoryEntries: 0 });
 * // []
 * ```
 */
function parseCentralDirectory(
  {
    buffer,
    view,
    centralDirectoryOffset,
    centralDirectoryEntries,
  }: {
    readonly buffer: Uint8Array;
    readonly centralDirectoryEntries: number;
    readonly centralDirectoryOffset: number;
    readonly view: DataView;
  },
): Promise<readonly ZipEntryPair[]> {
  /**
   * Parsed entry pair promises.
   */
  const entryPromises: Promise<ZipEntryPair>[] = [];
  for (let entryIndex = 0, offset = centralDirectoryOffset; entryIndex < centralDirectoryEntries; entryIndex++) {
    /**
     * Parsed entry metadata and next central directory cursor.
     */
    const parsed = parseCentralEntry({
      buffer,
      view,
      offset,
    },);
    entryPromises.push(zipEntryPair({ parsed, },),);
    offset = parsed.nextOffset;
  }
  return Promise.all(entryPromises,);
}

/**
 * Parses one central directory entry.
 *
 * @param buffer - ZIP bytes.
 *
 * @param view - ZIP DataView.
 *
 * @param offset - Central entry offset.
 *
 * @returns {@link ParsedZipEntry} with next offset.
 *
 * @example
 * ```ts
 * parseCentralEntry({ buffer: new Uint8Array(), view: new DataView(new ArrayBuffer(0)), offset: 0 });
 * ```
 */
function parseCentralEntry(
  {
    buffer,
    view,
    offset,
  }: {
    readonly buffer: Uint8Array;
    readonly offset: number;
    readonly view: DataView;
  },
): ParsedZipEntry {
  if (view.getUint32(
    offset,
    true,
  ) !== CENTRAL_DIRECTORY_SIGNATURE)
    throw new Error(`Invalid central directory entry signature at offset ${offset}`);

  /**
   * Compression method.
   */
  const compressionMethod = view.getUint16(
    offset + CENTRAL_COMPRESSION_METHOD_OFFSET,
    true,
  );
  /**
   * Compressed byte length.
   */
  const compressedSize = view.getUint32(
    offset + CENTRAL_COMPRESSED_SIZE_OFFSET,
    true,
  );
  /**
   * Expected uncompressed byte length.
   */
  const uncompressedSize = view.getUint32(
    offset + CENTRAL_UNCOMPRESSED_SIZE_OFFSET,
    true,
  );
  /**
   * Filename byte length.
   */
  const fileNameLength = view.getUint16(
    offset + CENTRAL_FILE_NAME_LENGTH_OFFSET,
    true,
  );
  /**
   * Extra field byte length.
   */
  const extraLength = view.getUint16(
    offset + CENTRAL_EXTRA_LENGTH_OFFSET,
    true,
  );
  /**
   * Comment byte length.
   */
  const commentLength = view.getUint16(
    offset + CENTRAL_COMMENT_LENGTH_OFFSET,
    true,
  );
  /**
   * Local file header offset.
   */
  const localHeaderOffset = view.getUint32(
    offset + CENTRAL_LOCAL_HEADER_OFFSET,
    true,
  );
  /**
   * Decoded filename.
   */
  const fileName = new TextDecoder('ascii',).decode(buffer.subarray(
    offset + CENTRAL_DIRECTORY_HEADER_LENGTH,
    offset + CENTRAL_DIRECTORY_HEADER_LENGTH
      + fileNameLength,
  ),);
  /**
   * Decompressed entry content.
   */
  const contentPromise = readEntryContent({
    buffer,
    view,
    fileName,
    compressionMethod,
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
  },);

  return {
    contentPromise,
    fileName,
    nextOffset: offset + CENTRAL_DIRECTORY_HEADER_LENGTH
      + fileNameLength
      + extraLength
      + commentLength,
  };
}

/**
 * Resolves parsed ZIP entry metadata into output pair.
 *
 * @param parsed - {@link ParsedZipEntry} metadata.
 *
 * @returns {@link ZipEntryPair} with decompressed content.
 *
 * @example
 * ```ts
 * await zipEntryPair({ parsed: { fileName: 'x', contentPromise: Promise.resolve(new Uint8Array()), nextOffset: 0 } });
 * ```
 */
async function zipEntryPair({ parsed, }: { readonly parsed: ParsedZipEntry; },): Promise<ZipEntryPair> {
  return [
    parsed.fileName,
    await parsed.contentPromise,
  ];
}

/**
 * Reads and decompresses one entry content.
 *
 * @param buffer - ZIP bytes.
 *
 * @param view - ZIP DataView.
 *
 * @param fileName - Entry filename.
 *
 * @param compressionMethod - Compression method.
 *
 * @param compressedSize - Compressed byte length.
 *
 * @param uncompressedSize - Uncompressed byte length.
 *
 * @param localHeaderOffset - Local header offset.
 *
 * @returns Decompressed entry content.
 *
 * @example
 * ```ts
 * readEntryContent({ buffer: new Uint8Array(), view: new DataView(new ArrayBuffer(0)), fileName: 'x', compressionMethod: 0, compressedSize: 0, uncompressedSize: 0, localHeaderOffset: 0 });
 * ```
 */
async function readEntryContent(
  {
    buffer,
    view,
    fileName,
    compressionMethod,
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
  }: {
    readonly buffer: Uint8Array;
    readonly compressedSize: number;
    readonly compressionMethod: number;
    readonly fileName: string;
    readonly localHeaderOffset: number;
    readonly uncompressedSize: number;
    readonly view: DataView;
  },
): Promise<Uint8Array> {
  if (view.getUint32(
    localHeaderOffset,
    true,
  ) !== LOCAL_FILE_SIGNATURE)
    throw new Error(`Invalid local file header at offset ${localHeaderOffset}`);

  /**
   * Entry compressed data offset.
   */
  const dataOffset = localHeaderOffset
    + LOCAL_HEADER_LENGTH
    + view.getUint16(
      localHeaderOffset + LOCAL_FILE_NAME_LENGTH_OFFSET,
      true,
    )
    + view.getUint16(
      localHeaderOffset + LOCAL_EXTRA_LENGTH_OFFSET,
      true,
    );
  /**
   * Compressed entry data.
   */
  const compressedData = buffer.subarray(
    dataOffset,
    dataOffset + compressedSize,
  );
  /**
   * Decompressed entry content.
   */
  const content = await decompressEntry({
    compressionMethod,
    compressedData,
    fileName,
  },);

  if (content.length !== uncompressedSize)
    throw new Error(`Size mismatch for "${fileName}": expected ${uncompressedSize}, got ${content.length}`);
  return content;
}

/**
 * Decompresses entry data for supported ZIP methods.
 *
 * @param compressionMethod - Compression method.
 *
 * @param compressedData - Compressed data.
 *
 * @param fileName - Entry filename.
 *
 * @returns Decompressed data.
 *
 * @example
 * ```ts
 * decompressEntry({ compressionMethod: 0, compressedData: new Uint8Array(), fileName: 'x' });
 * // Uint8Array []
 * ```
 */
async function decompressEntry(
  {
    compressionMethod,
    compressedData,
    fileName,
  }: {
    readonly compressedData: Uint8Array;
    readonly compressionMethod: number;
    readonly fileName: string;
  },
): Promise<Uint8Array> {
  if (compressionMethod === ZIP_METHOD_STORED)
    return new Uint8Array(compressedData,);
  if (compressionMethod === ZIP_METHOD_DEFLATE) {
    /**
     * Inflated entry data.
     */
    const inflatedEntry = await inflateRawAsync(Buffer.from(compressedData,),);
    return new Uint8Array(inflatedEntry,);
  }
  throw new Error(`Unsupported ZIP compression method ${compressionMethod} for "${fileName}"`);
}
