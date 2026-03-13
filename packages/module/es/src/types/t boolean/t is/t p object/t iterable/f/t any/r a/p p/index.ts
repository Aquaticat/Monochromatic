export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Might be Iterable
  return typeof (value as any)?.[Symbol.asyncIterator] === 'function';
}
