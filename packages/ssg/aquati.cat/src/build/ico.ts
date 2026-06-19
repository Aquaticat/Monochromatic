/**
 * ICO binary container encoding.
 *
 * Wraps a single PNG image in the ICO format for use as a browser favicon.
 */

//region ICO binary format constants
/**
 * ICO file header size in bytes (reserved + type + image count fields).
 */
const ICO_HEADER_SIZE = 6;

/**
 * ICO directory entry size in bytes per the ICO specification.
 */
const ICO_ENTRY_SIZE = 16;

/**
 * ICO favicon dimensions in pixels (width and height).
 */
const ICO_DIMENSION = 32;

/**
 * Bits per pixel for RGBA color depth in ICO directory entries.
 */
const ICO_BITS_PER_PIXEL = 32;

/**
 * Byte offset of image count within the ICO header.
 */
const ICO_HEADER_COUNT_OFFSET = 4;

/**
 * Byte offset of color planes within an ICO directory entry.
 */
const ICO_ENTRY_PLANES_OFFSET = 4;

/**
 * Byte offset of bits-per-pixel within an ICO directory entry.
 */
const ICO_ENTRY_BPP_OFFSET = 6;

/**
 * Byte offset of image data size within an ICO directory entry.
 */
const ICO_ENTRY_DATASIZE_OFFSET = 8;

/**
 * Byte offset of data pointer within an ICO directory entry.
 */
const ICO_ENTRY_DATAPTR_OFFSET = 12;

/**
 * Absolute byte offset where image data begins (header + one directory entry).
 */
const ICO_DATA_OFFSET = 22;
//endregion

/**
 * Creates an ICO container wrapping a single 32x32 PNG image.
 *
 * @param pngData - PNG buffer to embed in the ICO container
 *
 * @returns ICO file buffer
 *
 * @example
 * ```ts
 * const ico = createIco({ pngData: png32Buffer });
 * ```
 */
export function createIco({ pngData, }: { readonly pngData: Uint8Array; },): Buffer {
  /**
   * ICONDIR header preceding the image directory entries per the ICO spec.
   */
  const header = Buffer.alloc(ICO_HEADER_SIZE,);
  header.writeUInt16LE(
    1,
    2,
  ); // type: 1 = ICO
  header.writeUInt16LE(
    1,
    ICO_HEADER_COUNT_OFFSET,
  ); // image count

  /**
   * ICONDIRENTRY describing the single embedded PNG image.
   */
  const entry = Buffer.alloc(ICO_ENTRY_SIZE,);
  entry.writeUInt8(
    ICO_DIMENSION,
    0,
  ); // width
  entry.writeUInt8(
    ICO_DIMENSION,
    1,
  ); // height
  entry.writeUInt16LE(
    1,
    ICO_ENTRY_PLANES_OFFSET,
  ); // color planes
  entry.writeUInt16LE(
    ICO_BITS_PER_PIXEL,
    ICO_ENTRY_BPP_OFFSET,
  ); // bits per pixel
  entry.writeUInt32LE(
    pngData.length,
    ICO_ENTRY_DATASIZE_OFFSET,
  ); // image data size
  entry.writeUInt32LE(
    ICO_DATA_OFFSET,
    ICO_ENTRY_DATAPTR_OFFSET,
  ); // data offset

  return Buffer.concat([
    header,
    entry,
    pngData,
  ],);
}
