import type {
  UnknownMap,
  UnknownRecord,
  UnknownSet,
} from 'type-fest';
import type { UnknownArrayOrTuple } from 'type-fest/source/internal';
import { isEmptyArray } from './iterable.is.ts';

//region Type Assertion Guards -- Validates runtime values and throws TypeErrors for invalid inputs

/**
 * Asserts that value is not null or undefined.
 * Throws TypeError if value is nullish, otherwise returns value with nullish types excluded.
 * 
 * @param potentiallyNullish - to validate.
 * @returns Value with null and undefined types excluded.
 * @throws {TypeError} When value is null or undefined.
 * 
 * @example
 * ```ts
 * const value: string | null = getUserInput();
 * const nonNullish = notNullishOrThrow(value);
 * // nonNullish is typed as string
 * ```
 */
export function notNullishOrThrow<T,>(
  potentiallyNullish: T,
): Exclude<T, null | undefined> {
  if (potentiallyNullish === null || potentiallyNullish === undefined) {
    throw new TypeError(`${JSON.stringify(potentiallyNullish)} is nullish`);
  }
  return potentiallyNullish as Exclude<T, null | undefined>;
}

/**
 * Asserts that value is not undefined.
 * Throws TypeError if value is undefined, otherwise returns value with undefined type excluded.
 * 
 * @param potentiallyUndefined - to validate.
 * @returns Value with undefined type excluded.
 * @throws {TypeError} When value is undefined.
 * 
 * @example
 * ```ts
 * const value: string | undefined = getOptionalConfig();
 * const defined = notUndefinedOrThrow(value);
 * // defined is typed as string
 * ```
 */
export function notUndefinedOrThrow<T,>(
  potentiallyUndefined: T,
): Exclude<T, undefined> {
  if (potentiallyUndefined === undefined) {
    throw new TypeError(`${JSON.stringify(potentiallyUndefined)} is undefined`);
  }
  return potentiallyUndefined as Exclude<T, undefined>;
}

/**
 * Asserts that value is not null.
 * Throws TypeError if value is null, otherwise returns value with null type excluded.
 * 
 * @param potentiallyNull - to validate.
 * @returns Value with null type excluded.
 * @throws {TypeError} When value is null.
 * 
 * @example
 * ```ts
 * const value: string | null = getOptionalValue();
 * const notNull = notNullOrThrow(value);
 * // notNull is typed as string
 * ```
 */
export function notNullOrThrow<T,>(
  potentiallyNull: T,
): Exclude<T, null> {
  if (potentiallyNull === null) {
    throw new TypeError(`${JSON.stringify(potentiallyNull)} is null`);
  }
  return potentiallyNull as Exclude<T, null>;
}

/**
 * Union type representing all falsy values in JavaScript.
 * Includes false, null, 0, 0n (BigInt zero), empty string, and undefined.
 */
export type falsy = false | null | 0 | 0n | '' | undefined;

/**
 * Asserts that value is truthy.
 * Throws TypeError if value is falsy (false, null, 0, 0n, '', undefined), otherwise returns value with falsy types excluded.
 * 
 * @param potentiallyFalsy - to validate.
 * @returns Value with all falsy types excluded.
 * @throws {TypeError} When value is falsy.
 * 
 * @example
 * ```ts
 * const value: string | null | undefined = getUserInput();
 * const truthy = notFalsyOrThrow(value);
 * // truthy is typed as string (excludes null, undefined, and '')
 * ```
 */
export function notFalsyOrThrow<T,>(
  potentiallyFalsy: T,
): Exclude<T, falsy> {
  if (!potentiallyFalsy) {
    throw new TypeError(`${JSON.stringify(potentiallyFalsy)} is falsy`);
  }
  return potentiallyFalsy as Exclude<T, falsy>;
}

/**
 * Asserts that value is not false.
 * Throws TypeError if value is exactly false, otherwise returns value with false type excluded.
 * 
 * @param potentiallyFalse - to validate.
 * @returns Value with false type excluded.
 * @throws {TypeError} When value is false.
 * 
 * @example
 * ```ts
 * const value: boolean = getFeatureFlag();
 * const notFalse = notFalseOrThrow(value);
 * // notFalse is typed as true
 * ```
 */
export function notFalseOrThrow<T,>(
  potentiallyFalse: T,
): Exclude<T, false> {
  if (potentiallyFalse === false) {
    throw new TypeError(`${JSON.stringify(potentiallyFalse)} is false`);
  }
  return potentiallyFalse as Exclude<T, false>;
}

/**
 * Asserts that value is not an object.
 * Throws TypeError if value is an object (excluding null), otherwise returns value with object type excluded.
 * 
 * @param potentiallyObj - to validate.
 * @returns Value with object type excluded.
 * @throws {TypeError} When value is an object.
 * 
 * @example
 * ```ts
 * const value: string | object = getPrimitiveOrObject();
 * const primitive = notObjOrThrow(value);
 * // primitive is typed as string
 * ```
 */
export function notObjOrThrow<T,>(
  potentiallyObj: T,
): Exclude<T, object> {
  if (potentiallyObj !== null && typeof potentiallyObj === 'object') {
    throw new TypeError(`${JSON.stringify(potentiallyObj)} is an object`);
  }
  return potentiallyObj as Exclude<T, object>;
}

/**
 * Asserts that value is not true.
 * Throws TypeError if value is exactly true, otherwise returns value with true type excluded.
 * 
 * @param potentiallyTrue - to validate.
 * @returns Value with true type excluded.
 * @throws {TypeError} When value is true.
 * 
 * @example
 * ```ts
 * const value: boolean = getInverseFlag();
 * const notTrue = notTrueOrThrow(value);
 * // notTrue is typed as false
 * ```
 */
