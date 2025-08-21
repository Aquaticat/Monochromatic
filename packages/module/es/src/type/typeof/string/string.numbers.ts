import type { DigitString, No0DigitString } from './string.digits.ts';
import { isString } from './string.general.ts';
import { isDigitString, isNo0DigitString, isDigitsString } from './string.digits.ts';

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

//region Number String Validation Functions -- Type guards for numeric string validation

/**
 * Type guard that validates if a string represents a positive integer.
 * Accepts single digits (0-9) or multi-digit numbers without leading zeros.
 * Essential for validating positive integer inputs in string format.
 *
 * @param value - Value to test for positive integer string format
 * @returns True if value is a valid positive integer string, false otherwise
 * @example
 * ```ts
 * isPositiveIntString("123"); // true
 * isPositiveIntString("0"); // true
 * isPositiveIntString("5"); // true
 * isPositiveIntString("007"); // false (leading zeros not allowed)
 * isPositiveIntString("-5"); // false (negative not allowed)
 * isPositiveIntString("12.3"); // false (decimal not allowed)
 * ```
 */
export function isPositiveIntString(value: unknown,): value is PositiveIntString {
  if (isDigitString(value,))
    return true;
  if (!isString(value,))
    return false;
  if (isDigitString(value,))
    return true;
  if (value.length <= 1)
    return false;
  if (!isNo0DigitString(value[0],))
    return false;
  return isDigitsString(value.slice(1,),);
}

/**
 * Type guard that validates if a string represents a negative integer.
 * Must start with a minus sign followed by a valid positive integer.
 * Ensures proper format for negative integer string representations.
 *
 * @param value - Value to test for negative integer string format
 * @returns True if value is a valid negative integer string, false otherwise
 * @example
 * ```ts
 * isNegativeIntString("-123"); // true
 * isNegativeIntString("-5"); // true
 * isNegativeIntString("-007"); // false (leading zeros not allowed)
 * isNegativeIntString("123"); // false (positive not allowed)
 * isNegativeIntString("-"); // false (no digits after minus)
 * isNegativeIntString("-12.3"); // false (decimal not allowed)
 * ```
 */
export function isNegativeIntString(value: unknown,): value is NegativeIntString {
  if (!isString(value,))
    return false;
  if (value.length <= 1)
    return false;
  if (value[0] !== '-')
    return false;
  return isPositiveIntString(value.slice(1,),);
}

/**
 * Type guard that validates if a string represents a positive floating-point number.
 * Must contain a decimal point with valid integer and fractional parts.
 * Excludes numbers that are effectively integers (ending in .0, .00, etc.).
 *
 * @param value - Value to test for positive float string format
 * @returns True if value is a valid positive float string, false otherwise
 * @example
 * ```ts
 * isPositiveFloatString("12.34"); // true
 * isPositiveFloatString("0.5"); // true
 * isPositiveFloatString("123.456"); // true
 * isPositiveFloatString("12.0"); // false (effectively an integer)
 * isPositiveFloatString("12"); // false (no decimal point)
 * isPositiveFloatString("-12.34"); // false (negative not allowed)
 * ```
 */
export function isPositiveFloatString(value: unknown,): value is PositiveFloatString {
  if (!isString(value,))
    return false;
  if (value.length <= 2)
    return false;
  const dotIndex = value.indexOf('.',);
  if (dotIndex === -1)
    return false;
  const intPart = value.slice(0, dotIndex,);
  if (!isPositiveIntString(intPart,))
    return false;
  const floatPart = value.slice(dotIndex + 1,);
  if (
    // eslint-disable-next-line unicorn/prefer-string-slice -- Checking all characters for zero pattern
    [...floatPart,].every(function is0(floatPartDigit,) {
      return floatPartDigit === '0';
    },)
  ) {
    return false;
  }
  return isDigitsString(floatPart,);
}

/**
 * Type guard that validates if a string represents a negative floating-point number.
 * Must start with a minus sign followed by a valid positive float.
 * Ensures proper format for negative float string representations.
 *
 * @param value - Value to test for negative float string format
 * @returns True if value is a valid negative float string, false otherwise
 * @example
 * ```ts
 * isNegativeFloatString("-12.34"); // true
 * isNegativeFloatString("-0.5"); // true
 * isNegativeFloatString("-123.456"); // true
 * isNegativeFloatString("-12.0"); // false (effectively an integer)
 * isNegativeFloatString("12.34"); // false (positive not allowed)
 * isNegativeFloatString("-"); // false (no digits after minus)
 * ```
 */
