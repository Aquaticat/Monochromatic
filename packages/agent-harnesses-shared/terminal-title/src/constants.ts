/**
 * Shared constants for terminal title rendering.
 *
 * @module
 */

//region Truncation constants

/**
 * Marker appended when title payload text exceeds its byte budget.
 *
 * @example
 * ```ts
 * TITLE_TRUNCATION_MARKER;
 * // '…'
 * ```
 */
const TITLE_TRUNCATION_MARKER: string = '…';

/**
 * Ghostty's current normal app title buffer size in UTF-8 bytes.
 * Payloads at this byte length or larger are ignored by Ghostty.
 *
 * @example
 * ```ts
 * GHOSTTY_IGNORED_TITLE_UTF8_BYTES;
 * // 256
 * ```
 */
const GHOSTTY_IGNORED_TITLE_UTF8_BYTES: number = 256;

/**
 * Maximum UTF-8 byte length for terminal title payload text emitted by this repo.
 *
 * @example
 * ```ts
 * MAX_TERMINAL_TITLE_UTF8_BYTES;
 * // 255
 * ```
 */
const MAX_TERMINAL_TITLE_UTF8_BYTES: number = GHOSTTY_IGNORED_TITLE_UTF8_BYTES - 1;

//endregion Truncation constants

//region Control picture constants

/**
 * First Unicode control-picture code point, corresponding to U+0000.
 */
const CONTROL_PICTURE_BASE_CODE_POINT: number = 0x24_00;

/**
 * ASCII control range end, inclusive.
 */
const C0_CONTROL_MAX_CODE_POINT: number = 0x00_1F;

/**
 * ASCII delete code point.
 */
const DELETE_CONTROL_CODE_POINT: number = 0x00_7F;

/**
 * Unicode control picture for ASCII delete.
 */
const DELETE_CONTROL_PICTURE: string = '␡';

/**
 * C1 control range start, inclusive.
 */
const C1_CONTROL_MIN_CODE_POINT: number = 0x00_80;

/**
 * C1 control range end, inclusive.
 */
const C1_CONTROL_MAX_CODE_POINT: number = 0x00_9F;

/**
 * Replacement used for C1 controls, which do not have Unicode control pictures.
 */
const C1_CONTROL_REPLACEMENT: string = '�';

//endregion Control picture constants

export {
  C0_CONTROL_MAX_CODE_POINT,
  C1_CONTROL_MAX_CODE_POINT,
  C1_CONTROL_MIN_CODE_POINT,
  C1_CONTROL_REPLACEMENT,
  CONTROL_PICTURE_BASE_CODE_POINT,
  DELETE_CONTROL_CODE_POINT,
  DELETE_CONTROL_PICTURE,
  GHOSTTY_IGNORED_TITLE_UTF8_BYTES,
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  TITLE_TRUNCATION_MARKER,
};
