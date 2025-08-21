//region Type Assertion Utilities -- Provides compile-time type assertion utilities for testing and validation

/**
 * Asserts that type Y extends type X at compile-time.
 * Core type assertion utility that validates type relationships and compatibility.
 * Useful for ensuring type constraints are met in generic functions and type definitions.
 *
 * @template X - Expected supertype that Y should extend
 * @template Y - Type to validate, must extend X
 * @returns Y if the assertion passes, compilation error if Y doesn't extend X
 *
 * @example
 * ```ts
 * type StringInput = Assert<string, 'hello'>; // ✓ 'hello' extends string
 * type NumberInput = Assert<number, 42>; // ✓ 42 extends number
 * // type Invalid = Assert<string, number>; // ✗ Compilation error
 *
 * function processStringLike<T>(value: Assert<string, T>): T {
 *   return value;
 * }
 * ```
 */
export type Assert<X, Y extends X,> = Y;

/**
 * Asserts that type Y is exactly true at compile-time.
 * Type assertion utility for boolean literal validation in type-level programming.
 *
 * @template Y - Type to validate, must be exactly true
 * @returns Y if the assertion passes, compilation error if Y is not true
 *
 * @example
 * ```ts
 * type IsValid = AssertTrue<true>; // ✓ Passes
 * type IsEqual = AssertTrue<1 extends number>; // ✓ Conditional type resolves to true
 * // type Invalid = AssertTrue<false>; // ✗ Compilation error
 * // type Invalid2 = AssertTrue<boolean>; // ✗ Compilation error
 * ```
 */
export type AssertTrue<Y extends true,> = Y;

/**
 * Asserts that type Y is exactly false at compile-time.
 * Type assertion utility for boolean literal validation in type-level programming.
 *
 * @template Y - Type to validate, must be exactly false
 * @returns Y if the assertion passes, compilation error if Y is not false
 *
 * @example
 * ```ts
 * type IsInvalid = AssertFalse<false>; // ✓ Passes
 * type IsNotEqual = AssertFalse<string extends number>; // ✓ Conditional type resolves to false
 * // type Invalid = AssertFalse<true>; // ✗ Compilation error
 * // type Invalid2 = AssertFalse<boolean>; // ✗ Compilation error
 * ```
 */
export type AssertFalse<Y extends false,> = Y;

/**
 * Asserts that type Y is exactly undefined at compile-time.
 * Type assertion utility for undefined type validation in type-level programming.
 *
 * @template Y - Type to validate, must be exactly undefined
 * @returns Y if the assertion passes, compilation error if Y is not undefined
 *
 * @example
 * ```ts
 * type VoidReturn = AssertUndefined<undefined>; // ✓ Passes
 * type MaybeUndefined = AssertUndefined<void>; // ✓ void is equivalent to undefined
 * // type Invalid = AssertUndefined<null>; // ✗ Compilation error
 * // type Invalid2 = AssertUndefined<string>; // ✗ Compilation error
 * ```
 */
export type AssertUndefined<Y extends undefined,> = Y;

/**
 * Asserts that type Y is exactly null at compile-time.
 * Type assertion utility for null type validation in type-level programming.
 *
 * @template Y - Type to validate, must be exactly null
 * @returns Y if the assertion passes, compilation error if Y is not null
 *
 * @example
 * ```ts
 * type NullValue = AssertNull<null>; // ✓ Passes
 * type NullableCheck = AssertNull<string | null>; // ✗ Compilation error (union type)
 * // type Invalid = AssertNull<undefined>; // ✗ Compilation error
 * // type Invalid2 = AssertNull<string>; // ✗ Compilation error
 * ```
 */
export type AssertNull<Y extends null,> = Y;

/**
 * Asserts that type Y is an empty object at compile-time.
 * Type assertion utility for validating empty object types with no enumerable properties.
 *
 * @template Y - Type to validate, must extend Record<string, never>
 * @returns Y if the assertion passes, compilation error if Y has properties
 *
 * @example
 * ```ts
 * type EmptyObj = AssertEmptyObject<{}>; // ✓ Passes
 * type EmptyRecord = AssertEmptyObject<Record<string, never>>; // ✓ Passes
 * // type Invalid = AssertEmptyObject<{ prop: string }>; // ✗ Compilation error
 * // type Invalid2 = AssertEmptyObject<Record<string, any>>; // ✗ Compilation error
 * ```
 */
export type AssertEmptyObject<
  Y extends Record<string, never>,
