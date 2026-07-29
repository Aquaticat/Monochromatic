/**
 * Bounded primitive tests every persisted-payload check is built from.
 *
 * Split from `effect-summary-cache-validation.ts` for the line budget, on the seam between
 * asking whether a value is a bounded index and asking whether a record is a call edge. The
 * dependency runs one way, from the record tests to these, so nothing here knows what a
 * summary is and everything above it does.
 *
 * @module
 */

/**
 * Maximum supported callable parameter or argument count.
 */
export const MAX_CALLABLE_ARITY = 65_535;

/**
 * Maximum retained cache string length.
 */
export const MAX_CACHE_STRING_LENGTH = 65_535;

/**
 * Tests whether unknown value is property-bearing record.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether direct string properties can be inspected.
 *
 * @example
 * ```ts
 * if (isRecord(parsed,)) readFields(parsed,);
 * ```
 */
export function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Tests bounded nonnegative integer.
 *
 * @param value - Parsed JSON value.
 *
 * @param upperBound - Exclusive maximum.
 *
 * @returns whether value is valid index.
 *
 * @example
 * ```ts
 * isIndex({ value: parsed.receiverSlot, upperBound: slotCount, },);
 * ```
 */
export function isIndex({
  value,
  upperBound,
}: {
  readonly value: unknown;
  readonly upperBound: number;
}): boolean {
  return ((typeof value) === 'number')
    && Number.isInteger(value,)
    && (value >= 0)
    && (value < upperBound);
}

/**
 * Tests bounded cache string.
 *
 * @param value - Parsed JSON value.
 *
 * @returns whether string length fits cache policy.
 *
 * @example
 * ```ts
 * if (!isCacheString(parsed.calleeKey,)) return false;
 * ```
 */
export function isCacheString(value: unknown,): value is string {
  return ((typeof value) === 'string')
    && (value.length <= MAX_CACHE_STRING_LENGTH);
}

/**
 * Tests unique bounded-index array.
 *
 * Used for both parameter positions and effect slots, which is why the bound is a plain
 * argument: the two share a representation and differ only in what bounds them, and passing
 * the wrong one here would accept a payload whose numbers point outside the callable.
 *
 * @param value - Parsed JSON value.
 *
 * @param upperBound - Exclusive index limit.
 *
 * @returns whether array contains only unique valid indexes.
 *
 * @example
 * ```ts
 * isBoundedIndexes({ value: parsed.mutated, upperBound: slotCount, },);
 * ```
 */
export function isBoundedIndexes({
  value,
  upperBound,
}: {
  readonly value: unknown;
  readonly upperBound: number;
}): boolean {
  if ((!Array.isArray(value,)) || (value.length > upperBound))
    return false;
  /**
   * Parsed indexes narrowed from JSON array.
   */
  const indexes: readonly unknown[] = value;
  /**
   * Seen indexes rejecting duplicate cache amplification.
   */
  const seen = new Set<number>();
  for (const index of indexes) {
    if (((typeof index) !== 'number')
      || (!isIndex({
        value: index,
        upperBound,
      },))
      || seen.has(index,))
      return false;
    seen.add(index,);
  }
  return true;
}
