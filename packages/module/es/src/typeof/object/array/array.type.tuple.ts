/**
 * Creates a fixed-length tuple type with the specified element type and count.
 * Supports tuples up to length 10, falling back to array type for larger counts.
 * For count 0, returns never[] to indicate an empty, impossible array.
 *
 * @template T_element - Type of elements in the tuple
 * @template T_count - Length of the tuple (0-10)
 *
 * @example
 * ```ts
 * type StringPair = Tuple<string, 2>; // [string, string]
 * type NumberTrio = Tuple<number, 3>; // [number, number, number]
 * type Empty = Tuple<any, 0>; // never[]
 * type Large = Tuple<boolean, 15>; // boolean[] (fallback to array)
 * ```
 */
export type Tuple<
  T_element,
  T_count extends number,
> = T_count extends 0 ? never[]
  : T_count extends 1 ? [T_element,]
  : T_count extends 2 ? [T_element, T_element,]
  : T_count extends 3 ? [T_element, T_element, T_element,]
  : T_count extends 4 ? [
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 5 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 6 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 7 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 8 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 9 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 10 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_element[];
