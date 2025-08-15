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