/**
 * String leaf emission helpers for parsed TOML values.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

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
export function emitStringValue({ node, }: { node: AST.TOMLStringValue; },): string {
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
function escapeBasic({ value, }: { value: string; },): string {
  return value
    .replaceAll(
      '\\',
      String.raw`\\`,
    )
    .replaceAll(
      '"',
      String.raw`\"`,
    )
    .replaceAll(
      '\b',
      String.raw`\b`,
    )
    .replaceAll(
      '\f',
      String.raw`\f`,
    )
    .replaceAll(
      '\n',
      String.raw`\n`,
    )
    .replaceAll(
      '\r',
      String.raw`\r`,
    )
    .replaceAll(
      '\t',
      String.raw`\t`,
    );
}

/**
 * Escape a string for emission inside a `"""..."""` multiline basic literal.
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
function escapeBasicMultiline({ value, }: { value: string; },): string {
  return value
    .replaceAll(
      '\\',
      String.raw`\\`,
    )
    .replaceAll(
      '"""',
      String.raw`\"\"\"`,
    );
}

//endregion String emission
