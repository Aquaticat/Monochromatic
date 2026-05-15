/**
 * `tomlHas`: presence check for a path.
 *
 * @module
 */

import { effectiveAt, } from './effective-value.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * True when `path` resolves to an existing key, value, table, or
 * array-of-tables in the effective state (parse-time AST plus pending
 * deltas).
 *
 * @returns Resulting boolean.
 *
 * @example
 * ```ts
 * tomlHas({ edit, path: ['tools', 'bun',], },);  // true / false
 * ```
 */
export function tomlHas(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath;
  },
): boolean {
  /** Effective resolution so pending deletes show as absent. */
  const result = effectiveAt({
    edit,
    path,
  },);
  return (result.kind !== 'missing') && (result.kind !== 'deleted');
}
