import type { LowercaseLetters } from './string.letters.ts';

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