/**
 * Branded type for positive integers (numbers greater than 0).
 * Provides compile-time guarantees that values are positive whole numbers.
 *
 * @example
 * ```ts
 * function processPositiveInt(value: PositiveInt): string {
 *   return `Processing ${value}`;
 * }
 *
 * const validValue = 5 as PositiveInt;
 * processPositiveInt(validValue); // OK
 * ```
 */
export type PositiveInt = number & { __brand: 'PositiveInt'; };

/**
 * Branded type for positive floating-point numbers (numbers greater than 0).
 * Provides compile-time guarantees that values are positive decimal numbers.
 *
 * @example
 * ```ts
 * function calculateArea(radius: PositiveFloat): PositiveFloat {
 *   return (Math.PI * radius * radius) as PositiveFloat;
 * }
 *
 * const radius = 3.14 as PositiveFloat;
 * const area = calculateArea(radius);
 * ```
 */
export type PositiveFloat = number & { __brand: 'PositiveFloat'; };

/**
 * Branded type for negative integers (numbers less than 0).
 * Provides compile-time guarantees that values are negative whole numbers.
 *
 * @example
 * ```ts
 * function processDebt(amount: NegativeInt): string {
 *   return `Debt: ${Math.abs(amount)}`;
 * }
 *
 * const debt = -100 as NegativeInt;
 * processDebt(debt); // "Debt: 100"
 * ```
 */
export type NegativeInt = number & { __brand: 'NegativeInt'; };

/**
 * Branded type for negative floating-point numbers (numbers less than 0).
 * Provides compile-time guarantees that values are negative decimal numbers.
 *
 * @example
 * ```ts
 * function processTemperature(temp: NegativeFloat): string {
 *   return `Below freezing: ${temp}°C`;
 * }
 *
 * const temp = -15.5 as NegativeFloat;
 * processTemperature(temp);
 * ```
 */
export type NegativeFloat = number & { __brand: 'NegativeFloat'; };

/**
 * Union type for all positive numbers (integers and floats).
 * Combines PositiveInt and PositiveFloat for flexible positive number handling.
 *
 * @example
 * ```ts
 * function processPositiveValue(value: PositiveNumber): number {
 *   return value * 2;
 * }
 *
 * const intValue = 5 as PositiveInt;
 * const floatValue = 3.14 as PositiveFloat;
 * processPositiveValue(intValue);   // OK
 * processPositiveValue(floatValue); // OK
 * ```
 */
export type PositiveNumber = PositiveInt | PositiveFloat;

/**
 * Union type for all floating-point numbers (positive and negative).
 * Combines PositiveFloat and NegativeFloat for decimal number operations.
 *
 * @example
 * ```ts
 * function roundFloat(value: Float): number {
 *   return Math.round(value);
 * }
 *
 * const positive = 3.7 as PositiveFloat;
 * const negative = -2.3 as NegativeFloat;
 * roundFloat(positive); // 4
 * roundFloat(negative); // -2
 * ```
 */
export type Float = PositiveFloat | NegativeFloat;

/**
 * Union type for all integers (positive, negative, and zero).
 * Represents whole numbers including zero for complete integer coverage.
 *
 * @example
 * ```ts
 * function processInteger(value: Int): string {
 *   if (value === 0) return "Zero";
 *   return value > 0 ? "Positive" : "Negative";
 * }
 *
 * const positive = 5 as PositiveInt;
 * const negative = -3 as NegativeInt;
 * processInteger(positive); // "Positive"
 * processInteger(negative); // "Negative"
 * processInteger(0);        // "Zero"
 * ```
 */
export type Int = PositiveInt | NegativeInt | 0;

/**
 * Union type for all negative numbers (integers and floats).
 * Combines NegativeInt and NegativeFloat for flexible negative number handling.
 *
 * @example
 * ```ts
 * function processLoss(value: NegativeNumber): PositiveNumber {
 *   return Math.abs(value) as PositiveNumber;
 * }
 *
 * const intLoss = -100 as NegativeInt;
 * const floatLoss = -25.5 as NegativeFloat;
 * processLoss(intLoss);   // 100
 * processLoss(floatLoss); // 25.5
 * ```
 */
export type NegativeNumber = NegativeInt | NegativeFloat;

/**
 * Union type for non-negative integers (positive integers and zero).
 * Useful for array indices, counts, and other scenarios where negative values are invalid.
 *
 * @example
 * ```ts
 * function getArrayElement<T>(arr: T[], index: NonNegativeInt): T | undefined {
 *   return arr[index];
 * }
 *
 * const items = ['a', 'b', 'c'];
 * const index = 1 as NonNegativeInt;
 * getArrayElement(items, index); // 'b'
 * getArrayElement(items, 0);     // 'a'
 * ```
 */
export type NonNegativeInt = PositiveInt | 0;

/**
 * Union type for non-positive integers (negative integers and zero).
 * Useful for scenarios where only zero or negative values are valid.
 *
 * @example
 * ```ts
 * function processDeficit(value: NonPositiveInt): string {
 *   if (value === 0) return "Balanced";
 *   return `Deficit: ${Math.abs(value)}`;
 * }
 *
 * const deficit = -50 as NegativeInt;
 * processDeficit(deficit); // "Deficit: 50"
 * processDeficit(0);       // "Balanced"
 * ```
 */
export type NonPositiveInt = NegativeInt | 0;

/**
 * Branded type for bigint values representing integers.
 * Provides compile-time guarantees for large integer operations using bigint.
 *
 * @example
 * ```ts
 * function processLargeNumber(value: IntBigint): string {
 *   return `Large number: ${value}`;
 * }
 *
 * const largeInt = 9007199254740991n as IntBigint;
 * processLargeNumber(largeInt);
 * ```
 */
export type IntBigint = bigint & { __brand: 'IntBigint'; };

/**
 * Union type for all numeric types (number and bigint).
 * Provides flexibility for functions that can work with both regular numbers and bigints.
 *
 * @example
 * ```ts
 * function convertToString(value: Numeric): string {
 *   return value.toString();
 * }
 *
 * convertToString(42);    // "42"
 * convertToString(42n);   // "42"
 * convertToString(3.14);  // "3.14"
 * ```
 */
export type Numeric = number | bigint;

/**
 * Type-level utility that subtracts 1 from literal number types 1-10.
 * Useful for compile-time arithmetic operations and array index calculations.
 * Returns `never` for numbers outside the 1-10 range.
 *
 * @template T - Literal number type to decrement (must be 1-10)
 *
 * @example
 * ```ts
 * type Zero = MinusOne<1>;    // 0
 * type Two = MinusOne<3>;     // 2
 * type Nine = MinusOne<10>;   // 9
 * type Invalid = MinusOne<11>; // never
 *
 * // Practical usage with array types
 * type ArrayLength = 5;
 * type LastIndex = MinusOne<ArrayLength>; // 4
 *
 * function getLastElement<T, N extends number>(
 *   arr: T[],
 *   length: N
 * ): T | undefined {
 *   const lastIndex: MinusOne<N> = (length - 1) as MinusOne<N>;
 *   return arr[lastIndex];
 * }
 * ```
 */
export type MinusOne<T extends number,> = T extends 1 ? 0
  : T extends 2 ? 1
  : T extends 3 ? 2
  : T extends 4 ? 3
  : T extends 5 ? 4
  : T extends 6 ? 5
  : T extends 7 ? 6
  : T extends 8 ? 7
  : T extends 9 ? 8
  : T extends 10 ? 9
  : never;
