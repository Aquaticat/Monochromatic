import { isString, } from './string.general.ts';

//region Digit Types -- String literal types for numeric digits

/**
 * Union type representing all single digit characters including zero.
 *
 * @example
 * ```ts
 * const digit: DigitString = '5'; // Valid
 * const invalid: DigitString = '10'; // Type error - not a single digit
 * ```
 */
export type DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0';

/**
 * Union type representing all single digit characters excluding zero.
 * Useful for constructing numbers that can't start with zero.
 *
 * @example
 * ```ts
 * const nonZeroDigit: No0DigitString = '5'; // Valid
 * const invalid: No0DigitString = '0'; // Type error - zero not allowed
 * ```
 */
export type No0DigitString = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

//endregion Digit Types

//region Digit Validation Functions -- Type guards for digit string validation

/**
 * Type guard that checks if a value is a single digit string (0-9).
 * Validates that the input is exactly one character and represents a numeric digit.
 * Essential for parsing and validating numeric string inputs character by character.
 *
 * @param value - Value to test for single digit string
 * @returns True if value is a single digit string, false otherwise
 * @example
 * ```ts
 * isDigitString("5"); // true
 * isDigitString("0"); // true
 * isDigitString("9"); // true
 * isDigitString("10"); // false (multiple characters)
 * isDigitString("a"); // false (not a digit)
 * isDigitString(5); // false (not a string)
 * ```
 */
export function isDigitString(value: unknown,): value is DigitString {
  return typeof value === 'string'
    && ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',].includes(value,);
}

/**
 * Type guard that checks if a value is a non-zero single digit string (1-9).
 * Validates that the input is exactly one character representing a digit from 1 to 9,
 * excluding zero. Useful for validating leading digits in number strings.
 *
 * @param value - Value to test for non-zero single digit string
 * @returns True if value is a non-zero single digit string, false otherwise
 * @example
 * ```ts
 * isNo0DigitString("5"); // true
 * isNo0DigitString("1"); // true
 * isNo0DigitString("9"); // true
 * isNo0DigitString("0"); // false (zero not allowed)
 * isNo0DigitString("10"); // false (multiple characters)
 * isNo0DigitString("a"); // false (not a digit)
 * ```
 */
export function isNo0DigitString(value: unknown,): value is No0DigitString {
  return typeof value === 'string'
    && ['1', '2', '3', '4', '5', '6', '7', '8', '9',].includes(value,);
}

/**
 * Type guard that checks if a string contains only digit characters.
 * Validates that every character in the string is a numeric digit (0-9).
 * Useful for validating numeric string inputs before parsing to numbers.
 *
 * @param value - Value to test for digits-only string
 * @returns True if value is a string containing only digits, false otherwise
 * @example
 * ```ts
 * isDigitsString("123"); // true
 * isDigitsString("0"); // true
 * isDigitsString("999"); // true
 * isDigitsString("12a3"); // false (contains non-digit)
 * isDigitsString(""); // false (empty string)
 * isDigitsString("12.3"); // false (contains decimal point)
 * ```
 */
export function isDigitsString(value: unknown,): value is string {
  return isString(value,) && value.length > 0 // eslint-disable-next-line unicorn/prefer-string-slice -- Digits are ASCII only, no complex Unicode handling needed
  && [...value,].every(char => isDigitString(char,));
}

//endregion Digit Validation Functions
