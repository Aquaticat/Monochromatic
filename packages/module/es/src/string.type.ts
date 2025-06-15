//region Alphabet Types -- String literal types for individual letters and letter collections

/**
 * Union type representing all lowercase English letters.
 *
 * @example
 * ```ts
 * type FirstLetter = LowercaseLetters; // 'a' | 'b' | 'c' | ... | 'z'
 * const letter: LowercaseLetters = 'a'; // Valid
 * const invalid: LowercaseLetters = 'A'; // Type error
 * ```
 */
export type LowercaseLetters =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'w'
  | 'v'
  | 'u'
  | 'x'
  | 'y'
  | 'z';

/**
 * Union type representing all uppercase English letters.
 *
 * @example
 * ```ts
 * type FirstLetter = UppercaseLetters; // 'A' | 'B' | 'C' | ... | 'Z'
 * const letter: UppercaseLetters = 'A'; // Valid
 * const invalid: UppercaseLetters = 'a'; // Type error
 * ```
 */
export type UppercaseLetters =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'W'
  | 'V'
  | 'U'
  | 'X'
  | 'Y'
  | 'Z';

/**
 * Fixed-length tuple containing all lowercase English letters in alphabetical order.
 * Useful for iteration and indexed access to letters.
 *
 * @example
 * ```ts
 * type FirstLetter = LowercaseLettersTuple[0]; // 'a'
 * type LastLetter = LowercaseLettersTuple[25]; // 'z'
 * ```
 */
export type LowercaseLettersTuple = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'w',
  'v',
  'u',
  'x',
  'y',
  'z',
];

/**
 * Fixed-length tuple containing all uppercase English letters in alphabetical order.
 * Useful for iteration and indexed access to letters.
 *
 * @example
 * ```ts
 * type FirstLetter = UppercaseLettersTuple[0]; // 'A'
 * type LastLetter = UppercaseLettersTuple[25]; // 'Z'
 * ```
 */
export type UppercaseLettersTuple = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'W',
  'V',
  'U',
  'X',
  'Y',
  'Z',
];

//endregion Alphabet Types

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

//region Runtime Constants -- Runtime arrays corresponding to the type definitions

/**
 * Runtime array containing all lowercase English letters in alphabetical order.
 * Corresponds to the LowercaseLettersTuple type.
 *
 * @example
 * ```ts
 * console.log(lowercaseLetters[0]); // 'a'
 * console.log(lowercaseLetters.length); // 26
 * lowercaseLetters.forEach(letter => console.log(letter));
 * ```
 */
export const lowercaseLetters: LowercaseLettersTuple = [
  ...'abcdefghijklmnopqrstuvwxyz',
] as LowercaseLettersTuple;

/**
 * Runtime array containing all uppercase English letters in alphabetical order.
 * Corresponds to the UppercaseLettersTuple type.
 *
 * @example
 * ```ts
 * console.log(uppercaseLetters[0]); // 'A'
 * console.log(uppercaseLetters.length); // 26
 * uppercaseLetters.forEach(letter => console.log(letter));
 * ```
 */
export const uppercaseLetters: UppercaseLettersTuple = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
] as UppercaseLettersTuple;

//endregion Runtime Constants

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
