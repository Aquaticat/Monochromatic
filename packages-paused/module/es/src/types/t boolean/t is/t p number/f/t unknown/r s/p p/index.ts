// Includes NaN

/**
 * Type guard checking whether value is a number (including NaN).
 *
 * @param value - value to check
 *
 * @returns `true` when value is of type `number`
 *
 * @example
 * ```ts
 * $(42); // true
 * $(NaN); // true
 * $('42'); // false
 * ```
 */
export function $(
  value: unknown,
): value is number {
  return (typeof value) === 'number';
}
