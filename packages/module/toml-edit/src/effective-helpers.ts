/**
 * Helpers for `effective-value.ts`: pure JS-space operations on paths and
 * objects, kept here to keep `effective-value.ts` under the 300-LOC cap.
 *
 * @module
 */

import type { TomlPath, } from './types.ts';
import { isPlainObject, } from './values.ts';

/**
 * Strict equality on two TOML paths (segment-wise).
 *
 * @returns True when both paths have the same length and every segment is
 *          identical.
 *
 * @example
 * ```ts
 * pathEquals({ a: ['x',], b: ['x',], },);     // true
 * pathEquals({ a: ['x','y',], b: ['x',], },); // false
 * ```
 */
export function pathEquals(
  {
    a,
    b,
  }: {
    a: TomlPath;
    b: TomlPath;
  },
): boolean {
  if (a.length !== b.length)
    return false;
  return a.every(function eq(
    seg,
    i,
  ) {
    return seg === b[i];
  },);
}

/**
 * Project `segs` to a `string[]` when every segment is a string; else
 * `null`. Used in sub-tree synthesis to skip insertions whose path
 * goes through an array (a sub-tree can't be reconstructed via key
 * navigation alone).
 *
 * @returns String segments, or `null` when any segment is numeric.
 *
 * @example
 * ```ts
 * asStringPath({ segs: ['a','b',], },); // ['a','b']
 * asStringPath({ segs: ['a', 0,], },);  // null
 * ```
 */
export function asStringPath(
  { segs, }: { segs: TomlPath; },
): readonly string[] | null {
  /** Accumulator so an early numeric segment can short-circuit with `null`. */
  const result: string[] = [];
  for (const s of segs) {
    if ((typeof s) !== 'string')
      return null;
    result.push(s,);
  }
  return result;
}

/**
 * Merge `value` into `base` at the chain of segments, returning a fresh object.
 *
 * @returns Fresh object with `value` set at the nested path described by
 *          `segments`. Existing structure is preserved where possible.
 *
 * @example
 * ```ts
 * mergeAt({ base: {}, segments: ['a','b',], value: 1, },);  // { a: { b: 1, }, }
 * ```
 */
export function mergeAt(
  {
    base,
    segments,
    value,
  }: {
    base: Record<string, unknown>;
    segments: readonly string[];
    value: unknown;
  },
): Record<string, unknown> {
  if (segments.length === 0)
    return base;
  /** Current segment so each recursion step shrinks `segments` by one. */
  const [head,] = segments;
  if (head === undefined)
    return base;
  if (segments.length === 1) {
    return {
      ...base,
      [head]: value,
    };
  }
  /** Snapshot the prior subtree so it can be merged into rather than overwritten. */
  const existing = base[head];
  /** Default to an empty object when the existing slot is not a plain object. */
  const child = isPlainObject(existing,) ? existing : {};
  return {
    ...base,
    [head]: mergeAt({
      base: child,
      segments: segments.slice(1,),
      value,
    },),
  };
}
