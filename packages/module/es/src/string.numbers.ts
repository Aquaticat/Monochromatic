import type { DigitString, No0DigitString } from './string.digits.ts';

//region Integer String Types -- Template literal types for integer representations

/**
 * Type alias for single digit integer strings.
 * Equivalent to DigitString but semantically represents integers.
 *
 * @example
 * ```ts
 * const singleDigit: SingleDigitIntString = '7'; // Valid
 * const invalid: SingleDigitIntString = '12'; // Type error
 * ```
 */
export type SingleDigitIntString = DigitString;

/**
 * Template literal type for two-digit integer strings (10-99).
 * First digit must be non-zero to prevent leading zeros.
 *
 * @example
 * ```ts
 * const twoDigit: DoubleDigitIntString = '42'; // Valid
 * const invalid: DoubleDigitIntString = '07'; // Type error - no leading zero
 * ```
 */
export type DoubleDigitIntString = `${No0DigitString}${DigitString}`;

/**
 * Template literal type for three-digit integer strings (100-999).
 * First digit must be non-zero to prevent leading zeros.
 *
 * @example
 * ```ts
 * const threeDigit: TripleDigitIntString = '123'; // Valid
 * const invalid: TripleDigitIntString = '012'; // Type error - no leading zero
 * ```
 */
export type TripleDigitIntString = `${No0DigitString}${DigitString}${DigitString}`;

/**
 * Template literal type for four-digit integer strings (1000-9999).
 * First digit must be non-zero to prevent leading zeros.
 *
 * @example
 * ```ts
 * const fourDigit: QuadrupleDigitIntString = '2024'; // Valid
 * const invalid: QuadrupleDigitIntString = '0123'; // Type error - no leading zero
 * ```
 */
export type QuadrupleDigitIntString =
  `${No0DigitString}${DigitString}${DigitString}${DigitString}`;

/**
 * Union type for integer strings with 1-4 digits.
 * Covers common integer ranges while maintaining type safety.
 *
 * @example
 * ```ts
 * const small: OneToFourDigitsIntString = '5'; // Valid
 * const medium: OneToFourDigitsIntString = '42'; // Valid
 * const large: OneToFourDigitsIntString = '1234'; // Valid
 * const tooLarge: OneToFourDigitsIntString = '12345'; // Type error
 * ```
 */
export type OneToFourDigitsIntString =
  | SingleDigitIntString
  | DoubleDigitIntString
  | TripleDigitIntString
  | QuadrupleDigitIntString;

//endregion Integer String Types

//region Branded Number String Types -- Branded types for numeric string validation

/**
 * Branded type for positive integer strings including zero.
 * Uses brand to distinguish from regular strings at compile time.
 *
 * @example
 * ```ts
 * const positive: PositiveIntString = '42' as PositiveIntString; // Valid
 * const zero: PositiveIntString = '0' as PositiveIntString; // Valid
 * // Runtime validation would be needed to ensure string is actually a valid positive integer
 * ```
 */
export type PositiveIntString =
  | '0'
  | `${No0DigitString}${string & { length?: number; }}` & {
    __brand: 'PositiveIntString';
  };

/* vale alex.ProfanityMaybe = NO */
// Float part: "0.xxx" or non-zero int followed by ".xxx"
/* vale alex.ProfanityMaybe = YES */
/**
 * Branded type for positive floating-point number strings.
 * Supports decimal numbers starting with zero or non-zero digits.
 * Uses brand to distinguish from regular strings at compile time.
 *
 * @example
 * ```ts
 * const decimal: PositiveFloatString = '3.14' as PositiveFloatString; // Valid
 * const zeroDecimal: PositiveFloatString = '0.5' as PositiveFloatString; // Valid
 * // Runtime validation would be needed to ensure string is actually a valid positive float
 * ```
 */
export type PositiveFloatString =
  | `0.${DigitString}${string}`
  | `${No0DigitString}${string}.${DigitString}${string}`
    & {
      __brand: 'PositiveFloatString';
    };

/**
 * Branded type for negative integer strings including negative zero.
 * Uses brand to distinguish from regular strings at compile time.
 *
 * @example
 * ```ts
 * const negative: NegativeIntString = '-42' as NegativeIntString; // Valid
 * const negZero: NegativeIntString = '-0' as NegativeIntString; // Valid
 * // Runtime validation would be needed to ensure string is actually a valid negative integer
 * ```
 */
export type NegativeIntString =
  | `-0`
  | `-${No0DigitString}${string}` & {
    __brand: 'NegativeIntString';
  };

/**
 * Branded type for negative floating-point number strings.
 * Supports negative decimal numbers with various formats.
 * Uses brand to distinguish from regular strings at compile time.
 *
 * @example
 * ```ts
 * const negDecimal: NegativeFloatString = '-3.14' as NegativeFloatString; // Valid
 * const negZeroDecimal: NegativeFloatString = '-0.5' as NegativeFloatString; // Valid
 * // Runtime validation would be needed to ensure string is actually a valid negative float
 * ```
 */
export type NegativeFloatString =
  | `-0.${DigitString}${string}`
  | `-${No0DigitString}${string}.${DigitString}${string}`
    & {
      __brand: 'NegativeFloatString';
    };

//endregion Branded Number String Types

//region Composite Number String Types -- Union types combining positive and negative number strings

/**
 * Union type for integer strings (positive and negative).
 * Combines both positive and negative integer string types.
 *
 * @example
 * ```ts
 * const positive: IntString = '42' as PositiveIntString; // Valid
 * const negative: IntString = '-42' as NegativeIntString; // Valid
 * ```
 */
export type IntString = PositiveIntString | NegativeIntString;

/**
 * Union type for floating-point number strings (positive and negative).
 * Combines both positive and negative float string types.
 *
 * @example
 * ```ts
 * const positive: FloatString = '3.14' as PositiveFloatString; // Valid
 * const negative: FloatString = '-3.14' as NegativeFloatString; // Valid
 * ```
 */
export type FloatString = PositiveFloatString | NegativeFloatString;

/**
 * Union type for any numeric string representation.
 * Combines integers and floating-point numbers, both positive and negative.
 *
 * @example
 * ```ts
 * const integer: NumberString = '42' as PositiveIntString; // Valid
 * const float: NumberString = '-3.14' as NegativeFloatString; // Valid
 * ```
 */
export type NumberString = IntString | FloatString;

/**
 * Union type for positive numeric strings (integers and floats).
 * Combines positive integers and positive floating-point numbers.
 *
 * @example
 * ```ts
 * const posInt: PositiveNumberString = '42' as PositiveIntString; // Valid
 * const posFloat: PositiveNumberString = '3.14' as PositiveFloatString; // Valid
 * ```
 */
export type PositiveNumberString = PositiveIntString | PositiveFloatString;

/**
 * Union type for negative numeric strings (integers and floats).
 * Combines negative integers and negative floating-point numbers.
 *
 * @example
 * ```ts
 * const negInt: NegativeNumberString = '-42' as NegativeIntString; // Valid
 * const negFloat: NegativeNumberString = '-3.14' as NegativeFloatString; // Valid
 * ```
 */
export type NegativeNumberString = NegativeIntString | NegativeFloatString;

//endregion Composite Number String Types