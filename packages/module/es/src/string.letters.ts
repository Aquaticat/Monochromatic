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