export function isNegativeFloatString(value: unknown,): value is NegativeFloatString {
  if (!isString(value,))
    return false;
  if (value.length <= 1)
    return false;
  if (value[0] !== '-')
    return false;
  return isPositiveFloatString(value.slice(1,),);
}

/**
 * Type guard that validates if a string represents any integer (positive or negative).
 * Combines validation for both positive and negative integer string formats.
 * Comprehensive integer string validation for numeric parsing operations.
 *
 * @param value - Value to test for integer string format
 * @returns True if value is a valid integer string, false otherwise
 * @example
 * ```ts
 * isIntString("123"); // true (positive)
 * isIntString("-456"); // true (negative)
 * isIntString("0"); // true (zero)
 * isIntString("12.3"); // false (has decimal)
 * isIntString("abc"); // false (not numeric)
 * isIntString("007"); // false (leading zeros)
 * ```
 */
export function isIntString(value: unknown,): value is IntString {
  return isPositiveIntString(value,) || isNegativeIntString(value,);
}

/**
 * Type guard that validates if a string represents any floating-point number.
 * Combines validation for both positive and negative float string formats.
 * Comprehensive float string validation for decimal number parsing.
 *
 * @param value - Value to test for float string format
 * @returns True if value is a valid float string, false otherwise
 * @example
 * ```ts
 * isFloatString("12.34"); // true (positive)
 * isFloatString("-56.78"); // true (negative)
 * isFloatString("0.5"); // true (fractional)
 * isFloatString("12"); // false (no decimal point)
 * isFloatString("12.0"); // false (effectively integer)
 * isFloatString("abc"); // false (not numeric)
 * ```
 */
export function isFloatString(value: unknown,): value is FloatString {
  return isPositiveFloatString(value,) || isNegativeFloatString(value,);
}

/**
 * Type guard that validates if a string represents any positive number.
 * Accepts both positive integers and positive floating-point numbers.
 * Comprehensive validation for positive numeric string representations.
 *
 * @param value - Value to test for positive number string format
 * @returns True if value is a valid positive number string, false otherwise
 * @example
 * ```ts
 * isPositiveNumberString("123"); // true (positive integer)
 * isPositiveNumberString("12.34"); // true (positive float)
 * isPositiveNumberString("0"); // true (zero)
 * isPositiveNumberString("-123"); // false (negative)
 * isPositiveNumberString("abc"); // false (not numeric)
 * isPositiveNumberString("12.0"); // false (effectively integer)
 * ```
 */
export function isPositiveNumberString(value: unknown,): value is PositiveNumberString {
  return isPositiveIntString(value,) || isPositiveFloatString(value,);
}

/**
 * Type guard that validates if a string represents any negative number.
 * Accepts both negative integers and negative floating-point numbers.
 * Comprehensive validation for negative numeric string representations.
 *
 * @param value - Value to test for negative number string format
 * @returns True if value is a valid negative number string, false otherwise
 * @example
 * ```ts
 * isNegativeNumberString("-123"); // true (negative integer)
 * isNegativeNumberString("-12.34"); // true (negative float)
 * isNegativeNumberString("123"); // false (positive)
 * isNegativeNumberString("0"); // false (zero, not negative)
 * isNegativeNumberString("abc"); // false (not numeric)
 * isNegativeNumberString("-12.0"); // false (effectively integer)
 * ```
 */
export function isNegativeNumberString(value: unknown,): value is NegativeNumberString {
  return isNegativeIntString(value,) || isNegativeFloatString(value,);
}

/**
 * Type guard that validates if a string represents any number (integer or float).
 * Accepts positive numbers, negative numbers, integers, and floating-point numbers.
 * Most comprehensive numeric string validation covering all number formats.
 *
 * @param value - Value to test for number string format
 * @returns True if value is a valid number string, false otherwise
 * @example
 * ```ts
 * isNumberString("123"); // true (positive integer)
 * isNumberString("-456"); // true (negative integer)
 * isNumberString("12.34"); // true (positive float)
 * isNumberString("-56.78"); // true (negative float)
 * isNumberString("0"); // true (zero)
 * isNumberString("abc"); // false (not numeric)
 * ```
 */
export function isNumberString(value: unknown,): value is NumberString {
  return isPositiveNumberString(value,) || isNegativeNumberString(value,);
}

//endregion Number String Validation Functions
