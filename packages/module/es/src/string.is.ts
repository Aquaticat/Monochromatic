import type {
  DigitString,
  FloatString,
  IntString,
  LangString,
  LongLangString,
  NegativeFloatString,
  NegativeIntString,
  NegativeNumberString,
  No0DigitString,
  NumberString,
  PositiveFloatString,
  PositiveIntString,
  PositiveNumberString,
  ShortLangString,
} from './string.type.ts';

/**
 * Type guard that checks if a value is a string type using JavaScript typeof operator.
 * This function provides precise type narrowing for string types and is essential for
 * type-safe string operations in TypeScript applications.
 *
 * @param value - Value to test for string type
 * @returns True if value is a string, false otherwise
 * @example
 * ```ts
 * const input: unknown = "hello";
 * if (isString(input)) {
 *   // input is now typed as string
 *   console.log(input.toUpperCase()); // "HELLO"
 * }
 *
 * isString("text"); // true
 * isString(123); // false
 * isString(null); // false
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isString(value: unknown,): value is string {
  return typeof value === 'string';
}

/**
 * Type guard that checks if a value is a RegExp object using Object.prototype.toString.
 * This method provides more reliable RegExp detection than instanceof, especially across
 * different execution contexts or when dealing with RegExp objects from different realms.
 *
 * @param value - Value to test for RegExp type
 * @returns True if value is a RegExp object, false otherwise
 * @example
 * ```ts
 * const pattern = /[a-z]+/;
 * const notPattern = "[a-z]+";
 *
 * isObjectRegexp(pattern); // true
 * isObjectRegexp(notPattern); // false
 * isObjectRegexp(new RegExp("test")); // true
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isObjectRegexp(
  value: unknown,
): value is RegExp {
  return Object.prototype.toString.call(value,) === '[object RegExp]';
}

/**
 * Type guard that validates if a string is a short language code (2 lowercase letters).
 * Follows ISO 639-1 language code format for two-letter language identifiers.
 * Useful for internationalization and locale validation.
 *
 * @param value - Value to test for short language string format
 * @returns True if value is a valid short language string, false otherwise
 * @example
 * ```ts
 * isShortLangString("en"); // true
 * isShortLangString("fr"); // true
 * isShortLangString("EN"); // false (must be lowercase)
 * isShortLangString("eng"); // false (must be exactly 2 characters)
 * isShortLangString("e1"); // false (must be letters only)
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isShortLangString(
  value: unknown,
): value is ShortLangString {
  return isString(value,) && value.length === 2 && /^[a-z]+$/.test(value,);
}

/**
 * Type guard that validates if a string is a long language code (format: xx-XX).
 * Follows BCP 47 language tag format with language-region pattern.
 * Useful for locale-specific internationalization and regional content delivery.
 *
 * @param value - Value to test for long language string format
 * @returns True if value is a valid long language string, false otherwise
 * @example
 * ```ts
 * isLongLangString("en-US"); // true
 * isLongLangString("fr-CA"); // true
 * isLongLangString("zh-CN"); // true
 * isLongLangString("en-us"); // false (region must be uppercase)
 * isLongLangString("EN-US"); // false (language must be lowercase)
 * isLongLangString("en_US"); // false (must use hyphen separator)
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isLongLangString(
  value: unknown,
): value is LongLangString {
  const LANG_CODE_WITH_REGION_LENGTH = 5;
  return isString(value,)
    && value.length === LANG_CODE_WITH_REGION_LENGTH
    && /^[a-z]{2}-[A-Z]{2}$/.test(value,);
}

/**
 * Type guard that validates if a string is either a short or long language code.
 * Accepts both ISO 639-1 (2-letter) and BCP 47 (language-region) formats.
 * Comprehensive validation for internationalization language identifiers.
 *
 * @param value - Value to test for language string format
 * @returns True if value is a valid language string, false otherwise
 * @example
 * ```ts
 * isLangString("en"); // true (short format)
 * isLangString("en-US"); // true (long format)
 * isLangString("fr"); // true (short format)
 * isLangString("zh-CN"); // true (long format)
 * isLangString("invalid"); // false
 * isLangString("en-us"); // false (incorrect casing)
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isLangString(
  value: unknown,
): value is LangString {
  return isShortLangString(value,) || isLongLangString(value,);
}

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
  return isString(value,) && value.length > 0 && [...value,].every(isDigitString,);
}

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
