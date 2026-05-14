/**
 * `tomlDelete`: remove a key or table at `path`. Returns a fresh
 * `TomlEditState`.
 *
 * For most paths the deletion is processed by
 * `splice.ts:computeDeletionRange`, which also absorbs the same-line
 * trailing inline comment and the trailing newline. For an array element
 * inside a key-value's direct array value, the parent array is rewritten
 * via a `replace-value` Edit on the containing `TOMLKeyValue`.
 *
 * @module
 */

import {
  type AST,
  getStaticTOMLValue,
} from 'toml-eslint-parser';

import { emitArrayWithoutIndex, } from './emit-value.ts';
import { TomlImmutableNodeError, } from './errors.ts';
import { formatPath, } from './path.ts';
import { resolveByPath, } from './resolve.ts';
import type {
  Edit,
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Mark `path` as deleted.
 *
 * No-op when the path does not exist.
 *
 * Supported targets:
 *
 * - A `TOMLKeyValue` (path resolves to a key in any container): removes
 *   the entire key-value line and absorbs a same-line trailing inline
 *   comment plus the trailing newline.
 * - A `TOMLTable` (path resolves to a `[foo]` header): removes the entire
 *   block including all body key-values and any standalone comments
 *   interleaved between body items.
 * - An array-of-tables collection (path resolves to `[[foo]]` instances or
 *   to a path whose strict prefix is shared by multiple sibling tables
 *   such as `[a.b]` and `[a.c]` queried by `['a']`): removes every matched
 *   table block.
 * - An array element (path of shape `[..., key, index]` resolving to a
 *   primitive, array, or inline-table inside a `TOMLArray` that is the
 *   direct value of a key-value): rewrites the parent array via
 *   canonical re-emission, missing the indexed element.
 *
 * @throws TomlImmutableNodeError when deleting an element nested inside
 *         an array of arrays (the outer container is also a `TOMLArray`,
 *         not a key-value).
 *
 * @example
 * ```ts
 * const e1 = tomlDelete({ edit, path: ['old',], },);
 * const e2 = tomlDelete({ edit, path: ['fruits',], },); // array-of-tables
 * const e3 = tomlDelete({ edit, path: ['arr', 1,], },); // element at index 1
 * ```
 */
export function tomlDelete(
  { edit, path, }: { edit: TomlEditState; path: TomlPath; },
): TomlEditState {
  const resolved = resolveByPath({ edit, path, },);

  if (resolved.kind === 'missing' || resolved.kind === 'top-level')
    return edit;

  if (resolved.kind === 'array-of-tables')
    return withDeletions({ edit, nodes: resolved.nodes, },);

  if (resolved.kind === 'value')
    return deleteArrayElement({ edit, path, element: resolved.node, },);

  return withDeletion({ edit, node: resolved.node, },);
}

/** Return a fresh state with `node` added to `deletions`. */
function withDeletion(
  {
    edit,
    node,
  }: {
    edit: TomlEditState;
    node: AST.TOMLNode;
  },
): TomlEditState {
  return { ...edit, deletions: new Set([...edit.deletions, node,],), };
}

/** Return a fresh state with all `nodes` added to `deletions` in one allocation. */
function withDeletions(
  {
    edit,
    nodes,
  }: {
    edit: TomlEditState;
    nodes: readonly AST.TOMLNode[];
  },
): TomlEditState {
  return { ...edit, deletions: new Set([...edit.deletions, ...nodes,],), };
}

/**
 * Remove an array element by rewriting the parent array via a
 * `replace-value` Edit on the containing `TOMLKeyValue`.
 *
 * The Edit's `jsValue` is the post-delete JS array, so
 * `tomlGetValue({ path: containingKeyPath })` returns the new array on
 * the same or any branched state.
 */
function deleteArrayElement(
  {
    edit,
    path,
    element,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    element: AST.TOMLContentNode;
  },
): TomlEditState {
  const parent = element.parent;
  if (parent === null || parent.type !== 'TOMLArray')
    throw new TomlImmutableNodeError(
      `tomlDelete at ${formatPath({ path, },)}: expected an array element, found parent type ${String(parent?.type,)}`,
    );
  const grandparent = parent.parent;
  if (grandparent === null || grandparent.type !== 'TOMLKeyValue')
    throw new TomlImmutableNodeError(
      `tomlDelete on a nested-array element at ${formatPath({ path, },)} is not supported in v1; the outer array is not the direct value of a key`,
    );
  const skipIndex = parent.elements.indexOf(element,);
  if (skipIndex === -1)
    throw new TomlImmutableNodeError(
      `tomlDelete at ${formatPath({ path, },)}: element not found in parent array`,
    );
  const newText = emitArrayWithoutIndex({
    array: parent,
    skipIndex,
    options: edit.canonical,
    depth: 0,
  },);
  const newJsArray = parent.elements
    .filter(function notSkipped(_el, i,) {
      return i !== skipIndex;
    },)
    .map(function each(el,) {
      return getStaticTOMLValue(el,);
    },);
  const delta: Edit = {
    kind: 'replace-value',
    newText,
    jsValue: newJsArray,
  };
  const nextEdits = new Map([...edit.edits, [grandparent, delta,] as const,],);
  return { ...edit, edits: nextEdits, };
}
