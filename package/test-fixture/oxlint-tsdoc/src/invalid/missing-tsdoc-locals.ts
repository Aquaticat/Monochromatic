// Fixture: documented function with undocumented local declarations.
// Expected violations: tsdoc(require-tsdoc) on each local const/let, not on for-loop bindings.

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
  const out: number[] = [];
  let count = 0;
  for (const v of values) {
    const next = v + offset;
    out.push(next,);
    count++;
  }
  if (count === 0) {
    const empty = true;
    return empty ? [] : out;
  }
  return out;
}

export { shift, };
