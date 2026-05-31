/**
 * JS-space merge helper for `path-create.ts`.
 *
 * Split out to keep `path-create.ts` under the 300-LOC cap. Pure function
 * operating on plain JS objects; never touches the AST.
 *
 * @module
 */

import { isPlainObject, } from './values.ts';

/**
 * Merge `value` into `base` at the chain of dotted segments, returning
 * a fresh object. Intermediate non-object slots are overwritten with
 * fresh `{}`.
 *
 * @returns Computed result (`Record<string, unknown>`).
 *
 * @example
 * ```ts
 * mergeDottedSegments({ base: { a: 1, }, segments: ['b', 'c',], value: 2, },);
 * ```
 */
export function mergeDottedSegments(
  {
    base,
    segments,
    value,
  }: {
    readonly base: Readonly<Record<string, unknown>>;
    readonly segments: readonly string[];
    readonly value: unknown;
  },
): Record<string, unknown> {
  if (segments.length
    === 0)
    return base;
  /**
   * Current segment so each recursion step shrinks `segments` by one.
   */
  const [head,] = segments;
  if (head === undefined)
    return base;
  if (segments.length
    === 1) {
    return {
      ...base,
      [head]: value,
    };
  }
  /**
   * Snapshot prior subtree so it can be merged into rather than overwritten.
   */
  const existing = base[head];
  /**
   * Default to an empty object when the existing slot is not a plain object.
   */
  const child = isPlainObject(existing,) ? existing : {};
  return {
    ...base,
    [head]: mergeDottedSegments({
      base: child,
      segments: segments.slice(1,),
      value,
    },),
  };
}
