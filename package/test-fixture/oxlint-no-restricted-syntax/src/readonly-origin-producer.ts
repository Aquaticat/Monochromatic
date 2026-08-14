//region Cross-file producer

/**
 * Produces inferred mutable rows in separate source.
 *
 * @param values - Primitive source values.
 *
 * @returns newly inferred row collection.
 *
 * @example
 * ```ts
 * crossFileRows([1]);
 * ```
 */
export function crossFileRows(values: readonly number[],) {
  return values.map(function toCrossFileRow(value,) {
    return { value, };
  },);
}

//endregion Cross-file producer
