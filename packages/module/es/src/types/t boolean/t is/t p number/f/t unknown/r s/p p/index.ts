// Includes NaN

/**
 * Type guard checking whether value is a number (including NaN).
 *
 * @param value - value to check
 *
 * @returns `true` when value is of type `number`
 */
export function $(
  value: unknown,
): value is number {
  return typeof value === 'number';
}
