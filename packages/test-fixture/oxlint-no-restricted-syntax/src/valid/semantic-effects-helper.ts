/**
 * Clears caller-owned set through cross-file helper.
 *
 * @param values - Shared set cleared by helper.
 */
export function clearSemanticEffectFixture(values: Set<string>,): void {
  values.clear();
}

/**
 * Invokes callback with caller-owned value.
 *
 * @param value - Value forwarded to callback.
 *
 * @param visitor - Callback receiving value.
 */
export function visitSemanticEffectFixture<T>(
  value: T,
  visitor: (value: T) => void,
): void {
  visitor(value,);
}
