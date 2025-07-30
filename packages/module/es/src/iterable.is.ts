import type { UnknownRecord, } from 'type-fest';

/**
 * Type guard that checks if a value is an array.
 * This is a re-export of the native Array.isArray method for consistency with other type guards.
 *
 * @param value - Value to check
 * @returns True if value is an array, false otherwise
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const notArr = 'hello';
 *
 * console.log(isArray(arr)); // true
 * console.log(isArray(notArr)); // false
 * console.log(isArray(new Set([1, 2]))); // false
 * ```
 */
export const isArray: typeof Array.isArray = Array.isArray;

/**
 * Tests if a value is an Iterable but not an AsyncIterable.
 * This function specifically checks for synchronous iterables by looking for the Symbol.iterator method.
 * It will return false for AsyncIterables even though they may also have Symbol.iterator.
 *
 * @param value - Value to check for Iterable interface
 * @returns True if value implements Iterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Arrays are iterable
 * console.log(isIterable([1, 2, 3])); // true
 * console.log(isIterable('hello')); // true
 * console.log(isIterable(new Set([1, 2]))); // true
 * console.log(isIterable(new Map([['a', 1]]))); // true
 *
 * // Non-iterables
 * console.log(isIterable(42)); // false
 * console.log(isIterable({})); // false
 * console.log(isIterable(null)); // false
 *
 * // Generator functions return iterables
 * function* gen() { yield 1; }
 * console.log(isIterable(gen())); // true
 * ```
 */
export function isIterable(
  value: unknown,
): value is Iterable<any> {
  return value !== null
    && value !== undefined
    && typeof (value as any)[Symbol.iterator] === 'function';
}

/**
 * Tests if a value is an AsyncIterable.
 * This function checks for the Symbol.asyncIterator method to determine if a value
 * can be used in async iteration contexts like `for await...of` loops.
 *
 * @param value - Value to check for AsyncIterable interface
 * @returns True if value implements AsyncIterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Async generators are async iterable
 * async function* asyncGen() { yield 1; yield 2; }
 * console.log(isAsyncIterable(asyncGen())); // true
 *
 * // Regular iterables aren't async iterable
 * console.log(isAsyncIterable([1, 2, 3])); // false
 * console.log(isAsyncIterable('hello')); // false
 *
 * // Non-iterables
 * console.log(isAsyncIterable(42)); // false
 * console.log(isAsyncIterable({})); // false
 *
 * // Custom async iterable
 * const customAsyncIterable = {
 *   async *[Symbol.asyncIterator]() {
 *     yield 1; yield 2;
 *   }
 * };
 * console.log(isAsyncIterable(customAsyncIterable)); // true
 * ```
 */
export function isAsyncIterable(
  value: unknown,
): value is AsyncIterable<any> {
  return value !== null
    && value !== undefined
    && typeof (value as any)[Symbol.asyncIterator] === 'function';
}

/**
 * Tests if a value is either an Iterable or an AsyncIterable.
 * This function checks for both Symbol.iterator and Symbol.asyncIterator methods,
 * making it useful for functions that can handle both sync and async iteration.
 *
 * @param value - Value to check for either Iterable or AsyncIterable interface
 * @returns True if value implements Iterable<any> or AsyncIterable<any>, false otherwise
 *
 * @example
 * ```ts
 * // Sync iterables
 * console.log(isMaybeAsyncIterable([1, 2, 3])); // true
 * console.log(isMaybeAsyncIterable('hello')); // true
 * console.log(isMaybeAsyncIterable(new Set([1]))); // true
 *
 * // Async iterables
 * async function* asyncGen() { yield 1; }
 * console.log(isMaybeAsyncIterable(asyncGen())); // true
 *
 * // Non-iterables
 * console.log(isMaybeAsyncIterable(42)); // false
 * console.log(isMaybeAsyncIterable({})); // false
 * console.log(isMaybeAsyncIterable(null)); // false
 *
 * // Useful for generic iteration functions
 * function processIterable(data: unknown) {
 *   if (isMaybeAsyncIterable(data)) {
 *     // Can safely iterate over data
 *     return data;
 *   }
 *   throw new Error('Not iterable');
 * }
 * ```
 */
export function isMaybeAsyncIterable(
  value: unknown,
): value is Iterable<any> | AsyncIterable<any> {
  return value !== null
    && value !== undefined
    && (typeof (value as any)[Symbol.iterator] === 'function'
      || typeof (value as any)[Symbol.asyncIterator] === 'function');
}

