/**
 * `tomlGetValue`: read the effective JS value at a path.
 *
 * @module
 */

import { getStaticTOMLValue, } from 'toml-eslint-parser';

import { effectiveAt, } from './effective-value.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * The effective JS value at `path`, or `undefined` if the path does not
 * exist (or was deleted by a pending `tomlDelete`).
 *
 * Routes through `effectiveAt` so a `tomlSet` on the same state (or a
 * branched state) is reflected immediately.
 *
 * For tables and inline tables, returns the table's nested object.
 * For arrays and array-of-tables, returns the array of values.
 * For primitives, returns the JS primitive.
 *
 * @example
 * ```ts
 * tomlGetValue({ edit, path: ['fruits', 0, 'name',], },);  // 'apple'
 * ```
 */
export function tomlGetValue(
  { edit, path, }: { edit: TomlEditState; path: TomlPath; },
): unknown {
  const result = effectiveAt({ edit, path, },);
  if (result.kind === 'missing' || result.kind === 'deleted')
    return undefined;
  if (result.kind === 'pending-value')
    return result.value;
  if (result.kind === 'keyvalue')
    return getStaticTOMLValue(result.node.value,);
  if (result.kind === 'value')
    return getStaticTOMLValue(result.node,);
  if (result.kind === 'table' || result.kind === 'top-level')
    return getStaticTOMLValue(result.node,);
  return result.nodes.map(function each(t,) {
    return getStaticTOMLValue(t,);
  },);
}
