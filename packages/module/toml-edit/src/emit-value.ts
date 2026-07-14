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

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { AST, } from 'toml-eslint-parser';

import { emitStringValue, } from './emit-value-string.ts';
import { TomlImmutableNodeError, } from './errors.ts';
import { encodeKey, } from './keys.ts';
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
    readonly node: ForeignBorrowed<AST.TOMLNode>;
    readonly options: CanonicalOptions;
    readonly depth?: number;
  },
): string {
  if (node.type
    === 'TOMLValue')
    return emitValueLeaf({ node, },);
  if (node.type
    === 'TOMLArray') {
    return emitArray({
      node,
      options,
      depth,
    },);
  }
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
function emitValueLeaf({ node, }: { readonly node: AST.TOMLValue; },): string {
  if (node.kind
    === 'string')
    return emitStringValue({ node, },);
  if ((node.kind
    === 'integer') || (node.kind
      === 'float'))
    return node.number;
  if (node.kind
    === 'boolean')
    return node.value ? 'true' : 'false';
  return node.datetime;
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
    readonly node: AST.TOMLArray;
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): string {
  /**
   * Per-element text so the assembler can join into inline or multi-line form.
   */
  const parts = node.elements
    .map(function each(el: AST.TOMLNode,) {
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
 * Used by {@link tomlDelete} on an array element: re-emits the parent array
 * via canonical formatting, applying the same inline-vs-multiline
 * thresholds as {@link emitArray}.
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
    readonly array: ForeignBorrowed<AST.TOMLArray>;
    readonly skipIndex: number;
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): string {
  /**
   * Per-element text with the targeted index dropped before encoding.
   */
  const parts = array
    .elements
    .flatMap(function each(
      el: AST.TOMLNode,
      index,
    ) {
      if (index === skipIndex)
        return [];
      return [emitContentNode({
        node: el,
        options,
        depth: depth + 1,
      },),];
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
 * `skipPath` reduces to {@link emitArrayWithoutIndex}.
 *
 * Used by {@link tomlDelete} on a nested-array element: when the immediate
 * parent of the target is a `TOMLArray` whose own parent is another
 * `TOMLArray`, the deletion walks up the parent chain to the enclosing
 * key-value's outer array and re-emits the whole tree with the target
 * element missing.
 *
 * @returns Computed string.
 *
 * @throws {@link TomlImmutableNodeError} if a non-final `skipPath` index lands on
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
    readonly array: AST.TOMLArray;
    readonly skipPath: readonly number[];
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): string {
  if (skipPath.length
    === 0) {
    throw new TomlImmutableNodeError(
      'emitArrayWithSkipPath: skipPath must not be empty',
    );
  }

  /**
   * Current outer index; selects which child array to recurse into.
   */
  const head = nonNullishOrThrow(skipPath[0],);
  /**
   * Remaining inner-level indices.
   */
  const rest = skipPath.slice(1,);

  if (rest.length
    === 0) {
    return emitArrayWithoutIndex({
      array,
      skipIndex: head,
      options,
      depth,
    },);
  }

  /**
   * Per-element text where the matching child gets a recursive skip-path emit.
   */
  const parts = array.elements
    .map(function each(
    el: AST.TOMLNode,
    i,
  ) {
    if (i !== head) {
      return emitContentNode({
        node: el,
        options,
        depth: depth + 1,
      },);
    }
    if (el.type
      !== 'TOMLArray') {
      throw new TomlImmutableNodeError(
        `emitArrayWithSkipPath: expected TOMLArray at index ${head}, got ${el.type}`,
      );
    }
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
 * Shared array-text assembly used by {@link emitArray} and {@link emitArrayWithoutIndex}.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * assembleArrayParts({ parts: ['1', '2'], options, depth: 0, },); // '[ 1, 2, ]'
 * ```
 */
export function assembleArrayParts(
  {
    parts,
    options,
    depth,
  }: {
    readonly parts: readonly string[];
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): string {
  /**
   * Speculative inline form so the column budget check can decide the layout.
   */
  const inlineCandidate = `[ ${parts.join(', ',)}${parts.length
    === 0 ? '' : ', '}]`;
  if (
    (parts.length
      <= options
      .arrayInlineThreshold)
    && (inlineCandidate.length
      <= options
      .arrayInlineMaxColumns)
  ) {
    return inlineCandidate;
  }
  /**
   * Indent for each element when the array goes multi-line.
   */
  const indent = ' '.repeat(options.indent
    * (depth + 1),);
  /**
   * Closing bracket sits at the parent's indent level.
   */
  const closingIndent = ' '.repeat(options.indent
    * depth,);
  return `[\n${
    parts
      .map(function withIndent(p,) {
        return `${indent}${p},`;
      },)
      .join('\n',)
  }\n${closingIndent}]`;
}

/**
 * Emit a `TOMLInlineTable` as `{ k = v, ... }`.
 *
 * @returns Computed string.
 *
 * @throws {@link TomlImmutableNodeError} when `node` is not a `TOMLInlineTable`.
 */
function emitInlineTable(
  {
    node,
    options,
    depth,
  }: {
    readonly node: AST.TOMLNode;
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): string {
  if (node.type
    !== 'TOMLInlineTable') {
    throw new TomlImmutableNodeError(
      `emitInlineTable: expected TOMLInlineTable, got ${node.type}`,
    );
  }
  /**
   * Body entries rendered as `k = v` fragments for the assembler.
   */
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
 * @throws {@link TomlImmutableNodeError} when `node` is not a `TOMLInlineTable`.
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
    readonly node: ForeignBorrowed<AST.TOMLNode>;
    readonly options: CanonicalOptions;
    readonly depth: number;
    readonly extraKey: string;
    readonly extraValue: string;
  },
): string {
  if (node.type
    !== 'TOMLInlineTable') {
    throw new TomlImmutableNodeError(
      `emitInlineTableWithExtra: expected TOMLInlineTable, got ${node.type}`,
    );
  }
  /**
   * Existing entries plus the new one so the assembler joins them in order.
   */
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
    readonly body: readonly AST.TOMLKeyValue[];
    readonly options: CanonicalOptions;
    readonly depth: number;
  },
): readonly string[] {
  return body.map(function each(kv: AST.TOMLKeyValue,) {
    /**
     * Encoded key chain joined with `.` so dotted keys reuse their original spelling.
     */
    const keyText = kv
      .key
      .keys
      .map(function each2(k: AST.TOMLBare | AST.TOMLQuoted,) {
        return encodeKey({ key: k.type
          === 'TOMLBare' ? k.name : k.value, },);
      },)
      .join('.',);
    /**
     * Encoded value text so the entry can be composed as `k = v`.
     */
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
 *
 * @example
 * ```ts
 * assembleInlineTableParts({ parts: ['a = 1'], },); // '{ a = 1, }'
 * ```
 */
export function assembleInlineTableParts(
  {
    parts,
  }: {
    readonly parts: readonly string[];
  },
): string {
  return `{ ${parts.join(', ',)}${parts.length
    === 0 ? '' : ', '}}`;
}
