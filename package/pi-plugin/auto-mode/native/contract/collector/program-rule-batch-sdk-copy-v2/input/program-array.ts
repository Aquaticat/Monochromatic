/**
 Native program containers retain array admission without erasing their declared element contracts. @module
 */

/**
 Preserve native array admission while keeping borrowed elements unknown rather than any.

 @param value - original native group container

 @returns whether the original container is an array

 @example isProgramArray(originalCalls);
 */
export function isProgramArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
