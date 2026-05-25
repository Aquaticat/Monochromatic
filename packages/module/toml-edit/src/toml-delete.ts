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

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import {
  type AST,
  getStaticTOMLValue,
} from 'toml-eslint-parser';

import { emitArrayWithSkipPath, } from './emit-value.ts';
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
 * - An array element (path of shape `[..., key, ...indices]` resolving
 *   to a primitive, array, or inline-table inside a `TOMLArray` that is
 *   reached from a key-value through zero or more nested arrays): walks
 *   the parent chain up to the containing key-value, then rewrites the
 *   outermost array via canonical re-emission with the targeted element
 *   omitted at the deepest level. Works at arbitrary nesting depth.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @throws TomlImmutableNodeError when the AST is internally inconsistent
 *         (e.g. a target element has no parent chain that terminates at a
 *         `TOMLKeyValue`). Not reachable from well-formed parser output.
 *
 * @example
 * ```ts
 * const e1 = tomlDelete({ edit, path: ['old',], },);
 * const e2 = tomlDelete({ edit, path: ['fruits',], },); // array-of-tables
 * const e3 = tomlDelete({ edit, path: ['arr', 1,], },); // element at index 1
 * const e4 = tomlDelete({ edit, path: ['outer', 0, 1,], },); // nested array element
 * ```
 */
export function tomlDelete(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath;
  },
): TomlEditState {
  /** Direct AST lookup so deletion can branch on the resolution kind. */
  const resolved = resolveByPath({
    edit,
    path,
  },);

  if ((resolved.kind
    === 'missing') || (resolved.kind
      === 'top-level'))
    return edit;

  if (resolved.kind
    === 'array-of-tables') {
    return withDeletions({
      edit,
      nodes: resolved.nodes,
    },);
  }

  if (resolved.kind
    === 'value') {
    return deleteArrayElement({
      edit,
      path,
      element: resolved.node,
    },);
  }

  return withDeletion({
    edit,
    node: resolved.node,
  },);
}

/**
 * Return a fresh state with `node` added to `deletions`.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function withDeletion(
  {
    edit,
    node,
  }: {
    edit: TomlEditState;
    node: AST.TOMLNode;
  },
): TomlEditState {
  return {
    ...edit,
    deletions: new Set([
      ...edit.deletions,
      node,
    ],),
  };
}

/**
 * Return a fresh state with all `nodes` added to `deletions` in one allocation.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 */
function withDeletions(
  {
    edit,
    nodes,
  }: {
    edit: TomlEditState;
    nodes: readonly AST.TOMLNode[];
  },
): TomlEditState {
  return {
    ...edit,
    deletions: new Set([
      ...edit.deletions,
      ...nodes,
    ],),
  };
}

/**
 * Remove an array element by rewriting the outermost containing array
 * via a `replace-value` Edit on its enclosing `TOMLKeyValue`.
 *
 * Walks the parent chain through any number of nested `TOMLArray`s,
 * accumulating the index taken at each level (outer to inner) in
 * `skipPath`. The walk terminates at the first ancestor that is a
 * `TOMLKeyValue`; that key-value's value is then re-emitted with the
 * target element omitted at the deepest level.
 *
 * The Edit's `jsValue` is the post-delete JS structure rooted at the
 * outermost array, so `tomlGetValue({ path: containingKeyPath, })` on
 * the same or any branched state returns the new shape.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
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
  /** Destructured parent so the type guard can read it once. */
  const { parent, } = element;
  if ((parent === null) || (parent.type
    !== 'TOMLArray')) {
    throw new TomlImmutableNodeError(
      `tomlDelete at ${
        formatPath({ path, },)
      }: expected an array element, found parent type ${String(parent?.type,)}`,
    );
  }
  /** Position of the element to drop; seeds the skip path for the outer walk. */
  const skipIndex = parent.elements
    .indexOf(element,);
  if (skipIndex === (-1)) {
    throw new TomlImmutableNodeError(
      `tomlDelete at ${formatPath({ path, },)}: element not found in parent array`,
    );
  }
  /** Climb the parent chain so the outermost containing key-value is the edit target. */
  const walkResult = walkUpToKeyValue({
    path,
    array: parent,
    trailingPath: [skipIndex,],
  },);
  /** Re-emit the outermost array with the element omitted at the deepest level. */
  const newText = emitArrayWithSkipPath({
    array: walkResult.outerArray,
    skipPath: walkResult.skipPath,
    options: edit.canonical,
    depth: 0,
  },);
  /** Post-delete JS view so readers see the new shape immediately. */
  const newJsArray = removeJsAtPath({
    arr: getStaticTOMLValue(walkResult.outerArray,) as readonly unknown[],
    path: walkResult.skipPath,
  },);
  /** Replace-value delta on the containing key-value. */
  const delta: Edit = {
    kind: 'replace-value',
    newText,
    jsValue: newJsArray,
  };
  /** Fresh map so the prior state's edits remain untouched. */
  const nextEdits = new Map([
    ...edit.edits,
    [
      walkResult.keyValue,
      delta,
    ] as const,
  ],);
  return {
    ...edit,
    edits: nextEdits,
  };
}

