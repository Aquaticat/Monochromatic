export function $<const MyValue>(
  value: MyValue,
): value is MyValue extends AsyncIterable<infer T> ? MyValue & AsyncIterable<T> : never {
    return typeof (value as any)?.[Symbol.asyncIterator] === 'function';
}
