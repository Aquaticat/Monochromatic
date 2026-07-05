/**
 * UTF-8 output-boundary helpers for terminal title payloads.
 *
 * Ghostty ignores title changes whose payload is 256 bytes or longer,
 * so terminal-title integrations cap title text before the OSC sequence is built.
 *
 * @module
 */

import { TITLE_TRUNCATION_MARKER, } from './constants.ts';

//region Constants

/**
 * Ghostty's current normal app title buffer size in UTF-8 bytes.
 * Title payloads at this byte length or larger are ignored by Ghostty.
 *
 * @example
 * ```ts
 * GHOSTTY_IGNORED_TITLE_UTF8_BYTES;
 * // 256
 * ```
 */
const GHOSTTY_IGNORED_TITLE_UTF8_BYTES: number = 256;

/**
 * Maximum UTF-8 byte length for terminal title payload text sent by this repo.
 * Kept below Ghostty's reject threshold so title updates do not go stale.
 *
 * @example
 * ```ts
 * MAX_TERMINAL_TITLE_UTF8_BYTES;
 * // 255
 * ```
 */
const MAX_TERMINAL_TITLE_UTF8_BYTES: number = GHOSTTY_IGNORED_TITLE_UTF8_BYTES - 1;

/**
 * Encoder used to measure JavaScript strings as emitted UTF-8 bytes.
 */
const TERMINAL_TITLE_TEXT_ENCODER: TextEncoder = new TextEncoder();

/**
 * UTF-8 byte length of {@link TITLE_TRUNCATION_MARKER}.
 */
const TITLE_TRUNCATION_MARKER_UTF8_BYTES: number = TERMINAL_TITLE_TEXT_ENCODER
  .encode(TITLE_TRUNCATION_MARKER,)
  .byteLength;

//endregion Constants

//region Byte helpers

/**
 * Measures UTF-8 bytes that would be emitted for terminal title text.
 *
 * @param value - because Ghostty applies byte-counted title limits
 *
 * @returns UTF-8 byte count for `value`
 *
 * @example
 * ```ts
 * terminalTitleUtf8ByteLength('π title');
 * // 8
 * ```
 */
function terminalTitleUtf8ByteLength(value: string,): number {
  return TERMINAL_TITLE_TEXT_ENCODER
    .encode(value,)
    .byteLength;
}

/**
 * Truncates terminal title payload text to a UTF-8 byte budget.
 * Iterates by Unicode code point so truncation never splits surrogate pairs.
 * The ellipsis is appended only when it fits inside the same byte budget.
 *
 * @param value - because only title payload text should be byte-capped,
 * not surrounding OSC escape bytes
 *
 * @param maxBytes - because different terminals or tests may need narrower budgets
 *
 * @returns title payload text whose UTF-8 encoding fits within `maxBytes`
 *
 * @example
 * ```ts
 * truncateTerminalTitlePayload({ value: 'a'.repeat(256) });
 * // 'aaaa...…' within MAX_TERMINAL_TITLE_UTF8_BYTES
 * ```
 */
function truncateTerminalTitlePayload(
  {
    value,
    maxBytes = MAX_TERMINAL_TITLE_UTF8_BYTES,
  }: Readonly<{
    value: string;
    maxBytes?: number;
  }>,
): string {
  if (maxBytes <= 0)
    return '';
  if (terminalTitleUtf8ByteLength(value,) <= maxBytes)
    return value;

  /**
   * Whether the ellipsis can be included without exceeding the byte budget.
   */
  const markerFits = TITLE_TRUNCATION_MARKER_UTF8_BYTES <= maxBytes;
  /**
   * Bytes available for title content before the optional ellipsis marker.
   */
  const contentMaxBytes = markerFits
    ? maxBytes - TITLE_TRUNCATION_MARKER_UTF8_BYTES
    : maxBytes;
  /**
   * Mutable prefix collection state kept inside one binding for lint-safe accumulation.
   */
  const prefixState: {
    bytesUsed: number;
    chunks: string[];
  } = {
    bytesUsed: 0,
    chunks: [],
  };

  for (const chunk of value) {
    /**
     * UTF-8 bytes needed by this Unicode code point.
     */
    const chunkBytes = terminalTitleUtf8ByteLength(chunk,);
    /**
     * UTF-8 bytes after accepting this Unicode code point.
     */
    const nextBytes = prefixState.bytesUsed + chunkBytes;
    if (nextBytes > contentMaxBytes)
      break;
    prefixState.chunks.push(chunk,);
    prefixState.bytesUsed = nextBytes;
  }

  /**
   * Truncated payload body before appending an optional ellipsis.
   */
  const body = prefixState.chunks.join('',);
  if (markerFits)
    return `${body}${TITLE_TRUNCATION_MARKER}`;
  return body;
}

//endregion Byte helpers

export {
  GHOSTTY_IGNORED_TITLE_UTF8_BYTES,
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  terminalTitleUtf8ByteLength,
  truncateTerminalTitlePayload,
};
