/**
 * Materialize a {@link ValueNode} (and dotted-key chains) into plain JS.
 *
 * Reads (`tomlGetValue` / `tomlHas` / `tomlKeys`) walk the current tree and
 * materialize the addressed node, so they always agree with what `tomlStringify`
 * would emit.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type { ValueNode, } from './document.ts';

/**
 * Materialize a value node to its plain JS value.
 *
 * @returns Computed JS value.
 *
 * @example
 * ```ts
 * materializeValue({ value: kv.value, },); // 42 | 'x' | [1,2] | { a: 1 }
 * ```
 */
export function materializeValue({ value, }: { readonly value: ValueNode; },): unknown {
  if (value.kind
    === 'scalar')
    return value.jsValue;
  if (value.kind
    === 'array') {
    return value.elements
      .map(function each(el,) {
      return materializeValue({ value: el, },);
    },);
  }
  /**
   * Fold inline-table entries (which may carry dotted keys) into one object.
   */
  return value.entries
    .reduce(
    function step(
      acc: Record<string, unknown>,
      entry,
    ) {
      return setNested({
        target: acc,
        segments: entry.keySegments,
        value: materializeValue({ value: entry.value, },),
      },);
    },
    {},
  );
}

/**
 * Set `value` at the nested `segments` path within `target`, creating
 * intermediate objects, and return `target`.
 *
 * Mutates `target` in place; callers pass a fresh accumulator.
 *
 * @returns The same `target`, for reduce chaining.
 *
 * @example
 * ```ts
 * setNested({ target: {}, segments: ['a','b'], value: 1, },); // { a: { b: 1 } }
 * ```
 */
export function setNested(
  {
    target,
    segments,
    value,
  }: {
    readonly target: Record<string, unknown>;
    readonly segments: readonly string[];
    readonly value: unknown;
  },
): Record<string, unknown> {
  /**
   * Final key so the loop descends only through the intermediate segments.
   */
  const last = segments[segments.length
    - 1];
  if (last === undefined)
    return target;
  /**
   * Cursor object descending into (and creating) each intermediate table.
   */
  let cursor = target;
  for (const seg of segments.slice(
    0,
    -1,
  )) {
    /**
     * Existing child at this segment; replaced with a fresh object when absent.
     */
    const existing = cursor[seg];
    if ((existing === null) || ((typeof existing) !== 'object')) {
      /**
       * Fresh intermediate table so the descent can continue.
       */
      const fresh: Record<string, unknown> = {};
      cursor[seg] = fresh;
      cursor = fresh;
      continue;
    }
    cursor = existing as Record<string, unknown>;
  }
  cursor[last] = value;
  return target;
}

/**
 * Descend `segments` through `target`, using the last element of any array
 * crossed (array-of-tables sub-table semantics), creating objects as needed.
 *
 * @returns The container object at `segments`.
 */
export function containerAt(
  {
    target,
    segments,
  }: {
    readonly target: Record<string, unknown>;
    readonly segments: readonly (string | number)[];
  },
): Record<string, unknown> {
  /**
   * Cursor descending into each named container.
   */
  let cursor = target;
  for (const seg of segments) {
    /**
     * Key form so numeric header slots address by string like the parser.
     */
    const key = String(seg,);
    /**
     * Existing child; an array means descend into its last instance.
     */
    const existing = cursor[key];
    if (Array.isArray(existing,)) {
      cursor = nonNullishOrThrow(existing[existing.length
        - 1],) as Record<string, unknown>;
      continue;
    }
    if ((existing === null) || ((typeof existing) !== 'object')) {
      /**
       * Fresh table so the descent can continue.
       */
      const fresh: Record<string, unknown> = {};
      cursor[key] = fresh;
      cursor = fresh;
      continue;
    }
    cursor = existing as Record<string, unknown>;
  }
  return cursor;
}