/**
 * Walk the parent chain from `array` upward, prepending each enclosing
 * array's index to `trailingPath`, until reaching a `TOMLKeyValue`.
 *
 * @returns The enclosing `TOMLKeyValue`, the outermost `TOMLArray`
 *          directly under it, and the full outer-to-inner skip path.
 *
 * @throws TomlImmutableNodeError when the chain terminates without a
 *         `TOMLKeyValue` (malformed AST).
 */
function walkUpToKeyValue(
  {
    path,
    array,
    trailingPath,
  }: {
    path: TomlPath;
    array: AST.TOMLArray;
    trailingPath: readonly number[];
  },
): {
  readonly keyValue: AST.TOMLKeyValue;
  readonly outerArray: AST.TOMLArray;
  readonly skipPath: readonly number[];
} {
  /** Next ancestor up the AST so the walk can decide whether to recurse. */
  const ancestor = array.parent;
  if (ancestor === null) {
    throw new TomlImmutableNodeError(
      `tomlDelete at ${formatPath({ path, },)}: array has no parent in the AST`,
    );
  }
  if (ancestor.type
    === 'TOMLKeyValue') {
    return {
      keyValue: ancestor,
      outerArray: array,
      skipPath: trailingPath,
    };
  }
  if (ancestor.type
    === 'TOMLArray') {
    /** Index of `array` inside its enclosing array; prepended to the skip path. */
    const idx = ancestor.elements
      .indexOf(array,);
    if (idx === (-1)) {
      throw new TomlImmutableNodeError(
        `tomlDelete at ${formatPath({ path, },)}: nested array not found in its parent`,
      );
    }
    return walkUpToKeyValue({
      path,
      array: ancestor,
      trailingPath: [
        idx,
        ...trailingPath,
      ],
    },);
  }
  throw new TomlImmutableNodeError(
    `tomlDelete at ${
      formatPath({ path, },)
    }: array ancestor is neither TOMLArray nor TOMLKeyValue (unreachable for well-formed parser output)`,
  );
}

/**
 * Materialize the post-delete JS structure for an outer array by removing
 * the element addressed by `path` (outer-to-inner array indices).
 *
 * @returns A fresh `unknown[]` mirroring `arr` with the targeted element
 *          gone at the deepest level.
 */
function removeJsAtPath(
  {
    arr,
    path,
  }: {
    arr: readonly unknown[];
    path: readonly number[];
  },
): unknown[] {
  if (path.length
    === 0) {
    throw new TomlImmutableNodeError(
      'removeJsAtPath: path must not be empty',
    );
  }
  /** Current outer index; each recursion step strips this off the path. */
  const head = nonNullishOrThrow(path[0],);
  /** Inner-level segments still to traverse. */
  const rest = path.slice(1,);
  if (rest.length
    === 0) {
    return arr.filter(function notSkipped(
      _el,
      i,
    ) {
      return i !== head;
    },);
  }
  /** Inner array at this level so the recursion can drill in. */
  const target = arr[head];
  if (!Array.isArray(target,)) {
    throw new TomlImmutableNodeError(
      `removeJsAtPath: expected array at index ${head}, got ${typeof target}`,
    );
  }
  return arr.map(function each(
    el,
    i,
  ) {
    if (i !== head)
      return el;
    return removeJsAtPath({
      arr: target as readonly unknown[],
      path: rest,
    },);
  },);
}