export function notTrueOrThrow<T,>(
  potentiallyTrue: T,
): Exclude<T, true> {
  if (potentiallyTrue === true) {
    throw new TypeError(`${JSON.stringify(potentiallyTrue)} is true`);
  }
  return potentiallyTrue as Exclude<T, true>;
}

/**
 * Union type representing all truthy values in JavaScript.
 * Includes all values except falsy ones (false, null, 0, 0n, '', undefined).
 * Specifically excludes 0 and empty string from number and string types.
 */
export type truthy = Exclude<
  | true
  | number
  | bigint
  | string
  | UnknownArrayOrTuple
  | UnknownMap
  | UnknownSet
  | UnknownRecord
  // oxlint-disable-next-line no-unsafe-function-type
  | Function,
  0 | ''
>;

/**
 * Asserts that value is falsy.
 * Throws TypeError if value is truthy, otherwise returns value with truthy types excluded.
 * Note: Despite the name suggesting it throws for truthy values, it actually returns falsy values.
 * 
 * @param potentiallyTruthy - to validate.
 * @returns Value confirmed to be falsy.
 * @throws {TypeError} When value is truthy.
 * 
 * @example
 * ```ts
 * const value: string | null = maybeGetString();
 * const falsy = notTruthyOrThrow(value);
 * // falsy is typed as null | '' (only falsy possibilities)
 * ```
 */
export function notTruthyOrThrow<const T,>(
  potentiallyTruthy: T,
): Exclude<T, falsy> {
  if (potentiallyTruthy) {
    throw new TypeError(`${JSON.stringify(potentiallyTruthy)} is truthy`);
  }
  return potentiallyTruthy as Exclude<T, falsy>;
}

/**
 * Asserts that value is not empty.
 * Throws TypeError if string is empty, array has no elements, or object has no keys.
 * Returns value with appropriate non-empty type constraint.
 * 
 * @param potentiallyEmpty - String, array, or object to validate.
 * @returns Non-empty value with refined type.
 * @throws {TypeError} When value is empty.
 * 
 * @example
 * ```ts
 * const str = notEmptyOrThrow('hello'); // typed as non-empty string
 * const arr = notEmptyOrThrow([1, 2]); // typed as [number, ...number[]]
 * const obj = notEmptyOrThrow({ a: 1 }); // typed as non-empty object
 * ```
 */
export function notEmptyOrThrow<const T extends string | any[] | object,
  const T_returns = T extends string ? Exclude<string, ''>
    : T extends readonly (infer T_element)[] ? [T_element, ...T_element[]]
    : T extends Readonly<object> ? Exclude<T, Record<PropertyKey, never>>
    : never,>(
  potentiallyEmpty: T,
): T_returns {
  if (
    (typeof potentiallyEmpty === 'string' && potentiallyEmpty === '')
    || (Array.isArray(potentiallyEmpty) && potentiallyEmpty.length === 0)
    || (typeof potentiallyEmpty === 'object'
      && Object.keys(potentiallyEmpty).length === 0)
  ) {
    throw new TypeError(`${JSON.stringify(potentiallyEmpty)} is empty`);
  }
  return potentiallyEmpty as unknown as T_returns;
}

/**
 * Asserts that value is not an array.
 * Throws TypeError if value is an array, otherwise returns value with array types excluded.
 * 
 * @param potentiallyArray - to validate.
 * @returns Value with array type excluded.
 * @throws {TypeError} When value is an array.
 * 
 * @example
 * ```ts
 * const value: string | string[] = getStringOrArray();
 * const notArray = notArrayOrThrow(value);
 * // notArray is typed as string
 * ```
 */
export function notArrayOrThrow<T,>(
  potentiallyArray: T,
): Exclude<T, any[]> {
  if (Array.isArray(potentiallyArray)) {
    throw new TypeError(`${JSON.stringify(potentiallyArray)} is an array`);
  }
  return potentiallyArray as Exclude<T, any[]>;
}

/**
 * Asserts that value is not a string.
 * Throws TypeError if value is a string, otherwise returns value with string type excluded.
 * 
 * @param potentiallyString - to validate.
 * @returns Value with string type excluded.
 * @throws {TypeError} When value is a string.
 * 
 * @example
 * ```ts
 * const value: string | number = getStringOrNumber();
 * const notString = notStringOrThrow(value);
 * // notString is typed as number
 * ```
 */
export function notStringOrThrow<T,>(
  potentiallyString: T,
): Exclude<T, string> {
  if (typeof potentiallyString === 'string') {
    throw new TypeError(`${potentiallyString} is a string`);
  }
  return potentiallyString as Exclude<T, string>;
}

/**
 * Asserts that array is not empty.
 * Throws TypeError if array has no elements, otherwise returns array typed as having at least one element.
 * 
 * @param potentiallyEmptyArray - Array to validate.
 * @returns Array typed as non-empty tuple [T, ...T[]].
 * @throws {TypeError} When array is empty.
 * 
 * @example
 * ```ts
 * const arr: number[] = getNumbers();
 * const nonEmpty = notEmptyArrayOrThrow(arr);
 * // nonEmpty is typed as [number, ...number[]]
 * const [first, ...rest] = nonEmpty; // Safe destructuring
 * ```
 */
export function notEmptyArrayOrThrow<const T,
  const Result extends T extends readonly (infer T_element)[]
    ? [T_element, ...T_element[]]
    : never,>(
  potentiallyEmptyArray: T,
): Result {
  if (isEmptyArray(potentiallyEmptyArray)) {
    throw new TypeError(`${JSON.stringify(potentiallyEmptyArray)} is an empty array`);
  }
  return potentiallyEmptyArray as unknown as Result;
}

//endregion Type Assertion Guards
