/**
 * `tomlKeys`: list the keys at a path (or at the root).
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import type { AST, } from 'toml-eslint-parser';

import { effectiveAt, } from './effective-value.ts';
import { keysOf, } from './path.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Return the immediate children of the resolved container at `path`.
 *
 * For tables and inline tables, returns key strings. For arrays and
 * array-of-tables, returns numeric indices. For a missing path, returns
 * an empty array.
 *
 * @returns Computed result (`readonly (string | number)[]`).
 *
 * @example
 * ```ts
 * tomlKeys({ edit, },);                  // ['title', 'tools', 'fruits']
 * tomlKeys({ edit, path: ['fruits',], },); // [0, 1] (array-of-tables)
 * ```
 */
export function tomlKeys(
  {
    edit,
    path = [],
  }: {
    edit: TomlEditState;
    path?: TomlPath
  },
): readonly (string | number)[] {
  /** Effective resolution accounts for pending edits and deletes. */
  const result = effectiveAt({
    edit,
    path,
  },);
  if ((result.kind === 'missing') || (result.kind === 'deleted'))
    return [];
  if (result.kind === 'pending-value') {
    /** Local alias so the type guards can read directly. */
    const v = result.value;
    if (Array.isArray(v,))
      return v.map(function eachIdx(
        _: unknown,
        i: number,
      ) {
        return i;
      },);
    if ((v !== null) && ((typeof v) === 'object'))
      return Object.keys(v,);
    return [];
  }
  if ((result.kind === 'top-level') || (result.kind === 'table'))
    return tableChildKeys({ container: result.node, },);
  if (result.kind === 'keyvalue') {
    if (result.node.value.type === 'TOMLInlineTable')
      return tableChildKeys({ container: result.node.value, },);
    if (result.node.value.type === 'TOMLArray')
      return result.node.value.elements.map(function eachIdx(
        _: unknown,
        i: number,
      ) {
        return i;
      },);
    return [];
  }
  if (result.kind === 'value') {
    if (result.node.type === 'TOMLInlineTable')
      return tableChildKeys({ container: result.node, },);
    if (result.node.type === 'TOMLArray')
      return result.node.elements.map(function eachIdx(
        _: unknown,
        i: number,
      ) {
        return i;
      },);
    return [];
  }
  return result.nodes.map(function eachIdx(
    _: unknown,
    i: number,
  ) {
    return i;
  },);
}

/**
 * First key of each direct child entry in a table container (deduped).
 *
 * @returns Computed result (`readonly string[]`).
 */
function tableChildKeys(
  {
    container,
  }: {
    container: AST.TOMLTopLevelTable | AST.TOMLTable | AST.TOMLInlineTable;
  },
): readonly string[] {
  /** Tracks emitted top-level segments so each first key is reported once. */
  const seen = new Set<string>();
  return container.body.flatMap(function flatten(child,) {
    if (child.type === 'TOMLKeyValue') {
      /** All key segments of this entry so the first one can be projected out. */
      const segs = keysOf({ key: child.key, },);
      /** Top-level segment that becomes the visible key. */
      const first = nonNullishOrThrow(segs[0],);
      if (seen.has(first,)) return [];
      seen.add(first,);
      return [first,];
    }
    if (container.type === 'TOMLTopLevelTable') {
      /** Header's first segment so a top-level table contributes its top key. */
      const [tableTop,] = child.resolvedKey;
      if (((typeof tableTop) !== 'string') || seen.has(tableTop,)) return [];
      seen.add(tableTop,);
      return [tableTop,];
    }
    return [];
  },);
}
