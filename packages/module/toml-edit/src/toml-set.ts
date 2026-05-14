/**
 * `tomlSet`: write a value at a path, returning a fresh state with the
 * pending edit recorded.
 *
 * AST-mutation invariant: this module never modifies AST internals.
 * All changes are recorded as entries in `edits` (for existing nodes) or
 * `insertions` (for path-create) and resolved positionally at emit time.
 *
 * Path-create dispatch (when `resolveByPath` returns `kind: 'missing'`)
 * lives in `./path-create.ts`; the table-replace and the in-place
 * primitive replacement paths live here.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import {
  TomlImmutableNodeError,
  TomlTypeError,
} from './errors.ts';
import { doPathCreate, } from './path-create.ts';
import { formatPath, } from './path.ts';
import { resolveByPath, } from './resolve.ts';
import { withEditOn, } from './state.ts';
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
 * Set the value at `path`. Returns a fresh `TomlEditState`.
 *
 * Behaviour by what `path` resolves to:
 *
 * - Existing key-value or array element: the value bytes are replaced
 *   canonically (preserving style for unchanged primitives; see
 *   `values.ts` for preservation rules).
 * - Existing `[foo]` table or top-level: the body's key-values are
 *   cleared and the JS object's entries are inserted in `Object.entries`
 *   order. Sub-tables (`[foo.sub]`) are preserved. The JS value must be
 *   a plain object; arrays, scalars, and `Date` throw `TomlTypeError`.
 * - Existing array-of-tables collection (multiple `[[foo]]` blocks):
 *   replaces with one `[[foo]]` block per element of the supplied JS
 *   array. The JS value must be an array of plain objects (use `[]` to
 *   clear all instances). Numeric, string, or object values throw
 *   `TomlTypeError`.
 * - Existing sibling-tables collection (the path matches multiple
 *   `[a.b]` / `[a.c]` standard tables under an implicit parent):
 *   rejected; not the same shape as a true array-of-tables. Set per
 *   sub-table instead.
 * - Missing path: a fresh entry is created. Dotted-key insertions check
 *   for sibling-table or inline-table collisions and throw
 *   `TomlImmutableNodeError` when the result would not re-parse.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @throws TomlTypeError for `null`, `undefined`, a non-object value when
 *         replacing a table body, or a non-array value (or array with a
 *         non-plain-object element) when replacing an array-of-tables.
 *
 * @throws TomlImmutableNodeError for sibling-tables wholesale
 *         replacement, numeric segments inside the missing tail of the
 *         path, path-create through a scalar or `TOMLArray`, or any
 *         sibling-table / inline-table key collision.
 *
 * @example
 * ```ts
 * const e1 = tomlSet({ edit, path: ['tools', 'bun',], value: 'latest', },);
 * const e2 = tomlSet({ edit, path: ['foo',], value: { x: 1, y: 2 } as const, },);
 * const e3 = tomlSet({ edit, path: ['a','b','c',], value: 42, },);
 * const e4 = tomlSet({ edit, path: ['fruits',], value: [{ name: 'apple', }, { name: 'pear', },], },);
 * ```
 */
export function tomlSet(
  {
    edit,
    path,
    value,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
  },
): TomlEditState {
  if ((value === null) || (value === undefined))
    throw new TomlTypeError(
      `Cannot set ${formatPath({ path, },)} to ${String(value,)}; use tomlDelete`,
    );

  /** Direct AST lookup so the setter can branch on the resolution kind. */
  const resolved = resolveByPath({
    edit,
    path,
  },);

  if (resolved.kind === 'keyvalue') {
    /** Encoded replacement text for an existing key-value's value. */
    const newText = jsValueToTomlText({
      input: value,
      options: edit.canonical,
      existing: resolved.node.value,
    },);
    return withEditOn({
      edit,
      node: resolved.node,
      delta: {
        kind: 'replace-value',
        newText,
        jsValue: value,
      },
    },);
  }

  if (resolved.kind === 'value') {
    /** Encoded replacement text for an array element or inline-table value. */
    const newText = jsValueToTomlText({
      input: value,
      options: edit.canonical,
      existing: resolved.node,
    },);
    return withEditOn({
      edit,
      node: resolved.node,
      delta: {
        kind: 'replace-value',
        newText,
        jsValue: value,
      },
    },);
  }

  if (resolved.kind === 'array-of-tables')
    return doAotReplace({
      edit,
      path,
      value,
      nodes: resolved.nodes,
    },);

  if ((resolved.kind === 'table') || (resolved.kind === 'top-level'))
    return doTableReplace({
      edit,
      path,
      value,
      container: resolved.node,
    },);

  return doPathCreate({
    edit,
    path,
    value,
    resolved,
  },);
}

