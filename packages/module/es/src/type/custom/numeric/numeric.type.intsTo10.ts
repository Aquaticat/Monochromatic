/**
 * Union type representing negative integers from -10 to -1 (inclusive).
 * Useful for representing negative offsets, decrements, or countdown values.
 *
 * @example
 * ```ts
 * function moveBackward(steps: IntsNegative10toNegative1): number {
 *   return steps; // Guaranteed to be negative
 * }
 *
 * const offset: IntsNegative10toNegative1 = -5; // Valid
 * // const invalid: IntsNegative10toNegative1 = 0; // Error: not assignable
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type IntsNegative10toNegative1 =
  | -10
  | -9
  | -8
  | -7
  | -6
  | -5
  | -4
  | -3
  | -2
  | -1;

/**
 * Union type representing integers from -10 to 0 (inclusive).
 * Useful for representing non-positive values, decrements, or deficit scenarios.
 *
 * @example
 * ```ts
 * function adjustBalance(change: IntsNegative10to0): number {
 *   return change; // Guaranteed to be non-positive
 * }
 *
 * const deficit: IntsNegative10to0 = -3; // Valid
 * const neutral: IntsNegative10to0 = 0;  // Valid (no change)
 * // const invalid: IntsNegative10to0 = 1; // Error: positive not allowed
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type IntsNegative10to0 =
  | -10
  | -9
  | -8
  | -7
  | -6
  | -5
  | -4
  | -3
  | -2
  | -1
  | 0;

/**
 * Union type representing integers from -10 to 1 (inclusive).
 * Covers negative values, zero, and the first positive integer.
 * Useful for ranges that need to include minimal positive values.
 *
 * @example
 * ```ts
 * function adjustScore(modifier: IntsNegative10to1): number {
 *   return modifier; // Can be negative, zero, or 1
 * }
 *
 * const penalty: IntsNegative10to1 = -5; // Valid (penalty)
 * const bonus: IntsNegative10to1 = 1;    // Valid (small bonus)
 * const neutral: IntsNegative10to1 = 0;  // Valid (no change)
 * // const invalid: IntsNegative10to1 = 2; // Error: outside range
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type IntsNegative10to1 =
  | -10
  | -9
  | -8
  | -7
  | -6
  | -5
  | -4
  | -3
  | -2
  | -1
  | 0
  | 1;

/**
 * Union type representing integers from -10 to 10 (inclusive).
 * Comprehensive range for bidirectional values, offsets, or symmetric scales.
 *
 * @example
 * ```ts
 * function adjustTemperature(change: IntsNegative10to10): number {
 *   return change; // Can be negative, zero, or positive
 * }
 *
 * const increase: IntsNegative10to10 = 5;  // Valid (warmer)
 * const decrease: IntsNegative10to10 = -3; // Valid (cooler)
 * const noChange: IntsNegative10to10 = 0;  // Valid (same)
 * // const invalid: IntsNegative10to10 = 15; // Error: outside range
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type IntsNegative10to10 =
  | -10
  | -9
  | -8
  | -7
  | -6
  | -5
  | -4
  | -3
  | -2
  | -1
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

/**
 * Union type representing integers from -1 to 10 (inclusive).
 * Covers minimal negative value, zero, and positive integers up to 10.
 * Useful for scenarios requiring mostly positive values with minimal negative allowance.
 *
 * @example
 * ```ts
 * function setPlayerLevel(level: IntsNegative1to10): void {
 *   console.log(`Level: ${level}`);
 * }
 *
 * const maxLevel: IntsNegative1to10 = 10;  // Valid
 * const startLevel: IntsNegative1to10 = 1; // Valid
 * const penalty: IntsNegative1to10 = -1;   // Valid (minimal penalty)
 * // const invalid: IntsNegative1to10 = -5; // Error: too negative
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type IntsNegative1to10 =
  | -1
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

/**
 * Union type representing integers from 0 to 10 (inclusive).
 * Commonly used for ratings, progress indicators, or small counting scenarios.
 *
 * @example
 * ```ts
 * function setRating(rating: Ints0to10): void {
 *   console.log(`Rating: ${rating}/10`);
 * }
 *
 * const userRating: Ints0to10 = 8; // Valid
 * const progress: Ints0to10 = 0;   // Valid (starting point)
 * // const invalid: Ints0to10 = 11; // Error: not assignable
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type Ints0to10 =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

/**
 * Union type representing positive integers from 1 to 10 (inclusive).
 * Ideal for scenarios requiring positive-only values like quantities, levels, or rankings.
 *
 * @example
 * ```ts
 * function setDifficulty(level: Ints1to10): void {
 *   console.log(`Difficulty level: ${level}`);
 * }
 *
 * const playerLevel: Ints1to10 = 5; // Valid
 * const maxLevel: Ints1to10 = 10;   // Valid
 * // const invalid: Ints1to10 = 0;  // Error: zero not allowed
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export type Ints1to10 =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;
