/**
 * Re-emit an existing AST `TOMLContentNode` as TOML text.
 *
 * Preserves style and raw spelling: `TOMLStringValue.style` and `multiline`,
 * `TOMLIntegerValue.number`, `TOMLFloatValue.number`, `TOMLDateTimeValue.datetime`.
 *
 * Used by splice and canonical emitters when the same AST node should be
 * round-tripped without going through JS-value coercion.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import type { AST, } from 'toml-eslint-parser';

import { TomlImmutableNodeError, } from './errors.ts';
import { encodeKey, } from './values.ts';
import type { CanonicalOptions, } from './types.ts';

/**
 * Emit `node` as TOML text per its parse-time fields.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitContentNode({ node: someTOMLValue, options: edit.canonical, },);
 * ```
 */
export function emitContentNode(
  {
    node,
    options,
    depth = 0,
  }: {
    node: AST.TOMLContentNode;
    options: CanonicalOptions;
    depth?: number;
  },
): string {
  if (node.type === 'TOMLValue')
    return emitValueLeaf({ node, },);
  if (node.type === 'TOMLArray')
    return emitArray({
      node,
      options,
      depth,
    },);
  return emitInlineTable({
    node,
    options,
    depth,
  },);
}

/**
 * Emit a primitive leaf (`string` / `integer` / `float` / `boolean` / date kinds).
 *
 * @returns Computed string.
 */
function emitValueLeaf({ node, }: { node: AST.TOMLValue; },): string {
  if (node.kind === 'string')
    return emitStringValue({ node, },);
  if ((node.kind === 'integer') || (node.kind === 'float'))
    return node.number;
  if (node.kind === 'boolean')
    return node.value ? 'true' : 'false';
  return node.datetime;
}

/**
 * Emit a `TOMLStringValue` per its style and `multiline` flag.
 *
 * @returns Computed string.
 */
function emitStringValue({ node, }: { node: AST.TOMLStringValue; },): string {
  if (node.style === 'literal') {
    if (node.multiline) return `'''${node.value}'''`;
    return `'${node.value}'`;
  }
  if (node.multiline)
    return `"""${escapeBasicMultiline({ value: node.value, },)}"""`;
  return `"${escapeBasic({ value: node.value, },)}"`;
}

/**
 * Escape a string for emission inside a basic single-line `"..."` literal.
 *
 * @returns Computed string.
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
 * @returns Computed string.
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

/**
 * Emit a `TOMLArray`, inline or multiline per `arrayInline*` options.
 *
 * @returns Computed string.
 */
function emitArray(
  {
    node,
    options,
    depth,
  }: {
    node: AST.TOMLArray;
    options: CanonicalOptions;
    depth: number;
  },
): string {
  const parts = node.elements.map(function each(el,) {
    return emitContentNode({
      node: el,
      options,
      depth: depth + 1,
    },);
  },);
  return assembleArrayParts({
    parts,
    options,
    depth,
  },);
}

/**
 * Emit a `TOMLArray` with the element at `skipIndex` omitted.
 *
 * Used by `tomlDelete` on an array element: re-emits the parent array
 * via canonical formatting, applying the same inline-vs-multiline
 * thresholds as `emitArray`.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitArrayWithoutIndex({ array: kvNode.value, skipIndex: 1, options, depth: 0, },);
 * ```
 */
export function emitArrayWithoutIndex(
  {
    array,
    skipIndex,
    options,
    depth,
  }: {
    array: AST.TOMLArray;
    skipIndex: number;
    options: CanonicalOptions;
    depth: number;
  },
): string {
  const parts = array.elements
    .filter(function notSkipped(
      _el,
      i,
    ) {
      return i !== skipIndex;
    },)
    .map(function each(el,) {
      return emitContentNode({
        node: el,
        options,
        depth: depth + 1,
      },);
    },);
  return assembleArrayParts({
    parts,
    options,
    depth,
  },);
}

/**
 * Emit a `TOMLArray` with one nested element omitted at arbitrary depth.
 *
 * `skipPath` is a chain of array indices read outer-to-inner: each
 * non-final index selects which element of the current `TOMLArray` to
 * recurse into (that element must itself be a `TOMLArray`); the final
 * index names the element to omit at the deepest level. A single-element
 * `skipPath` reduces to `emitArrayWithoutIndex`.
 *
 * Used by `tomlDelete` on a nested-array element: when the immediate
 * parent of the target is a `TOMLArray` whose own parent is another
 * `TOMLArray`, the deletion walks up the parent chain to the enclosing
 * key-value's outer array and re-emits the whole tree with the target
 * element missing.
 *
 * @returns Computed string.
 *
 * @throws TomlImmutableNodeError if a non-final `skipPath` index lands on
 *         a non-array element (caller-side AST inconsistency).
 *
 * @example
 * ```ts
 * emitArrayWithSkipPath({
 *   array: outerArrayNode,
 *   skipPath: [0, 1,],
 *   options: edit.canonical,
 *   depth: 0,
 * },);
 * ```
 */