/**
 * Replace the key-values inside an existing `TOMLTable` or
 * `TOMLTopLevelTable` with the entries of the given JS object.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function doTableReplace(
  {
    edit,
    path,
    value,
    container,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    container: AST.TOMLTable | AST.TOMLTopLevelTable;
  },
): TomlEditState {
  if (!isPlainObject(value,))
    throw new TomlTypeError(
      `tomlSet at ${formatPath({ path, },)} requires a plain object to replace a table body; got ${describeNonObject({ value, },)}`,
    );

  /** Existing body key-values so they can be marked for deletion. */
  const bodyKvs = container.body.filter(function isKv(child,): child is AST.TOMLKeyValue {
    return child.type === 'TOMLKeyValue';
  },);

  /** Anchor placing new insertions inside the table body. */
  const anchor: AnchorKind = anchorForTableReplace({ container, },);

  /** One `Insertion` per replacement entry so the splice engine can emit them in order. */
  const newInsertions: Insertion[] = Object.entries(value,).map(function each([k, v,],) {
    /** Encoded `key = value\n` line. */
    const text = `${encodeKey({ key: k, },)} = ${
      jsValueToTomlText({
        input: v,
        options: edit.canonical,
        existing: undefined,
      },)
    }\n`;
    return {
      anchor,
      text,
      path: [
        ...path,
        k,
      ],
      jsValue: v,
    };
  },);

  return {
    ...edit,
    deletions: new Set([
      ...edit.deletions,
      ...bodyKvs,
    ],),
    insertions: [
      ...edit.insertions,
      ...newInsertions,
    ],
  };
}

/**
 * Resolve the anchor for a table-replace insertion.
 *
 * - `TOMLTable`: `inside-table` at end. Tables can hold only key-values
 *   in their body so this lands the new entries correctly.
 * - `TOMLTopLevelTable`: `before-node` of the first sibling `TOMLTable`,
 *   if any (so the new entries land between the old top-level KVs and
 *   the first table header). Else `eof`.
 *
 * @returns Computed result (`AnchorKind`).
 */
function anchorForTableReplace(
  {
    container,
  }: {
    container: AST.TOMLTable | AST.TOMLTopLevelTable;
  },
): AnchorKind {
  if (container.type === 'TOMLTable')
    return {
      position: 'inside-table',
      table: container,
      atEnd: true,
    };
  /** First `[foo]` header after the top-level body so insertions land before it. */
  const firstTable = container.body.find(function isTable(child,): child is AST.TOMLTable {
    return child.type === 'TOMLTable';
  },);
  if (firstTable !== undefined)
    return {
      position: 'before-node',
      node: firstTable,
    };
  return 'eof';
}

/**
 * Describe a non-plain-object value for the table-replace error message.
 *
 * @returns Computed string.
 */
function describeNonObject(
  { value, }: { value: unknown; },
): string {
  if (value === null) return 'null';
  if (Array.isArray(value,)) return 'array';
  if (value instanceof Date) return 'Date';
  if ((typeof value) === 'object') return 'non-plain-object';
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
 */
function doAotReplace(
  {
    edit,
    path,
    value,
    nodes,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    value: unknown;
    nodes: readonly AST.TOMLTable[];
  },
): TomlEditState {
  /** True when every node is a `[[foo]]` instance rather than a sibling standard table. */
  const allAot = nodes.every(function isAot(n,) {
    return n.kind === 'array';
  },);
  if (!allAot)
    throw new TomlImmutableNodeError(
      `tomlSet on the sibling tables at ${formatPath({ path, },)} is not supported; `
      + `the path matches multiple standard tables under an implicit parent, not a true array-of-tables. `
      + `Set per sub-table with tomlSet({ path: [...subpath], value }) instead.`,
    );

  if (!Array.isArray(value,))
    throw new TomlTypeError(
      `tomlSet on an array-of-tables at ${formatPath({ path, },)} requires an array value; `
      + `got ${describeNonObject({ value, },)}. Pass [] to clear all instances.`,
    );

  /** Aliased so the iteration site reads as `elements` not `value`. */
  const elements: readonly unknown[] = value;

  /** Encoded dotted header so each `[[a.b]]` line shares one spelling. */
  const encodedHeader = path
    .map(function each(seg,) {
      if ((typeof seg) !== 'string')
        throw new TomlImmutableNodeError(
          `tomlSet on an array-of-tables at ${formatPath({ path, },)}: numeric path segment is not allowed on the array path`,
        );
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
    if (!isPlainObject(el,))
      throw new TomlTypeError(
        `tomlSet on an array-of-tables at ${formatPath({ path, },)} requires every element to be a plain object; `
        + `element at index ${i} is ${describeNonObject({ value: el, },)}.`,
      );
    /** Encoded body lines for this AOT element. */
    const bodyText = Object.entries(el,)
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

