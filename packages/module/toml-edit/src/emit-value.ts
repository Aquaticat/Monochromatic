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

import type { AST, } from 'toml-eslint-parser';

import { encodeKey, } from './values.ts';
import type { CanonicalOptions, } from './types.ts';

/**
 * Emit `node` as TOML text per its parse-time fields.
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
    return emitArray({ node, options, depth, },);
  return emitInlineTable({ node, options, depth, },);
}

/** Emit a primitive leaf (`string` / `integer` / `float` / `boolean` / date kinds). */
function emitValueLeaf({ node, }: { node: AST.TOMLValue; },): string {
  if (node.kind === 'string')
    return emitStringValue({ node, },);
  if (node.kind === 'integer' || node.kind === 'float')
    return node.number;
  if (node.kind === 'boolean')
    return node.value ? 'true' : 'false';
  return node.datetime;
}

/** Emit a `TOMLStringValue` per its style and `multiline` flag. */
function emitStringValue({ node, }: { node: AST.TOMLStringValue; },): string {
  if (node.style === 'literal') {
    if (node.multiline) return `'''${node.value}'''`;
    return `'${node.value}'`;
  }
  if (node.multiline)
    return `"""${escapeBasicMultiline({ value: node.value, },)}"""`;
  return `"${escapeBasic({ value: node.value, },)}"`;
}

/** Escape a string for emission inside a basic single-line `"..."` literal. */
function escapeBasic({ value, }: { value: string; },): string {
  return value
    .replaceAll('\\', '\\\\',)
    .replaceAll('"', '\\"',)
    .replaceAll('\b', '\\b',)
    .replaceAll('\f', '\\f',)
    .replaceAll('\n', '\\n',)
    .replaceAll('\r', '\\r',)
    .replaceAll('\t', '\\t',);
}

/** Escape a string for emission inside a `"""..."""` multiline basic literal. */
function escapeBasicMultiline({ value, }: { value: string; },): string {
  return value
    .replaceAll('\\', '\\\\',)
    .replaceAll('"""', '\\"\\"\\"',);
}

/** Emit a `TOMLArray`, inline or multiline per `arrayInline*` options. */
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
    return emitContentNode({ node: el, options, depth: depth + 1, },);
  },);
  return assembleArrayParts({ parts, options, depth, },);
}

/**
 * Emit a `TOMLArray` with the element at `skipIndex` omitted.
 *
 * Used by `tomlDelete` on an array element: re-emits the parent array
 * via canonical formatting, applying the same inline-vs-multiline
 * thresholds as `emitArray`.
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
    .filter(function notSkipped(_el, i,) {
      return i !== skipIndex;
    },)
    .map(function each(el,) {
      return emitContentNode({ node: el, options, depth: depth + 1, },);
    },);
  return assembleArrayParts({ parts, options, depth, },);
}

/** Shared array-text assembly used by `emitArray` and `emitArrayWithoutIndex`. */
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
    parts.length <= options.arrayInlineThreshold
    && inlineCandidate.length <= options.arrayInlineMaxColumns
  )
    return inlineCandidate;
  const indent = ' '.repeat(options.indent * (depth + 1),);
  const closingIndent = ' '.repeat(options.indent * depth,);
  return `[\n${parts.map(function withIndent(p,) {
    return `${indent}${p},`;
  },).join('\n',)}\n${closingIndent}]`;
}

/** Emit a `TOMLInlineTable` as `{ k = v, ... }`. */
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
  const parts = emitInlineTableBodyParts({ body: node.body, options, depth, },);
  return assembleInlineTableParts({ parts, },);
}

/**
 * Emit a `TOMLInlineTable` with one additional key-value entry appended.
 *
 * `extraKey` is the encoded dotted-key string (may contain `.`); `extraValue`
 * is the encoded value text. The caller is responsible for ensuring the new
 * entry does not collide with existing inline-table keys.
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
    ...emitInlineTableBodyParts({ body: node.body, options, depth, },),
    `${extraKey} = ${extraValue}`,
  ];
  return assembleInlineTableParts({ parts, },);
}

/** Render each `TOMLKeyValue` in an inline-table body as `key = value` text. */
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
    const valueText = emitContentNode({ node: kv.value, options, depth: depth + 1, },);
    return `${keyText} = ${valueText}`;
  },);
}

/** Wrap the rendered parts in `{ ... }` with the canonical comma layout. */
function assembleInlineTableParts(
  {
    parts,
  }: {
    parts: readonly string[];
  },
): string {
  return `{ ${parts.join(', ',)}${parts.length === 0 ? '' : ', '}}`;
}