/**
 * Tests if a value is a Map instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 * Special handling in includesArrayLike for performance optimization.
 *
 * @param value - Value to check for Map type
 * @returns True if value is a Map instance, false otherwise
 *
 * @example
 * ```ts
 * const map = new Map([['key', 'value']]);
 * const weakMap = new WeakMap();
 * const obj = { key: 'value' };
 *
 * console.log(isMap(map)); // true
 * console.log(isMap(weakMap)); // false
 * console.log(isMap(obj)); // false
 * console.log(isMap([])); // false
 * console.log(isMap(new Set())); // false
 *
 * // Works with Maps from different contexts
 * const iframe = document.createElement('iframe');
 * document.body.appendChild(iframe);
 * const iframeMap = new iframe.contentWindow.Map();
 * console.log(isMap(iframeMap)); // true
 * ```
 */
export function isMap(value: unknown,): value is Map<any, any> {
  return Object.prototype.toString.call(value,) === '[object Map]';
}

/**
 * Tests if a value is a WeakMap instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 *
 * @param value - Value to check for WeakMap type
 * @returns True if value is a WeakMap instance, false otherwise
 *
 * @example
 * ```ts
 * const weakMap = new WeakMap();
 * const map = new Map();
 * const obj = {};
 *
 * console.log(isWeakMap(weakMap)); // true
 * console.log(isWeakMap(map)); // false
 * console.log(isWeakMap(obj)); // false
 * console.log(isWeakMap(null)); // false
 *
 * // WeakMaps can only have object keys
 * const key = {};
 * weakMap.set(key, 'value');
 * console.log(isWeakMap(weakMap)); // true
 * ```
 */
export function isWeakMap(
  value: unknown,
): value is WeakMap<any, any> {
  return Object.prototype.toString.call(value,) === '[object WeakMap]';
}

/**
 * Tests if a value is a Set instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 * Special handling in includesArrayLike for performance optimization.
 *
 * @param value - Value to check for Set type
 * @returns True if value is a Set instance, false otherwise
 *
 * @example
 * ```ts
 * const set = new Set([1, 2, 3]);
 * const weakSet = new WeakSet();
 * const arr = [1, 2, 3];
 *
 * console.log(isSet(set)); // true
 * console.log(isSet(weakSet)); // false
 * console.log(isSet(arr)); // false
 * console.log(isSet({})); // false
 *
 * // Sets are iterable
 * console.log(isIterable(set)); // true
 * for (const item of set) {
 *   console.log(item); // 1, 2, 3
 * }
 * ```
 */
export function isSet(value: unknown,): value is Set<any> {
  return Object.prototype.toString.call(value,) === '[object Set]';
}

/**
 * Tests if a value is a WeakSet instance.
 * Uses Object.prototype.toString for reliable type checking that works across different contexts.
 *
 * @param value - Value to check for WeakSet type
 * @returns True if value is a WeakSet instance, false otherwise
 *
 * @example
 * ```ts
 * const weakSet = new WeakSet();
 * const set = new Set();
 * const arr = [];
 *
 * console.log(isWeakSet(weakSet)); // true
 * console.log(isWeakSet(set)); // false
 * console.log(isWeakSet(arr)); // false
 * console.log(isWeakSet({})); // false
 *
 * // WeakSets can only contain objects
 * const obj = {};
 * weakSet.add(obj);
 * console.log(isWeakSet(weakSet)); // true
 * ```
 */
export function isWeakSet(value: unknown,): value is WeakSet<any> {
  return Object.prototype.toString.call(value,) === '[object WeakSet]';
}

/**
 * Tests if a value is a plain object (not an array, function, or other object type).
 * Uses Object.prototype.toString to check for '[object Object]' which indicates a plain object.
 *
 * @param value - Value to check for plain object type
 * @returns True if value is a plain object, false otherwise
 *
 * @example
 * ```ts
 * const plainObj = { key: 'value' };
 * const arr = [1, 2, 3];
 * const func = () => {};
 * const date = new Date();
 *
 * console.log(isObject(plainObj)); // true
 * console.log(isObject(arr)); // false
 * console.log(isObject(func)); // false
 * console.log(isObject(date)); // false
 * console.log(isObject(null)); // false
 * console.log(isObject(undefined)); // false
 *
 * // Object literals and Object.create(null)
 * console.log(isObject({})); // true
 * console.log(isObject(Object.create(null))); // false (no prototype)
 * console.log(isObject(new Object())); // true
 * ```
 */
export function isObject(value: unknown,): value is UnknownRecord {
  return Object.prototype.toString.call(value,) === '[object Object]';
}

