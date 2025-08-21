/**
 * Removes the first element from an array or tuple type, returning the remaining elements.
 * Handles both mutable and readonly arrays, with fallback support for generic array types.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst<[string, number, boolean]>; // [number, boolean]
 * type Example2 = WithoutFirst<[string]>; // []
 * type Example3 = WithoutFirst<[]>; // never
 * type Example4 = WithoutFirst<string[]>; // string[]
 * type Example5 = WithoutFirst<readonly [number, string]>; // [string]
 * ```
 */
export type WithoutFirst<T extends any[],> = T extends [any, ...infer Rest,] ? Rest
  : T extends readonly [any, ...infer Rest,] ? Rest
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first two elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst2<[string, number, boolean, object]>; // [boolean, object]
 * type Example2 = WithoutFirst2<[string, number]>; // []
 * type Example3 = WithoutFirst2<[string]>; // []
 * type Example4 = WithoutFirst2<string[]>; // string[]
 * ```
 */
export type WithoutFirst2<T extends any[],> = T extends [any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, ...infer Rest,] ? Rest
  : T extends [any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first three elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst3<[string, number, boolean, object, symbol]>; // [object, symbol]
 * type Example2 = WithoutFirst3<[string, number, boolean]>; // []
 * type Example3 = WithoutFirst3<[string, number]>; // []
 * type Example4 = WithoutFirst3<string[]>; // string[]
 * ```
 */
export type WithoutFirst3<T extends any[],> = T extends [any, any, any, ...infer Rest,]
  ? Rest
  : T extends readonly [any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first four elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst4<[1, 2, 3, 4, 5, 6]>; // [5, 6]
 * type Example2 = WithoutFirst4<[1, 2, 3, 4]>; // []
 * type Example3 = WithoutFirst4<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst4<number[]>; // number[]
 * ```
 */
export type WithoutFirst4<T extends any[],> = T extends
  [any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first five elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst5<[1, 2, 3, 4, 5, 6, 7]>; // [6, 7]
 * type Example2 = WithoutFirst5<[1, 2, 3, 4, 5]>; // []
 * type Example3 = WithoutFirst5<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst5<boolean[]>; // boolean[]
 * ```
 */
export type WithoutFirst5<T extends any[],> = T extends
  [any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first six elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst6<[1, 2, 3, 4, 5, 6, 7, 8]>; // [7, 8]
 * type Example2 = WithoutFirst6<[1, 2, 3, 4, 5, 6]>; // []
 * type Example3 = WithoutFirst6<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst6<string[]>; // string[]
 * ```
 */
export type WithoutFirst6<T extends any[],> = T extends
  [any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, any, any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst5<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first seven elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst7<[1, 2, 3, 4, 5, 6, 7, 8, 9]>; // [8, 9]
 * type Example2 = WithoutFirst7<[1, 2, 3, 4, 5, 6, 7]>; // []
 * type Example3 = WithoutFirst7<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst7<object[]>; // object[]
 * ```
 */
export type WithoutFirst7<T extends any[],> = T extends
  [any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, any, any, any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst5<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst6<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first eight elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst8<[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]>; // [9, 10]
 * type Example2 = WithoutFirst8<[1, 2, 3, 4, 5, 6, 7, 8]>; // []
 * type Example3 = WithoutFirst8<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst8<symbol[]>; // symbol[]
 * ```
 */
export type WithoutFirst8<T extends any[],> = T extends
  [any, any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends [any, any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst<Rest>
  : T extends [any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, any, any, any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst5<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst6<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst7<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first nine elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst9<[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]>; // [10, 11]
 * type Example2 = WithoutFirst9<[1, 2, 3, 4, 5, 6, 7, 8, 9]>; // []
 * type Example3 = WithoutFirst9<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst9<Date[]>; // Date[]
 * ```
 */
export type WithoutFirst9<T extends any[],> = T extends
  [any, any, any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, any, ...infer Rest,]
    ? Rest
  : T extends [any, any, any, any, any, any, any, any, ...infer Rest,]
    ? WithoutFirst<Rest>
  : T extends [any, any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst2<Rest>
  : T extends [any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, any, any, any, any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst5<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst6<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst7<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst8<Rest>
  : T extends Array<infer U> ? U[]
  : never;

/**
 * Removes the first ten elements from an array or tuple type, returning the remaining elements.
 * Uses optimized direct extraction when possible, falling back to recursive WithoutFirst calls.
 *
 * @template T - Array or tuple type to process (extends any[])
 *
 * @example
 * ```ts
 * type Example1 = WithoutFirst10<[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]>; // [11, 12]
 * type Example2 = WithoutFirst10<[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]>; // []
 * type Example3 = WithoutFirst10<[1, 2, 3]>; // []
 * type Example4 = WithoutFirst10<Function[]>; // Function[]
 * ```
 */
export type WithoutFirst10<T extends any[],> = T extends
  [any, any, any, any, any, any, any, any, any, any, ...infer Rest,] ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, any, any, ...infer Rest,]
    ? Rest
  : T extends [any, any, any, any, any, any, any, any, any, ...infer Rest,]
    ? WithoutFirst<Rest>
  : T extends [any, any, any, any, any, any, any, any, ...infer Rest,]
    ? WithoutFirst2<Rest>
  : T extends [any, any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst3<Rest>
  : T extends [any, any, any, any, any, any, ...infer Rest,] ? WithoutFirst4<Rest>
  : T extends [any, any, any, any, any, ...infer Rest,] ? WithoutFirst5<Rest>
  : T extends [any, any, any, any, ...infer Rest,] ? WithoutFirst6<Rest>
  : T extends [any, any, any, ...infer Rest,] ? WithoutFirst7<Rest>
  : T extends [any, any, ...infer Rest,] ? WithoutFirst8<Rest>
  : T extends [any, ...infer Rest,] ? WithoutFirst9<Rest>
  : T extends Array<infer U> ? U[]
  : never;
