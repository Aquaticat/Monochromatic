// Fixture: documented function with documented local declarations.
// Expected: zero tsdoc(require-tsdoc) violations.
// For-loop bindings (`for (const v of values)`) are intentionally undocumented to confirm exemption.

/**
 * Adds an offset to each input.
 *
 * @param values - inputs to shift
 *
 * @param offset - value to add
 *
 * @returns shifted values
 *
 * @example
 * ```ts
 * shift([1, 2], 3);
 * ```
 */
function shift(values: readonly number[], offset: number,): number[] {
  /**
   * Accumulated shifted values.
   */
  const out: number[] = [];
  /**
   * Number of values processed so far.
   */
  let count = 0;
  for (const v of values) {
    /**
     * Single shifted value, pushed once per iteration.
     */
    const next = v + offset;
    out.push(next,);
    count++;
  }
  if (count === 0) {
    /**
     * Sentinel marking the no-input branch.
     */
    const empty = true;
    return empty ? [] : out;
  }
  return out;
}

export { shift, };