/**
 * Tests if a value is an AsyncGenerator instance.
 * AsyncGenerators are created by async generator functions and can be used with `for await...of`.
 *
 * @param value - Value to check for AsyncGenerator type
 * @returns True if value is an AsyncGenerator instance, false otherwise
 *
 * @example
 * ```ts
 * async function* asyncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * function* syncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const asyncGen = asyncGenFunc();
 * const syncGen = syncGenFunc();
 *
 * console.log(isAsyncGenerator(asyncGen)); // true
 * console.log(isAsyncGenerator(syncGen)); // false
 * console.log(isAsyncGenerator([1, 2])); // false
 *
 * // AsyncGenerators are also async iterable
 * console.log(isAsyncIterable(asyncGen)); // true
 *
 * // Usage with for await...of
 * for await (const value of asyncGenFunc()) {
 *   console.log(value); // 1, 2
 * }
 * ```
 */
export function isAsyncGenerator(
  value: unknown,
): value is AsyncGenerator {
  return Object.prototype.toString.call(value,) === '[object AsyncGenerator]';
}

/**
 * Tests if a value is a Generator instance.
 * Generators are created by generator functions and can be used with `for...of` loops.
 *
 * @param value - Value to check for Generator type
 * @returns True if value is a Generator instance, false otherwise
 *
 * @example
 * ```ts
 * function* genFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * async function* asyncGenFunc() {
 *   yield 1;
 *   yield 2;
 * }
 *
 * const gen = genFunc();
 * const asyncGen = asyncGenFunc();
 *
 * console.log(isGenerator(gen)); // true
 * console.log(isGenerator(asyncGen)); // false
 * console.log(isGenerator([1, 2])); // false
 * console.log(isGenerator('hello')); // false
 *
 * // Generators are iterable
 * console.log(isIterable(gen)); // true
 *
 * // Usage with for...of
 * for (const value of genFunc()) {
 *   console.log(value); // 1, 2
 * }
 * ```
 */
export function isGenerator(
  value: unknown,
): value is Generator {
  return Object.prototype.toString.call(value,) === '[object Generator]';
}

/**
 * Tests if a value is an empty array.
 * This is a type guard that narrows the type to never[] when true.
 *
 * @param value - Value to check for empty array
 * @returns True if value is an array with length 0, false otherwise
 *
 * @example
 * ```ts
 * const empty = [];
 * const notEmpty = [1, 2, 3];
 * const notArray = 'hello';
 *
 * console.log(isEmptyArray(empty)); // true
 * console.log(isEmptyArray(notEmpty)); // false
 * console.log(isEmptyArray(notArray)); // false
 * console.log(isEmptyArray(null)); // false
 *
 * // Type narrowing
 * function processArray(arr: unknown) {
 *   if (isEmptyArray(arr)) {
 *     // arr is now typed as never[]
 *     console.log('Empty array with length:', arr.length); // 0
 *   }
 * }
 * ```
 */
export function isEmptyArray(value: unknown,): value is never[] {
  return isArray(value,) && value.length === 0;
}

/**
 * Tests if an array is empty.
 * This function assumes the input is already known to be an array and checks its length.
 *
 * @param value - Array to check for emptiness
 * @returns True if array has length 0, false otherwise
 *
 * @example
 * ```ts
 * const empty: number[] = [];
 * const notEmpty = [1, 2, 3];
 * const mixed: (string | number)[] = [];
 *
 * console.log(isArrayEmpty(empty)); // true
 * console.log(isArrayEmpty(notEmpty)); // false
 * console.log(isArrayEmpty(mixed)); // true
 *
 * // Useful for array processing
 * function processKnownArray(arr: readonly any[]) {
 *   if (isArrayEmpty(arr)) {
 *     console.log('Nothing to process');
 *     return;
 *   }
 *   // Process non-empty array
 *   arr.forEach(item => console.log(item));
 * }
 * ```
 */
export function isArrayEmpty(
  value: readonly any[],
): value is never[] {
  return value.length === 0;
}

/**
 * Tests if an array is non-empty and narrows the type to a tuple with at least one element.
 * This is a type guard that ensures the array has at least one element.
 *
 * @param value - Array to check for non-emptiness
 * @returns True if array has length > 0, false otherwise
 *
 * @example
 * ```ts
 * const empty: number[] = [];
 * const notEmpty = [1, 2, 3];
 * const single = ['hello'];
 *
 * console.log(isArrayNonEmpty(empty)); // false
 * console.log(isArrayNonEmpty(notEmpty)); // true
 * console.log(isArrayNonEmpty(single)); // true
 *
 * // Type narrowing to [T, ...T[]]
 * function processArray(arr: readonly number[]) {
 *   if (isArrayNonEmpty(arr)) {
 *     // arr is now typed as [number, ...number[]]
 *     const first = arr[0]; // Safe access to first element
 *     const rest = arr.slice(1); // Rest of the elements
 *     console.log('First:', first, 'Rest:', rest);
 *   }
 * }
 * ```
 */
