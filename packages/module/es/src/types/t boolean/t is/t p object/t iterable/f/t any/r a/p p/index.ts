export function $<const MyValue,>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Might be Iterable
  return typeof (value as any)?.[Symbol.asyncIterator] === 'function';
}