> = Y;

/**
 * Asserts that type Y is exactly 0 at compile-time.
 * Type assertion utility for zero literal validation in numeric type programming.
 *
 * @template Y - Type to validate, must be exactly 0
 * @returns Y if the assertion passes, compilation error if Y is not 0
 *
 * @example
 * ```ts
 * type Zero = Assert0<0>; // ✓ Passes
 * type ZeroResult = Assert0<1 - 1>; // ✓ Type-level arithmetic resolves to 0
 * // type Invalid = Assert0<1>; // ✗ Compilation error
 * // type Invalid2 = Assert0<number>; // ✗ Compilation error
 * ```
 */
export type Assert0<Y extends 0,> = Y;

/**
 * Asserts that type Y is exactly 1 at compile-time.
 * Type assertion utility for one literal validation in numeric type programming.
 *
 * @template Y - Type to validate, must be exactly 1
 * @returns Y if the assertion passes, compilation error if Y is not 1
 *
 * @example
 * ```ts
 * type One = Assert1<1>; // ✓ Passes
 * type OneResult = Assert1<0 + 1>; // ✓ Type-level arithmetic resolves to 1
 * // type Invalid = Assert1<2>; // ✗ Compilation error
 * // type Invalid2 = Assert1<number>; // ✗ Compilation error
 * ```
 */
export type Assert1<Y extends 1,> = Y;

/**
 * Asserts that type Y is exactly NaN at compile-time.
 * Type assertion utility for NaN literal validation in numeric type programming.
 *
 * @template Y - Type to validate, must be exactly typeof Number.NaN
 * @returns Y if the assertion passes, compilation error if Y is not NaN
 *
 * @example
 * ```ts
 * type NotANumber = AssertNan<typeof Number.NaN>; // ✓ Passes
 * // type Invalid = AssertNan<number>; // ✗ Compilation error
 * // type Invalid2 = AssertNan<0>; // ✗ Compilation error
 * ```
 */
export type AssertNan<Y extends typeof Number.NaN,> = Y;

/**
 * Asserts that type Y is exactly -1 at compile-time.
 * Type assertion utility for negative one literal validation in numeric type programming.
 *
 * @template Y - Type to validate, must be exactly -1
 * @returns Y if the assertion passes, compilation error if Y is not -1
 *
 * @example
 * ```ts
 * type NegativeOne = AssertNegative1<-1>; // ✓ Passes
 * type NegResult = AssertNegative1<0 - 1>; // ✓ Type-level arithmetic resolves to -1
 * // type Invalid = AssertNegative1<1>; // ✗ Compilation error
 * // type Invalid2 = AssertNegative1<number>; // ✗ Compilation error
 * ```
 */
export type AssertNegative1<Y extends -1,> = Y;

/**
 * Asserts that type Y is an empty array at compile-time.
 * Type assertion utility for validating empty array types with no elements.
 *
 * @template Y - Type to validate, must extend never[]
 * @returns Y if the assertion passes, compilation error if Y has elements
 *
 * @example
 * ```ts
 * type EmptyArr = AssertEmptyArray<never[]>; // ✓ Passes
 * type EmptyTuple = AssertEmptyArray<[]>; // ✓ Passes ([] extends never[])
 * // type Invalid = AssertEmptyArray<[string]>; // ✗ Compilation error
 * // type Invalid2 = AssertEmptyArray<any[]>; // ✗ Compilation error
 * ```
 */
export type AssertEmptyArray<Y extends never[],> = Y;

/**
 * Asserts that type Y excludes type X at compile-time.
 * Type assertion utility for validating that a type doesn't include specific values or types.
 * Uses Exclude utility type to ensure Y contains no overlap with X.
 *
 * @template X - Type to exclude from Y
 * @template Y - Type to validate, must not include any part of X
 * @returns Y if the assertion passes, compilation error if Y includes X
 *
 * @example
 * ```ts
 * type StringOnly = AssertNot<number, string>; // ✓ string excludes number
 * type NoNull = AssertNot<null, string>; // ✓ string excludes null
 * type NoUndefined = AssertNot<undefined, 'hello'>; // ✓ 'hello' excludes undefined
 * // type Invalid = AssertNot<string, 'hello'>; // ✗ 'hello' includes string
 * // type Invalid2 = AssertNot<number, 42>; // ✗ 42 includes number
 * ```
 */
export type AssertNot<X, Y extends Exclude<any, X>,> = Y;

//endregion Type Assertion Utilities
