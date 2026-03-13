/**
 * Type guard checking whether value implements `AsyncIterable`.
 *
 * @param value - value to check for async iterability
 *
 * @returns `true` when value has a `Symbol.asyncIterator` method
 */
export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
  // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unnecessary-condition -- runtime check on unknown value shape
  return typeof (value as any)?.[Symbol.asyncIterator] === 'function';
}
