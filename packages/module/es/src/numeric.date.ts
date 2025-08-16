/**
 * Type guard that checks if a value is a Date object using Object.prototype.toString.
 *
 * This function uses the most reliable method for detecting Date objects by checking
 * the internal [[Class]] property via Object.prototype.toString. More reliable than
 * instanceof Date for cross-frame scenarios and corrupted Date objects. Essential
 * for validating date inputs and temporal data processing.
 *
 * @param value - Value to test for Date object type
 * @returns True if value is a Date object, false otherwise
 *
 * @example
 * Basic Date object checking:
 * ```ts
 * console.log(isObjectDate(new Date())); // true
 * console.log(isObjectDate(new Date("2023-01-01"))); // true
 * console.log(isObjectDate("2023-01-01")); // false
 * console.log(isObjectDate(1234567890000)); // false (timestamp)
 * console.log(isObjectDate({})); // false
 * ```
 *
 * @example
 * Validating user input for date operations:
 * ```ts
 * function formatDate(input: unknown): string {
 *   if (isObjectDate(input)) {
 *     return input.toISOString().split('T')[0];
 *   }
 *   return "Invalid date";
 * }
 * ```
 *
 * @example
 * Filtering arrays for Date objects:
 * ```ts
 * const mixed = [new Date(), "2023-01-01", 1234567890, new Date("invalid")];
 * const dates = mixed.filter(isObjectDate);
 * const validDates = dates.filter(date => !isNaN(date.getTime()));
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isObjectDate(value: unknown,): value is Date {
  return Object.prototype.toString.call(value,) === '[object Date]';
}