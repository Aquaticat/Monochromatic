/**
 * Asserts that a value is not `null` or `undefined`, returning it with a narrowed type.
 *
 * Replaces the non-null assertion operator (`!`) with a runtime check that throws
 * instead of silently producing incorrect behavior.
 *
 * @param value - Value to assert as non-nullish
 *
 * @returns Same value with `null | undefined` removed from the type
 *
 * @throws Error when value is `null` or `undefined`
 *
 * @example
 * DOM element lookup:
 * ```ts
 * const el = $(document.querySelector('.my-element'));
 * // el is now Element, not Element | null
 * ```
 *
 * @example
 * Optional chaining replacement:
 * ```ts
 * const path: string = $(await findUp('index.html'));
 * // path is string, not string | undefined
 * ```
 *
 * @example
 * Regex match groups:
 * ```ts
 * const match = text.match(/pattern/);
 * const group = $(match?.[1]);
 * ```
 */
export function $<T,>(value: T | null | undefined,): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected non-nullish value, got ${String(value,)}`,);
  }
  return value;
}