export function isArrayNonEmpty<const T,>(
  value: readonly T[],
): value is [T, ...T[],] {
  return Array.isArray(value,) && value.length > 0;
}

/**
 * Tests if a value is a non-empty array and narrows the type accordingly.
 * This function first checks if the value is an array, then checks if it's non-empty.
 *
 * @param value - Value to check for non-empty array
 * @returns True if value is an array with length > 0, false otherwise
 *
 * @example
 * ```ts
 * const arr = [1, 2, 3];
 * const empty: number[] = [];
 * const notArray = 'hello';
 *
 * console.log(isNonEmptyArray(arr)); // true
 * console.log(isNonEmptyArray(empty)); // false
 * console.log(isNonEmptyArray(notArray)); // false
 * console.log(isNonEmptyArray(null)); // false
 *
 * // Type narrowing from unknown
 * function processUnknown(value: unknown) {
 *   if (isNonEmptyArray(value)) {
 *     // value is now typed as [Element, ...Element[]]
 *     const first = value[0]; // Safe access
 *     console.log('First element:', first);
 *   }
 * }
 * ```
 */
export function isNonEmptyArray<const T_value,>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value,) && value.length > 0;
}

/**
 * Tests if a value is a non-empty array with enhanced type inference.
 * Similar to isNonEmptyArray but with different generic constraints for better type inference.
 *
 * @param value - Value to check for non-empty array
 * @returns True if value is an array with length > 0, false otherwise
 *
 * @example
 * ```ts
 * const numbers = [1, 2, 3];
 * const strings = ['a', 'b'];
 * const empty: string[] = [];
 * const notArray = { length: 1 };
 *
 * console.log(arrayIsNonEmpty(numbers)); // true
 * console.log(arrayIsNonEmpty(strings)); // true
 * console.log(arrayIsNonEmpty(empty)); // false
 * console.log(arrayIsNonEmpty(notArray)); // false
 *
 * // Enhanced type inference
 * function processValue<T extends readonly any[]>(value: T | unknown) {
 *   if (arrayIsNonEmpty(value)) {
 *     // Better type inference for the array elements
 *     value.forEach(item => console.log(item));
 *   }
 * }
 * ```
 */
export function arrayIsNonEmpty<
  T_value extends readonly any[],
>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value,) && value.length > 0;
}

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

// Impossible.
// export type ArrayNonFixedLength = ArrayFixedLengthOrNever<any>;

/**
 * Type utility that determines if an array type has a fixed length.
 * Returns true for tuples and fixed-length arrays, false for variable-length arrays.
 *
 * @example
 * ```ts
 * type Test1 = IsArrayFixedLength<[1, 2, 3]>; // true
 * type Test2 = IsArrayFixedLength<number[]>; // false
 * type Test3 = IsArrayFixedLength<readonly [string]>; // true
 * type Test4 = IsArrayFixedLength<Array<boolean>>; // false
 * type Test5 = IsArrayFixedLength<[]>; // true
 *
 * // Usage in conditional logic
 * function handleArray<T extends readonly unknown[]>(
 *   arr: T
 * ): IsArrayFixedLength<T> extends true ? 'fixed length' : 'variable length' {
 *   return (typeof arr.length === 'number' ? 'fixed length' : 'variable length') as any;
 * }
 * ```
 */
export type IsArrayFixedLength<T extends readonly unknown[],> = number extends T['length']
  ? false
  : true;

/**
 * Tests if an array has exactly one element.
 * This is a type guard that narrows the type to a single-element tuple.
 *
 * @param value - Array to check for single element
 * @returns True if array has exactly one element, false otherwise
 *
 * @example
 * ```ts
 * const single = ['hello'];
 * const empty: string[] = [];
 * const multiple = [1, 2, 3];
 *
 * console.log(isArrayOfLength1(single)); // true
 * console.log(isArrayOfLength1(empty)); // false
 * console.log(isArrayOfLength1(multiple)); // false
 *
 * // Type narrowing to [T]
 * function processSingleItem<T>(arr: readonly T[]) {
 *   if (isArrayOfLength1(arr)) {
 *     // arr is now typed as readonly [T]
 *     const onlyItem = arr[0]; // Safe access to the single element
 *     console.log('Single item:', onlyItem);
 *   }
 * }
 *
 * // Useful for validation
 * function requireSingleValue<T>(values: T[]): T {
 *   if (isArrayOfLength1(values)) {
 *     return values[0];
 *   }
 *   throw new Error('Expected exactly one value');
 * }
 * ```
 */
export function isArrayOfLength1<const T,>(
  value: readonly T[],
): value is readonly [T,] {
  return Array.isArray(value,) && value.length === 1;
}