export function emitArrayWithSkipPath(
  {
    array,
    skipPath,
    options,
    depth,
  }: {
    array: AST.TOMLArray;
    skipPath: readonly number[];
    options: CanonicalOptions;
    depth: number;
  },
): string {
  if (skipPath.length === 0)
    throw new TomlImmutableNodeError(
      'emitArrayWithSkipPath: skipPath must not be empty',
    );

  const head = nonNullishOrThrow(skipPath[0],);
  const rest = skipPath.slice(1,);

  if (rest.length === 0)
    return emitArrayWithoutIndex({
      array,
      skipIndex: head,
      options,
      depth,
    },);

  const parts = array.elements.map(function each(
    el,
    i,
  ) {
    if (i !== head)
      return emitContentNode({
        node: el,
        options,
        depth: depth + 1,
      },);
    if (el.type !== 'TOMLArray')
      throw new TomlImmutableNodeError(
        `emitArrayWithSkipPath: expected TOMLArray at index ${head}, got ${el.type}`,
      );
    return emitArrayWithSkipPath({
      array: el,
      skipPath: rest,
      options,
      depth: depth + 1,
    },);
  },);

  return assembleArrayParts({
    parts,
    options,
    depth,
  },);
}

/**
 * Shared array-text assembly used by `emitArray` and `emitArrayWithoutIndex`.
 *
 * @returns Computed string.
 */
function assembleArrayParts(
  {
    parts,
    options,
    depth,
  }: {
    parts: readonly string[];
    options: CanonicalOptions;
    depth: number;
  },
): string {
  const inlineCandidate = `[ ${parts.join(', ',)}${parts.length === 0 ? '' : ', '}]`;
  if (
    (parts.length <= options.arrayInlineThreshold)
    && (inlineCandidate.length <= options.arrayInlineMaxColumns)
  )
    return inlineCandidate;
  const indent = ' '.repeat(options.indent * (depth + 1),);
  const closingIndent = ' '.repeat(options.indent * depth,);
  return `[\n${parts.map(function withIndent(p,) {
    return `${indent}${p},`;
  },).join('\n',)}\n${closingIndent}]`;
}

/**
 * Emit a `TOMLInlineTable` as `{ k = v, ... }`.
 *
 * @returns Computed string.
 */
function emitInlineTable(
  {
    node,
    options,
    depth,
  }: {
    node: AST.TOMLInlineTable;
    options: CanonicalOptions;
    depth: number;
  },
): string {
  const parts = emitInlineTableBodyParts({
    body: node.body,
    options,
    depth,
  },);
  return assembleInlineTableParts({ parts, },);
}

/**
 * Emit a `TOMLInlineTable` with one additional key-value entry appended.
 *
 * `extraKey` is the encoded dotted-key string (may contain `.`); `extraValue`
 * is the encoded value text. The caller is responsible for ensuring the new
 * entry does not collide with existing inline-table keys.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * emitInlineTableWithExtra({
 *   node: inlineTable,
 *   options: canonical,
 *   depth: 0,
 *   extraKey: 'b',
 *   extraValue: '1',
 * },);
 * ```
 */
export function emitInlineTableWithExtra(
  {
    node,
    options,
    depth,
    extraKey,
    extraValue,
  }: {
    node: AST.TOMLInlineTable;
    options: CanonicalOptions;
    depth: number;
    extraKey: string;
    extraValue: string;
  },
): string {
  const parts = [
    ...emitInlineTableBodyParts({
      body: node.body,
      options,
      depth,
    },),
    `${extraKey} = ${extraValue}`,
  ];
  return assembleInlineTableParts({ parts, },);
}

/**
 * Render each `TOMLKeyValue` in an inline-table body as `key = value` text.
 *
 * @returns Computed result (`readonly string[]`).
 */
function emitInlineTableBodyParts(
  {
    body,
    options,
    depth,
  }: {
    body: readonly AST.TOMLKeyValue[];
    options: CanonicalOptions;
    depth: number;
  },
): readonly string[] {
  return body.map(function each(kv,) {
    const keyText = kv.key.keys
      .map(function each2(k,) {
        return encodeKey({ key: k.type === 'TOMLBare' ? k.name : k.value, },);
      },)
      .join('.',);
    const valueText = emitContentNode({
      node: kv.value,
      options,
      depth: depth + 1,
    },);
    return `${keyText} = ${valueText}`;
  },);
}

/**
 * Wrap the rendered parts in `{ ... }` with the canonical comma layout.
 *
 * @returns Computed string.
 */
function assembleInlineTableParts(
  {
    parts,
  }: {
    parts: readonly string[];
  },
): string {
  return `{ ${parts.join(', ',)}${parts.length === 0 ? '' : ', '}}`;
}
