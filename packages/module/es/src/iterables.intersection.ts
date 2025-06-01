export function intersectionIterables(...arrays: never[]): Set<never>;
export function intersectionIterables<const Param1, >(...arrays: [Iterable<Param1>]): Set<Param1>;
export function intersectionIterables<const Param1, const Param2, >(
  ...arrays: [Iterable<Param1>, Iterable<Param2>]
): Set<Param1 & Param2>;
export function intersectionIterables<const Param1, const Param2, const Param3, >(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>]
): Set<Param1 & Param2 & Param3>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4, >(
  ...arrays: [Iterable<Param1>, Iterable<Param2>, Iterable<Param3>, Iterable<Param4>]
): Set<Param1 & Param2 & Param3 & Param4>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, >(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, >(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, >(
  ...arrays: [
    Iterable<Param1>,
    Iterable<Param2>,
    Iterable<Param3>,
    Iterable<Param4>,
    Iterable<Param5>,
    Iterable<Param6>,
    Iterable<Param7>,
  ]
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, >(
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
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8>;
export function intersectionIterables<const Param1, const Param2, const Param3, const Param4,
  const Param5, const Param6, const Param7, const Param8, const Param9, >(
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
): Set<Param1 & Param2 & Param3 & Param4 & Param5 & Param6 & Param7 & Param8 & Param9>;
export function intersectionIterables<const T, >(...arrays: Iterable<T>[]): Set<T>;
export function intersectionIterables(...arrays: Iterable<unknown>[]): Set<unknown> {
  if (arrays.length === 0) {
    return new Set();
  }

  if (arrays.length === 1) {
    return new Set(arrays[0]);
  }

  // Start with the first iterable as candidates
  const candidates = new Set(arrays[0]);

  // Empty set short-circuit
  if (candidates.size === 0) {
    return candidates;
  }

  // For each subsequent iterable
  for (const otherArray of arrays.slice(1)) {
    // Short-circuit if no candidates remain
    if (candidates.size === 0) {
      return candidates;
    }

    const currentSet = new Set(otherArray);

    // If current iterable is empty, intersection is empty
    if (currentSet.size === 0) {
      candidates.clear();
      return candidates;
    }

    // Remove items from candidates that don't exist in current set
    for (const item of candidates) {
      if (!currentSet.has(item)) {
        candidates.delete(item);
      }
    }
  }

  return candidates;
}

// TODO: Write async version.
