/**
 * Fixture separating a freshly built pair from a pair the receiver holds.
 *
 * `resultExposesMutableState` calls a tuple type argument state-carrying without
 * looking inside it, which is why `entries()` over a fully primitive map keeps
 * reporting. Recursing into the tuple's own elements looks like the obvious fix and
 * is only sound for a tuple the member builds. A tuple the receiver already holds is
 * caller-owned state whatever its elements are, because the tuple itself is writable.
 *
 * @module
 */

/**
 * Pair the receiver stores, whose positions are primitive and whose identity is not.
 */
type StoredPair = [string, string,];

/**
 * Rewrites a pair the receiver holds, reached through an iterator.
 *
 * The counterexample. Every position of `StoredPair` is a `string`, so a rule that
 * unwrapped the tuple would find nothing caller-owned coming back and discharge the
 * call. The tuple itself is the receiver's own element, so `pair[0] = ...` writes
 * into `rows`, and discharging here would offer `rows` as read-only while this body
 * rewrites it.
 *
 * @param rows - Pairs whose first position is rewritten in place.
 *
 * @example
 * ```ts
 * rewriteStoredPair([],);
 * ```
 */
export function rewriteStoredPair(rows: readonly StoredPair[],): void {
  for (const pair of rows.values())
    pair[0] = 'rewritten';
}

/**
 * Reads a pair the receiver holds without writing it.
 *
 * The control. Same receiver, same iterator, no write. Whatever the rule decides
 * about the shape, this one is allowed to be offered and the one above is not, so a
 * change that makes both silent has answered the wrong question.
 *
 * @param rows - Pairs whose first position is measured.
 *
 * @returns total first-position length.
 *
 * @example
 * ```ts
 * readStoredPair([],);
 * ```
 */
export function readStoredPair(rows: readonly StoredPair[],): number {
  /**
   * Running total across every stored pair.
   */
  const measured = { total: 0, };
  for (const pair of rows.values())
    measured.total += pair[0].length;
  return measured.total;
}

/**
 * Rewrites a held pair reached from a plainly mutable array.
 *
 * The offer-visible form of `rewriteStoredPair`. A `readonly StoredPair[]` parameter
 * has no wider read-only type to suggest, so the loss of a report there shows only as
 * silence. A mutable array does have one, so if the analysis stops seeing this write
 * the parameter becomes offerable and the unsoundness is visible rather than implied.
 *
 * @param rows - Pairs whose first position is rewritten in place.
 *
 * @example
 * ```ts
 * rewriteMutableStoredPair([],);
 * ```
 */
export function rewriteMutableStoredPair(rows: StoredPair[],): void {
  for (const pair of rows.values())
    pair[0] = 'rewritten';
}
