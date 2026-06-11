/**
 * String leaf emission helpers for parsed TOML values.
 *
 * Basic-string emission must escape for the TOML grammar at the destination:
 * backslash, double quote, the named control escapes, and every other control
 * scalar (below U+0020, plus U+007F) as a `\uXXXX` sequence. Emitting such a
 * control scalar raw produces invalid TOML that the parser rejects, so the
 * escaper here is exhaustive rather than handling only the common cases.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

//region Escape tables

/**
 * Named single-character basic-string escapes keyed by codepoint.
 */
const NAMED_BASIC_ESCAPES: Record<number, string> = {
  0x08: '\\b',
  0x09: '\\t',
  0x0A: '\\n',
  0x0C: '\\f',
  0x0D: '\\r',
};

/**
 * Backslash codepoint, escaped first in every basic string.
 */
const BACKSLASH_CODEPOINT = 0x5C;

/**
 * Double-quote codepoint, escaped in single-line basic strings.
 */
const DQUOTE_CODEPOINT = 0x22;

/**
 * Highest control codepoint requiring escaping at the low end.
 */
const LOW_CONTROL_MAX = 0x1F;

/**
 * Delete control codepoint (U+007F), which the parser rejects raw.
 */
const DELETE_CODEPOINT = 0x7F;

/**
 * Hexadecimal radix for `\uXXXX` escape formatting.
 */
const HEX_RADIX = 16;

/**
 * Hex-digit width of a short `\uXXXX` escape.
 */
const SHORT_UNICODE_WIDTH = 4;

//endregion Escape tables

//region String emission

/**
 * Emit a `TOMLStringValue` per its style and `multiline` flag.
 *
 * @param node - Parsed TOML string value.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitStringValue({ node: tomlStringNode, },);
 * ```
 */
export function emitStringValue({ node, }: { readonly node: AST.TOMLStringValue; },): string {
  if (node.style
    === 'literal') {
    if (node.multiline)
      return `'''${node.value}'''`;
    return `'${node.value}'`;
  }
  if (node.multiline)
    return `"""${escapeBasicMultiline({ value: node.value, },)}"""`;
  return `"${escapeBasic({ value: node.value, },)}"`;
}

/**
 * Emit one control codepoint as its `\uXXXX` escape.
 *
 * @returns Six-character escape such as ` `.
 */
function unicodeEscape({ codepoint, }: { readonly codepoint: number; },): string {
  return `\\u${codepoint.toString(HEX_RADIX,)
    .toUpperCase()
    .padStart(
      SHORT_UNICODE_WIDTH,
      '0',
    )}`;
}

/**
 * Escape one scalar for a basic string.
 *
 * @returns Escaped fragment, possibly the scalar itself.
 */
function escapeBasicScalar(
  {
    scalar,
    multiline,
  }: {
    readonly scalar: string;
    readonly multiline: boolean;
  },
): string {
  /**
   * Codepoint of the scalar; astral characters arrive whole and pass through.
   */
  const codepoint = scalar.codePointAt(0,) ?? 0;
  if (codepoint
    === BACKSLASH_CODEPOINT) return String.raw`\\`;
  // A single-line literal escapes every quote; a multiline literal leaves bare
  // quotes raw (a run of `"""` is escaped afterward). Control characters,
  // including newlines, are always escaped: a raw leading newline would be
  // trimmed by TOML and a lone carriage return is invalid, so neither is left raw.
  if ((!multiline) && (codepoint
    === DQUOTE_CODEPOINT)) return String.raw`\"`;
  /**
   * Named escape for this codepoint, if one applies.
   */
  const named = NAMED_BASIC_ESCAPES[codepoint];
  if (named !== undefined) return named;
  if ((codepoint
    <= LOW_CONTROL_MAX) || (codepoint
    === DELETE_CODEPOINT)) {
    return unicodeEscape({ codepoint, },);
  }
  return scalar;
}

/**
 * Escape a string for emission inside a basic single-line `"..."` literal.
 *
 * @param value - Raw string value.
 *
 * @returns Escaped string content.
 *
 * @example
 * ```ts
 * escapeBasic({ value: 'a\nb', },);
 * ```
 */
function escapeBasic({ value, }: { readonly value: string; },): string {
  return Array.from(
    value,
    function each(scalar,) {
    return escapeBasicScalar({
      scalar,
      multiline: false,
    },);
  },
  )
    .join('',);
}

/**
 * Escape a string for emission inside a `"""..."""` multiline basic literal.
 *
 * Bare quotes stay raw, but a literal `"""` run is escaped so it cannot close
 * the literal. Every control scalar, including newlines, is escaped: a raw
 * leading newline would be trimmed by TOML and a lone carriage return is invalid.
 *
 * @param value - Raw string value.
 *
 * @returns Escaped string content.
 *
 * @example
 * ```ts
 * escapeBasicMultiline({ value: 'a"""b', },);
 * ```
 */
function escapeBasicMultiline({ value, }: { readonly value: string; },): string {
  return Array.from(
    value,
    function each(scalar,) {
    return escapeBasicScalar({
      scalar,
      multiline: true,
    },);
  },
  )
    .join('',)
    .replaceAll(
      '"""',
      String.raw`\"\"\"`,
    );
}

//endregion String emission
