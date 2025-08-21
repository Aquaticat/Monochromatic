/**
 * Type utility that checks if a type is a tuple array (fixed-length array).
 * Returns true for empty arrays and arrays with known fixed length, false for variable-length arrays.
 *
 * @example
 * ```ts
 * type Test1 = IsTupleArray<[]>; // true
 * type Test2 = IsTupleArray<[number]>; // true
 * type Test3 = IsTupleArray<[string, number]>; // true
 * type Test4 = IsTupleArray<number[]>; // false
 * type Test5 = IsTupleArray<readonly [1, 2, 3]>; // true
 * type Test6 = IsTupleArray<Array<string>>; // false
 *
 * // Usage in generic constraints
 * function processTuple<T extends readonly unknown[]>(
 *   arr: T
 * ): IsTupleArray<T> extends true ? 'tuple' : 'array' {
 *   return (arr.length >= 0 ? 'tuple' : 'array') as any;
 * }
 * ```
 */
export type IsTupleArray<T,> = T extends readonly [] ? true
  : T extends readonly [unknown, ...readonly unknown[],] ? true
  : false;

/**
 * Type utility that extracts tuple arrays from a union type.
 * Returns the type if it's a tuple with at least one element, never otherwise.
 *
 * @example
 * ```ts
 * type Test1 = TupleArray<[number, string]>; // [number, string]
 * type Test2 = TupleArray<number[]>; // never
 * type Test3 = TupleArray<[]>; // never (empty tuple)
 * type Test4 = TupleArray<readonly [1, 2]>; // readonly [1, 2]
 *
 * // Usage in conditional types
 * type ProcessArray<T> = TupleArray<T> extends never
 *   ? 'not a non-empty tuple'
 *   : 'is a non-empty tuple';
 *
 * type Result1 = ProcessArray<[1, 2]>; // 'is a non-empty tuple'
 * type Result2 = ProcessArray<number[]>; // 'not a non-empty tuple'
 * ```
 */
export type TupleArray<T,> = T extends readonly [unknown, ...readonly [unknown,],] ? T
  : never;

/**
 * Type utility that extracts variable-length arrays from a type.
 * Returns the type if it's an array with variable length, never if it's a fixed-length tuple.
 *
 * @example
 * ```ts
 * type Test1 = ArrayNonFixedLengthOrNever<number[]>; // number[]
 * type Test2 = ArrayNonFixedLengthOrNever<[1, 2, 3]>; // never
 * type Test3 = ArrayNonFixedLengthOrNever<Array<string>>; // Array<string>
 * type Test4 = ArrayNonFixedLengthOrNever<readonly number[]>; // readonly number[]
 * type Test5 = ArrayNonFixedLengthOrNever<string>; // never
 *
 * // Usage for function overloads
 * function processArray<T>(arr: T):
 *   ArrayNonFixedLengthOrNever<T> extends never ? 'fixed' : 'variable';
 * ```
 */
export type ArrayNonFixedLengthOrNever<T,> = T extends readonly unknown[]
  ? number extends T['length'] ? T
  : never
  : never;

/**
 * Type utility that extracts fixed-length arrays (tuples) from a type.
 * Returns the type if it's a tuple with fixed length, never if it's a variable-length array.
 *
 * @example
 * ```ts
 * type Test1 = ArrayFixedLengthOrNever<[1, 2, 3]>; // [1, 2, 3]
 * type Test2 = ArrayFixedLengthOrNever<number[]>; // never
 * type Test3 = ArrayFixedLengthOrNever<readonly [string, number]>; // readonly [string, number]
 * type Test4 = ArrayFixedLengthOrNever<Array<boolean>>; // never
 * type Test5 = ArrayFixedLengthOrNever<[]>; // []
 *
 * // Usage for tuple-specific operations
 * function processTuple<T>(arr: T):
 *   ArrayFixedLengthOrNever<T> extends never ? 'not a tuple' : 'is a tuple';
 * ```
 */
export type ArrayFixedLengthOrNever<T,> = T extends readonly unknown[]
  ? number extends T['length'] ? never : T
  : never;

/**
 * Type utility that determines if an array type has a fixed length.
 * Returns true for tuples and fixed-length arrays, false for variable-length arrays and non-arrays.
 *
 * @example
 * ```ts
 * type Test1 = IsArrayFixedLength<[1, 2, 3]>; // true
 * type Test2 = IsArrayFixedLength<number[]>; // false
 * type Test3 = IsArrayFixedLength<readonly [string]>; // true
 * type Test4 = IsArrayFixedLength<Array<boolean>>; // false
 * type Test5 = IsArrayFixedLength<[]>; // true
 * type Test6 = IsArrayFixedLength<string>; // false
 * type Test7 = IsArrayFixedLength<null>; // false
 *
 * // Usage in conditional logic
 * function handleArray<T extends readonly unknown[]>(
 *   arr: T
 * ): IsArrayFixedLength<T> extends true ? 'fixed length' : 'variable length' {
 *   return (typeof arr.length === 'number' ? 'fixed length' : 'variable length') as any;
 * }
 * ```
 */
export type IsArrayFixedLength<T,> = T extends readonly unknown[]
  ? number extends T['length'] ? false : true
  : false;
