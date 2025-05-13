export function union(...arrays: never[]): Set<never>;
export function union<const Param1,>(...arrays: [Iterable<Param1>]): Set<Param1>;
export function union<const Param1, const Param2,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>]
): Set<Param1 | Param2>;
export function union<const Param1, const Param2, const Param3,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>]
): Set<Param1 | Param2 | Param3>;
export function union<const Param1, const Param2, const Param3, const Param4,>(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>]
): Set<Param1 | Param2 | Param3 | Param4>;
export function union<const Param1, const Param2, const Param3, const Param4,
  const Param5,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5>;
export function union<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6>;
export function union<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7>;
export function union<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8>;
export function union<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9,>(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
    Iterable<Param8>,
    Iterable<Param9>,
  ]
): Set<Param1 | Param2 | Param3 | Param4 | Param5 | Param6 | Param7 | Param8 | Param9>;
export function union<const T,>(...arrays: Iterable<T>[]): Set<T>;
export function union(...arrays: Iterable<unknown>[]): Set<unknown> {
  if (arrays.length === 0) {
    return new Set();
  }
  const trueArrays: unknown[][] = arrays.map(
    function toArray(array: Iterable<unknown>): unknown[] {
      return Array.isArray(array) ? array : [...array];
    },
  );
  const flatArray: unknown[] = trueArrays.flat();
  return new Set(flatArray);
}
