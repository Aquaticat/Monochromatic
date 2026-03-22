/**
 * Hex dump generator for binary file display.
 *
 * Produces output in the classic `xxd`/`hexdump -C` format:
 * offset, hex bytes grouped by 8, ASCII representation.
 */

import { $ as notNullishOrThrow, } from '@monochromatic-dev/module-es/not-nullish-or-throw';

/** Hexadecimal radix for `toString` and `padStart`. */
const HEX_RADIX = 16;

/** Width of the offset column in hex characters. */
const OFFSET_WIDTH = HEX_RADIX / 2;

/** Number of bytes displayed per hex dump line. */
const BYTES_PER_LINE = HEX_RADIX;

/** Group boundary for inserting an extra space between hex columns. */
const GROUP_BOUNDARY = OFFSET_WIDTH;

/** Multiplier to derive max dump size from bytes per line. */
const DUMP_LINE_COUNT = 1_024;

/** Maximum bytes to include in the dump before truncating. */
const MAX_DUMP_BYTES = BYTES_PER_LINE * DUMP_LINE_COUNT;

/** First printable ASCII code point (space). */
const ASCII_PRINTABLE_START = 0x20;

/** Last printable ASCII code point (tilde). */
const ASCII_PRINTABLE_END = 0x7E;

/**
 * Generates a hex dump string from a binary buffer.
 * Output is truncated to {@link MAX_DUMP_BYTES} with a summary footer.
 *
 * @param buffer - raw file contents
 *
 * @returns formatted hex dump string
 *
 * @example
 * ```ts
 * const dump = generateHexDump({ buffer: Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]) });
 * // "00000000  48 65 6c 6c 6f                                    |Hello|"
 * ```
 */
export function generateHexDump({ buffer, }: { buffer: Buffer }): string {
  const limit = Math.min(buffer.length, MAX_DUMP_BYTES,);
  const lines: string[] = [];

  for (let offset = 0; offset < limit; offset += BYTES_PER_LINE) {
    const offsetHex = offset.toString(HEX_RADIX,).padStart(OFFSET_WIDTH, '0',);
    const end = Math.min(offset + BYTES_PER_LINE, limit,);
    const chunk = buffer.subarray(offset, end,);

    const hexParts: string[] = [];
    let ascii = '';

    for (let i = 0; i < BYTES_PER_LINE; i++) {
      if (i === GROUP_BOUNDARY) hexParts.push('',);
      if (i < chunk.length) {
        const byte = notNullishOrThrow(chunk[i],);
        hexParts.push(byte.toString(HEX_RADIX,).padStart(2, '0',),);
        ascii += (byte >= ASCII_PRINTABLE_START && byte <= ASCII_PRINTABLE_END)
          ? String.fromCodePoint(byte,)
          : '.';
      }
      else {
        hexParts.push('  ',);
      }
    }

    lines.push(`${offsetHex}  ${hexParts.join(' ',)}  |${ascii}|`,);
  }

  if (buffer.length > MAX_DUMP_BYTES) {
    lines.push('',);
    lines.push(`... truncated (showing ${MAX_DUMP_BYTES.toLocaleString()} of ${buffer.length.toLocaleString()} bytes)`,);
  }

  return lines.join('\n',);
}
