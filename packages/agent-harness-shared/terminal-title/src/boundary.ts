/**
 * Safe terminal title payload construction.
 *
 * Terminal title payload text crosses into OSC control syntax in some hosts,
 * so this module sanitizes control characters before applying UTF-8 byte caps.
 *
 * @module
 */

import {
  C0_CONTROL_MAX_CODE_POINT,
  C1_CONTROL_MAX_CODE_POINT,
  C1_CONTROL_MIN_CODE_POINT,
  C1_CONTROL_REPLACEMENT,
  CONTROL_PICTURE_BASE_CODE_POINT,
  DELETE_CONTROL_CODE_POINT,
  DELETE_CONTROL_PICTURE,
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  TITLE_TRUNCATION_MARKER,
} from './constants.ts';

//region Encoder

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

//endregion Encoder

//region Byte helpers

/**
 * Measures UTF-8 bytes that would be emitted for terminal title text.
 *
 * @param value - because terminal limits are byte-counted
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
 * Truncates already-sanitized payload text to a UTF-8 byte budget.
 *
 * @param value - because only title payload text should be byte-capped
 *
 * @param maxBytes - because tests and terminals may use different budgets
 *
 * @returns payload prefix whose UTF-8 bytes fit within `maxBytes`
 *
 * @example
 * ```ts
 * truncateUtf8Payload({ value: 'a'.repeat(256), maxBytes: 255 });
 * ```
 */
function truncateUtf8Payload(
  {
    value,
    maxBytes,
  }: Readonly<{
    value: string;
    maxBytes: number;
  }>,
): string {
  if (maxBytes <= 0)
    return '';
  if (terminalTitleUtf8ByteLength(value,) <= maxBytes)
    return value;

  /**
   * Whether truncation marker fits inside the requested byte budget.
   */
  const markerFits = TITLE_TRUNCATION_MARKER_UTF8_BYTES <= maxBytes;
  /**
   * Content byte budget after reserving space for marker.
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
     * UTF-8 bytes required by current Unicode code point.
     */
    const chunkBytes = terminalTitleUtf8ByteLength(chunk,);
    /**
     * UTF-8 bytes after accepting current Unicode code point.
     */
    const nextBytes = prefixState.bytesUsed + chunkBytes;
    if (nextBytes > contentMaxBytes)
      break;
    prefixState.chunks
      .push(chunk,);
    prefixState.bytesUsed = nextBytes;
  }

  /**
   * Payload body that fits before optional marker.
   */
  const body = prefixState.chunks
    .join('',);
  if (markerFits)
    return `${body}${TITLE_TRUNCATION_MARKER}`;
  return body;
}

//endregion Byte helpers

//region Control sanitizing

/**
 * Converts a code point to visible terminal-title text.
 *
 * @param codePoint - because terminal controls must not cross the OSC payload seam
 *
 * @returns printable representation for control code points
 *
 * @example
 * ```ts
 * controlReplacement(0x001B);
 * // '␛'
 * ```
 */
function controlReplacement(codePoint: number,): string {
  if (codePoint <= C0_CONTROL_MAX_CODE_POINT) {
    return String.fromCodePoint(
      CONTROL_PICTURE_BASE_CODE_POINT + codePoint,
    );
  }
  if (codePoint === DELETE_CONTROL_CODE_POINT)
    return DELETE_CONTROL_PICTURE;
  return C1_CONTROL_REPLACEMENT;
}

/**
 * Checks whether a code point is unsafe in terminal title payload text.
 *
 * @param codePoint - because OSC payload text must not contain terminal controls
 *
 * @returns whether `codePoint` is C0, delete, or C1 control text
 *
 * @example
 * ```ts
 * isTerminalTitleControl(0x0007);
 * // true
 * ```
 */
function isTerminalTitleControl(codePoint: number,): boolean {
  if (codePoint <= C0_CONTROL_MAX_CODE_POINT)
    return true;
  if (codePoint === DELETE_CONTROL_CODE_POINT)
    return true;
  return (codePoint >= C1_CONTROL_MIN_CODE_POINT)
    && (codePoint <= C1_CONTROL_MAX_CODE_POINT);
}

/**
 * Replaces OSC-breaking controls with visible printable tokens.
 *
 * @param value - because tool names, paths, commands, and prompts can cross into OSC syntax
 *
 * @returns printable title text with controls made visible
 *
 * @example
 * ```ts
 * sanitizeTerminalTitleText('a\u001Bb');
 * // 'a␛b'
 * ```
 */
function sanitizeTerminalTitleText(value: string,): string {
  /**
   * Printable output chunks accumulated in source order.
   */
  const chunks: string[] = [];
  for (const chunk of value) {
    /**
     * Code point for current Unicode chunk.
     */
    const codePoint = chunk.codePointAt(0,);
    if (codePoint === undefined)
      throw new Error('terminal title sanitizer saw an empty string chunk',);
    chunks.push(
      isTerminalTitleControl(codePoint,)
        ? controlReplacement(codePoint,)
        : chunk,
    );
  }
  return chunks.join('',);
}

//endregion Control sanitizing

//region Public payload API

/**
 * Builds terminal-safe payload text by sanitizing controls and enforcing byte cap.
 *
 * @param value - because raw title text may contain OSC delimiters or exceed terminal byte budgets
 *
 * @param maxBytes - because tests and terminals may need alternate byte budgets
 *
 * @returns printable terminal title payload text within `maxBytes`
 *
 * @example
 * ```ts
 * safeTerminalTitlePayload({ value: 'hello\u0007'.repeat(100) });
 * ```
 */
function safeTerminalTitlePayload(
  {
    value,
    maxBytes = MAX_TERMINAL_TITLE_UTF8_BYTES,
  }: Readonly<{
    value: string;
    maxBytes?: number;
  }>,
): string {
  return truncateUtf8Payload({
    value: sanitizeTerminalTitleText(value,),
    maxBytes,
  },);
}

//endregion Public payload API

export {
  safeTerminalTitlePayload,
  sanitizeTerminalTitleText,
  terminalTitleUtf8ByteLength,
};
