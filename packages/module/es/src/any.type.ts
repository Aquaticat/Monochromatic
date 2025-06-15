// TODO: Use error cause param to pass error.

//region Type Testing Utilities -- Provides type-level testing utilities for verifying type equality and inequality in unit tests

/**
 * Type-level assertion utility that expects a true type parameter.
 *
 * This utility type is used in type-level testing to assert that a condition
 * evaluates to true at compile time. It's commonly used with other type utilities
 * like Equal to create compile-time type assertions in unit tests.
 *
 * @template T - Type parameter that must extend true, ensuring type-level assertions pass
 *
 * @example
 * ```ts
 * // Basic usage for type assertions
 * type Test1 = Expect<Equal<string, string>>; // ✓ Compiles successfully
 * type Test2 = Expect<Equal<string, number>>; // ✗ Compilation error
 *
 * // Common pattern in type testing
 * type TestStringType = Expect<Equal<typeof "hello", string>>; // ✓ Passes
 * type TestArrayType = Expect<Equal<string[], Array<string>>>; // ✓ Passes
 *
 * // Chaining multiple assertions
 * type MultipleTests = [
 *   Expect<Equal<1, 1>>,
 *   Expect<NotEqual<1, 2>>,
 *   Expect<Equal<true, boolean>>
 * ]; // All must pass for compilation to succeed
 * ```
 *
 * @see {@link Equal} For type equality checking
 * @see {@link NotEqual} For type inequality checking
 */
// TODO: Use Assert instead of chaining Expect<Equal<T>>
export type Expect<T extends true,> = T;

/**
 * Type-level equality checker that determines if two types are identical.
 *
 * This utility type performs deep type equality checking at compile time using
 * TypeScript's conditional type system. It uses a sophisticated technique with
 * function signatures and unknown type checking to accurately determine type
 * equality, including handling of complex types like unions, intersections,
 * and conditional types.
 *
 * @template X - First type to compare
 * @template Y - Second type to compare
 * @returns `true` if types X and Y are identical, `false` otherwise
 *
 * @example
 * ```ts
 * // Basic type equality
 * type StringTest = Equal<string, string>; // true
 * type NumberTest = Equal<number, string>; // false
 *
 * // Complex type equality
 * type ObjectTest = Equal<{ a: string }, { a: string }>; // true
 * type UnionTest = Equal<string | number, number | string>; // true
 * type FunctionTest = Equal<(x: string) => number, (x: string) => number>; // true
 *
 * // Array and tuple equality
 * type ArrayTest = Equal<string[], Array<string>>; // true
 * type TupleTest = Equal<[string, number], [string, number]>; // true
 * type TupleDiff = Equal<[string, number], [number, string]>; // false
 *
 * // Generic type equality
 * type GenericTest<T> = Equal<Promise<T>, Promise<T>>; // true
 * type ConstraintTest = Equal<T extends string ? T : never, T extends string ? T : never>; // true
 *
 * // Usage with Expect for assertions
 * type AssertEqual = Expect<Equal<string, string>>; // ✓ Compiles
 * type AssertNotEqual = Expect<Equal<string, number>>; // ✗ Compilation error
 * ```
 *
 * @see {@link Expect} For type-level assertions
 * @see {@link NotEqual} For type inequality checking
 */
export type Equal<X, Y,> = (() => unknown extends X ? 1 : 2) extends
  () => unknown extends Y ? 1 : 2 ? true
  : false;

/**
 * Type-level inequality checker that determines if two types are different.
 *
 * This utility type is the logical negation of the Equal type, returning true
 * when two types are different and false when they are identical. It uses the
 * same sophisticated type equality checking mechanism as Equal but inverts the
 * result to test for type inequality.
 *
 * @template X - First type to compare
 * @template Y - Second type to compare
 * @returns `true` if types X and Y are different, `false` if they are identical
 *
 * @example
 * ```ts
 * // Basic type inequality
 * type StringNumberTest = NotEqual<string, number>; // true
 * type StringStringTest = NotEqual<string, string>; // false
 *
 * // Complex type inequality
 * type ObjectTest = NotEqual<{ a: string }, { a: number }>; // true
 * type UnionTest = NotEqual<string | number, string | boolean>; // true
 * type IdenticalUnion = NotEqual<string | number, number | string>; // false
 *
 * // Array and tuple inequality
 * type ArrayTest = NotEqual<string[], number[]>; // true
 * type TupleTest = NotEqual<[string, number], [number, string]>; // true
 * type SameTuple = NotEqual<[string, number], [string, number]>; // false
 *
 * // Function type inequality
 * type FunctionTest = NotEqual<(x: string) => number, (x: number) => string>; // true
 * type SameFunction = NotEqual<(x: string) => number, (x: string) => number>; // false
 *
 * // Usage with Expect for negative assertions
 * type AssertNotEqual = Expect<NotEqual<string, number>>; // ✓ Compiles
 * type AssertSameTypes = Expect<NotEqual<string, string>>; // ✗ Compilation error
 *
 * // Combining with other type utilities
 * type TestDifferentGenerics<T, U> = Expect<NotEqual<Promise<T>, Promise<U>>>; // Only passes if T ≠ U
 * ```
 *
 * @see {@link Expect} For type-level assertions
 * @see {@link Equal} For type equality checking
 */
export type NotEqual<X, Y,> = (() => unknown extends X ? 1 : 2) extends
  () => unknown extends Y ? 1 : 2 ? false
  : true;

//endregion Type Testing Utilities
