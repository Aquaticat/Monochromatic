import { isString, } from './string.general.ts';
import type { LowercaseLetters, } from './string.letters.ts';

//region Language Code Types -- Types for ISO language codes and locale identifiers

/**
 * Template literal type for two-letter language codes (ISO 639-1).
 * Represents short language codes like 'en', 'fr', 'de', etc.
 *
 * @example
 * ```ts
 * const lang: ShortLangString = 'en'; // Valid
 * const invalid: ShortLangString = 'EN'; // Type error - must be lowercase
 * const tooLong: ShortLangString = 'eng'; // Type error - must be exactly 2 chars
 * ```
 */
export type ShortLangString = `${LowercaseLetters}${LowercaseLetters}`;

/**
 * Template literal type for long language codes with region (like 'en-US').
 * Represents language-region combinations with exactly 5 characters.
 * Note: Uses intersection with length constraint due to TypeScript complexity limits.
 *
 * @example
 * ```ts
 * const locale: LongLangString = 'en-US'; // Valid
 * const invalid: LongLangString = 'en-us'; // Type error - region must be uppercase
 * ```
 */
// Expression produces a union type that's too complex to represent.
// export type longLangString = `${shortLangString}-${UppercaseLetters}${UppercaseLetters}`
export type LongLangString = `${ShortLangString}-${string}` & { length: 5; };

/**
 * Union type accepting both short and long language code formats.
 * Covers ISO 639-1 codes and language-region combinations.
 *
 * @example
 * ```ts
 * const short: LangString = 'en'; // Valid
 * const long: LangString = 'en-US'; // Valid
 * const invalid: LangString = 'english'; // Type error
 * ```
 */
export type LangString = ShortLangString | LongLangString;

//endregion Language Code Types

//region Language Code Validation Functions -- Type guards for language code validation

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

//endregion Language Code Validation Functions
