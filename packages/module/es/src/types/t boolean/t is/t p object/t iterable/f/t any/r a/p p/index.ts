/**
 * Type guard checking whether value implements `AsyncIterable`.
 *
 * @param value - value to check for async iterability
 *
 * @returns `true` when value has a `Symbol.asyncIterator` method
 *
 * @example
 * ```ts
 * $(async function* () { yield 1; }()); // true
 * $([1, 2, 3]); // false
 * ```
 */
export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
  // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- runtime check on unknown value shape
  return (typeof (value as any)?.[Symbol.asyncIterator]) === 'function';
}
