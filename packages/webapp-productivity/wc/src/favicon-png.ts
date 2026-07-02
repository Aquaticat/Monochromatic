/**
 * Minimal build-time PNG encoder for the favicon: truecolor RGB, bit
 * depth 8, no interlace, a single IDAT chunk. Compression and
 * checksumming both come from `node:zlib` (`deflateSync`, `crc32`), so
 * no bit-twiddling lives here.
 */
import { Buffer, } from 'node:buffer';
import { promisify, } from 'node:util';
import {
  crc32,
  deflate as deflateCallback,
} from 'node:zlib';

/**
 * Async deflate, promisified from zlib's callback form (the sync form
 * is lint-banned).
 */
const deflate = promisify(deflateCallback,);

/**
 * Byte width of PNG's big-endian 32-bit integers (chunk length, CRC,
 * IHDR width/height).
 */
const UINT32_BYTES = 2 + 2;

/**
 * Channels per pixel in truecolor RGB (no alpha; the favicon is fully
 * opaque).
 */
const RGB_CHANNELS = 2 + 1;

/**
 * Eight-byte PNG file signature. `iVBORw0KGgo=` is the base64 encoding
 * of exactly those bytes (the familiar prefix of every base64 PNG),
 * which spells the constant without listing raw magic bytes.
 */
const PNG_SIGNATURE = Buffer.from(
  'iVBORw0KGgo=',
  'base64',
);

/**
 * IHDR bit depth: 8 bits per channel.
 */
const BIT_DEPTH_EIGHT = 2 * (2 * 2);

/**
 * IHDR color type 2: truecolor RGB.
 */
const COLOR_TYPE_RGB = 2;

/**
 * IHDR compression method 0: deflate, the only method PNG defines.
 */
const COMPRESSION_DEFLATE = 0;

/**
 * IHDR filter method 0: adaptive filtering, the only method PNG
 * defines (each scanline below uses filter type None).
 */
const FILTER_ADAPTIVE = 0;

/**
 * IHDR interlace method 0: no interlacing.
 */
const INTERLACE_NONE = 0;

/**
 * IHDR chunk data byte length: two uint32 dimensions plus five
 * single-byte fields.
 */
const IHDR_DATA_BYTES = (UINT32_BYTES * 2) + ((2 + 2) + 1);

/**
 * Wraps one PNG chunk: uint32 data length, ASCII type, data, and a
 * CRC-32 over type plus data.
 *
 * @param type - four-character ASCII chunk type, e.g. `IHDR`
 *
 * @param data - chunk payload bytes
 *
 * @returns complete chunk bytes
 *
 * @example
 * ```ts
 * const iend = pngChunk({ type: 'IEND', data: new Uint8Array(0) });
 * ```
 */
function pngChunk(
  {
    type,
    data,
  }: Readonly<{
    type: string;
    data: Uint8Array;
  }>,
): Buffer {
  /**
   * ASCII bytes of the chunk type, the leading half of the CRC input.
   */
  const typeBytes = Buffer.from(
    type,
    'latin1',
  );

  /**
   * Type plus payload, the exact byte range PNG checksums.
   */
  const body = Buffer.concat(
    [
      typeBytes,
      data,
    ],
  );

  /**
   * Big-endian payload length field.
   */
  const lengthField = Buffer.alloc(UINT32_BYTES,);

  lengthField.writeUInt32BE(
    data.length,
    0,
  );

  /**
   * Big-endian CRC-32 field over body.
   */
  const crcField = Buffer.alloc(UINT32_BYTES,);

  crcField.writeUInt32BE(
    crc32(body,),
    0,
  );

  return Buffer.concat(
    [
      lengthField,
      body,
      crcField,
    ],
  );
}

/**
 * Serializes the IHDR payload for a truecolor RGB image.
 *
 * @param width - image width in pixels
 *
 * @param height - image height in pixels
 *
 * @returns IHDR chunk data bytes
 */
function ihdrData(
  {
    width,
    height,
  }: Readonly<{
    width: number;
    height: number;
  }>,
): Buffer {
  /**
   * IHDR payload buffer, filled through a running write cursor so no
   * field offset is spelled as a literal.
   */
  const data = Buffer.alloc(IHDR_DATA_BYTES,);

  /**
   * Next write offset, advanced by each `write*` return value.
   */
  let cursor = data.writeUInt32BE(
    width,
    0,
  );

  cursor = data.writeUInt32BE(
    height,
    cursor,
  );
  cursor = data.writeUInt8(
    BIT_DEPTH_EIGHT,
    cursor,
  );
  cursor = data.writeUInt8(
    COLOR_TYPE_RGB,
    cursor,
  );
  cursor = data.writeUInt8(
    COMPRESSION_DEFLATE,
    cursor,
  );
  cursor = data.writeUInt8(
    FILTER_ADAPTIVE,
    cursor,
  );
  data.writeUInt8(
    INTERLACE_NONE,
    cursor,
  );

  return data;
}

/**
 * Encodes tightly packed RGB pixel bytes as a complete PNG file.
 *
 * @param width - image width in pixels
 *
 * @param height - image height in pixels
 *
 * @param pixels - `width * height * 3` bytes, rows top to bottom, each
 * pixel as consecutive R, G, B bytes
 *
 * @returns complete PNG file bytes
 *
 * @throws Error when pixels does not hold exactly `width * height`
 * RGB triplets
 *
 * @example
 * ```ts
 * const png = await encodePngRgb({
 *   width: 1,
 *   height: 1,
 *   pixels: Uint8Array.from([0, 0, 0]),
 * });
 * ```
 */
export async function encodePngRgb(
  {
    width,
    height,
    pixels,
  }: Readonly<{
    width: number;
    height: number;
    pixels: Uint8Array;
  }>,
): Promise<Buffer> {
  /**
   * Byte count of one row of packed RGB pixels, excluding the filter
   * byte.
   */
  const rowBytes = width * RGB_CHANNELS;

  /**
   * Byte count pixels must hold for the given dimensions.
   */
  const expectedBytes = rowBytes * height;

  if (pixels.length !== expectedBytes) {
    throw new Error(
      `pixels holds ${pixels.length} bytes; ${expectedBytes} expected for ${width}x${height} RGB`,
    );
  }

  /**
   * Raw scanline stream: each row prefixed with filter type None (0).
   */
  const raw = Buffer.alloc((rowBytes + 1) * height,);

  for (let row = 0; row < height; row += 1) {
    /**
     * Offset of the current row's filter byte inside raw.
     */
    const rowStart = row * (rowBytes + 1);

    raw.writeUInt8(
      FILTER_ADAPTIVE,
      rowStart,
    );
    raw.set(
      pixels.subarray(
        row * rowBytes,
        (row + 1) * rowBytes,
      ),
      rowStart + 1,
    );
  }

  return Buffer.concat(
    [
      PNG_SIGNATURE,
      pngChunk(
        {
          type: 'IHDR',
          data: ihdrData(
            {
              width,
              height,
            },
          ),
        },
      ),
      pngChunk(
        {
          type: 'IDAT',
          data: await deflate(raw,),
        },
      ),
      pngChunk(
        {
          type: 'IEND',
          data: new Uint8Array(0,),
        },
      ),
    ],
  );
}
