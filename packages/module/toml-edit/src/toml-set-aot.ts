/**
 * `tomlSet` array-of-tables replacement branch.
 *
 * Split out of `toml-set.ts` to keep each file under the 300-LOC cap.
 *
 * AST-mutation invariant: this module never modifies AST internals. All
 * changes are recorded as `deletions` and `insertions` resolved positionally
 * at emit time.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import {
  TomlImmutableNodeError,
  TomlTypeError,
} from './errors.ts';
import { formatPath, } from './path.ts';
import type {
  AnchorKind,
  Insertion,
  TomlEditState,
  TomlPath,
} from './types.ts';
import {
  encodeKey,
  isPlainObject,
  jsValueToTomlText,
} from './values.ts';

/**
 * Describe a non-plain-object value for a table-replace error message.
 *
 * @returns Computed string.
 *
 * @example
 * ```ts
 * describeNonObject({ value: [1, 2,], },); // 'array'
 * ```
 */
export function describeNonObject(
  { value, }: { readonly value: unknown; },
): string {
  if (value === null)
    return 'null';
  if (Array.isArray(value,))
    return 'array';
  if (value instanceof Date)
    return 'Date';
  if ((typeof value) === 'object')
    return 'non-plain-object';
  return typeof value;
}

/**
 * Replace an array-of-tables collection or reject when the resolver's
 * `array-of-tables` result actually represents sibling standard tables.
 *
 * Disambiguates by inspecting `node.kind`: every node being `kind: 'array'`
 * marks a true `[[foo]]` AOT; otherwise the path matched multiple sibling
 * `[a.b]` / `[a.c]` standard tables under an implicit parent, which is a
 * different shape and is still rejected.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @throws TomlImmutableNodeError when `nodes` are sibling standard tables
 *         rather than a true AOT.
 *
 * @throws TomlTypeError when `value` is not an array, or an element of the
 *         array is not a plain object.
 *
 * @example
 * ```ts
 * doAotReplace({ edit, path: ['fruits',], value: [{ name: 'apple', },], nodes, },);
 * ```
 */
export function doAotReplace(
  {
    edit,
    path,
    value,
    nodes,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
    readonly value: unknown;
    readonly nodes: readonly AST.TOMLTable[];
  },
): TomlEditState {
  /** True when every node is a `[[foo]]` instance rather than a sibling standard table. */
  const allAot = nodes.every(function isAot(n,) {
    return n.kind
      === 'array';
  },);
  if (!allAot) {
    throw new TomlImmutableNodeError(
      `tomlSet on the sibling tables at ${formatPath({ path, },)} is not supported; `
        + `the path matches multiple standard tables under an implicit parent, not a true array-of-tables. `
        + `Set per sub-table with tomlSet({ path: [...subpath], value }) instead.`,
    );
  }

  if (!Array.isArray(value,)) {
    throw new TomlTypeError(
      `tomlSet on an array-of-tables at ${
        formatPath({ path, },)
      } requires an array value; `
        + `got ${describeNonObject({ value, },)}. Pass [] to clear all instances.`,
    );
  }

  /** Aliased so the iteration site reads as `elements` not `value`. */
  const elements: readonly unknown[] = value;

  /** Encoded dotted header so each `[[a.b]]` line shares one spelling. */
  const encodedHeader = path
    .map(function each(seg,) {
      if ((typeof seg) !== 'string') {
        throw new TomlImmutableNodeError(
          `tomlSet on an array-of-tables at ${
            formatPath({ path, },)
          }: numeric path segment is not allowed on the array path`,
        );
      }
      return encodeKey({ key: seg, },);
    },)
    .join('.',);

  /** Destructure so the first existing AOT instance can anchor the new insertions. */
  const [firstNode,] = nodes;
  /** Anchor in front of the first existing instance, or EOF when there are none. */
  const anchor: AnchorKind = firstNode === undefined
    ? 'eof'
    : {
      position: 'before-node',
      node: firstNode,
    };

  /** One insertion per AOT element so the splice engine can emit each `[[a.b]]` block in order. */
  const newInsertions: Insertion[] = elements.map(function each(
    el,
    i,
  ) {
    if (!isPlainObject(el,)) {
      throw new TomlTypeError(
        `tomlSet on an array-of-tables at ${
          formatPath({ path, },)
        } requires every element to be a plain object; `
          + `element at index ${i} is ${describeNonObject({ value: el, },)}.`,
      );
    }
    /** Encoded body lines for this AOT element. */
    const bodyText = Object
      .entries(el,)
      .map(function eachEntry([k, v,],) {
        return `${encodeKey({ key: k, },)} = ${
          jsValueToTomlText({
            input: v,
            options: edit.canonical,
            existing: undefined,
          },)
        }\n`;
      },)
      .join('',);
    return {
      anchor,
      text: `[[${encodedHeader}]]\n${bodyText}`,
      path: [
        ...path,
        i,
      ],
      jsValue: el,
    };
  },);

  return {
    ...edit,
    deletions: new Set([
      ...edit.deletions,
      ...nodes,
    ],),
    insertions: [
      ...edit.insertions,
      ...newInsertions,
    ],
  };
}
