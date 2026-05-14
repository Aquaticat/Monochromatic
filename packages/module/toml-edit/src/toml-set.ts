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
 * - Existing array-of-tables collection (multiple `[[foo]]` or a path
 *   shared by multiple sibling tables): rejected — ambiguous semantics
 *   between N instances and one logical table. Set per-element instead.
 * - Missing path: a fresh entry is created. Dotted-key insertions check
 *   for sibling-table or inline-table collisions and throw
 *   `TomlImmutableNodeError` when the result would not re-parse.
 *
 * @throws TomlTypeError for `null`, `undefined`, or a non-object value
 *         when replacing a table body.
 *
 * @throws TomlImmutableNodeError for array-of-tables wholesale
 *         replacement, numeric segments inside the missing tail of the
 *         path, path-create through a scalar or `TOMLArray`, or any
 *         sibling-table / inline-table key collision.
 *
 * @example
 * ```ts
 * const e1 = tomlSet({ edit, path: ['tools', 'bun',], value: 'latest', },);
 * const e2 = tomlSet({ edit, path: ['foo',], value: { x: 1, y: 2 } as const, },);
 * const e3 = tomlSet({ edit, path: ['a','b','c',], value: 42, },);
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
  if (value === null || value === undefined)
    throw new TomlTypeError(
      `Cannot set ${formatPath({ path, },)} to ${String(value,)}; use tomlDelete`,
    );

  const resolved = resolveByPath({ edit, path, },);

  if (resolved.kind === 'keyvalue') {
    const newText = jsValueToTomlText({
      input: value,
      options: edit.canonical,
      existing: resolved.node.value,
    },);
    return withEditOn({
      edit,
      node: resolved.node,
      delta: { kind: 'replace-value', newText, jsValue: value, },
    },);
  }

  if (resolved.kind === 'value') {
    const newText = jsValueToTomlText({
      input: value,
      options: edit.canonical,
      existing: resolved.node,
    },);
    return withEditOn({
      edit,
      node: resolved.node,
      delta: { kind: 'replace-value', newText, jsValue: value, },
    },);
  }

  if (resolved.kind === 'array-of-tables')
    throw new TomlImmutableNodeError(
      `tomlSet on the array-of-tables at ${formatPath({ path, },)} is not supported; `
      + `array-of-tables wholesale replacement is ambiguous between N instances and one logical table. `
      + `Set per-element with tomlSet({ path: [..., N, 'key'], value }) instead.`,
    );

  if (resolved.kind === 'table' || resolved.kind === 'top-level')
    return doTableReplace({ edit, path, value, container: resolved.node, },);

  return doPathCreate({ edit, path, value, resolved, },);
}

/**
 * Replace the key-values inside an existing `TOMLTable` or
 * `TOMLTopLevelTable` with the entries of the given JS object.
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

  const bodyKvs = container.body.filter(function isKv(child,): child is AST.TOMLKeyValue {
    return child.type === 'TOMLKeyValue';
  },);

  const anchor: AnchorKind = anchorForTableReplace({ container, },);

  const newInsertions: Insertion[] = Object.entries(value,).map(function each([k, v,],) {
    const text = `${encodeKey({ key: k, },)} = ${
      jsValueToTomlText({ input: v, options: edit.canonical, existing: undefined, },)
    }\n`;
    return {
      anchor,
      text,
      path: [...path, k,],
      jsValue: v,
    };
  },);

  return {
    ...edit,
    deletions: new Set([...edit.deletions, ...bodyKvs,],),
    insertions: [...edit.insertions, ...newInsertions,],
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
 */
function anchorForTableReplace(
  {
    container,
  }: {
    container: AST.TOMLTable | AST.TOMLTopLevelTable;
  },
): AnchorKind {
  if (container.type === 'TOMLTable')
    return { position: 'inside-table', table: container, atEnd: true, };
  const firstTable = container.body.find(function isTable(child,): child is AST.TOMLTable {
    return child.type === 'TOMLTable';
  },);
  if (firstTable !== undefined)
    return { position: 'before-node', node: firstTable, };
  return 'eof';
}

/** Describe a non-plain-object value for the table-replace error message. */
function describeNonObject(
  { value, }: { value: unknown; },
): string {
  if (value === null) return 'null';
  if (Array.isArray(value,)) return 'array';
  if (value instanceof Date) return 'Date';
  if (typeof value === 'object') return 'non-plain-object';
  return typeof value;
}

