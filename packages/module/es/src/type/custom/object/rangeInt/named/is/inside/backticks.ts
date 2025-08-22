import type { $ as rangeInt, } from '../../../unnamed/index.ts';

/**
 * Determines if a range position is inside backticks by counting non-escaped backticks preceding it.
 *
 * Uses parity logic: odd count of effective backticks before position indicates inside backticks,
 * even count indicates outside backticks. Handles escaped backslashes properly to distinguish
 * between escaped backtick ('\`') and backtick following escaped backslashes ('\\\`').
 *
 * Assumes input string is well-formed with even total number of effective backticks (all backticks properly paired).
 *
 * @param value - Range object with startInclusive position to check
 * @param str - String to analyze, assumed to have even number of effective quotes
 * @returns True if position is inside backticks, false if outside
 * @example
 * ```ts
 * // Position 1 in quoted content
 * $({value: {startInclusive: 1, endInclusive: 1}, str: '`a`'}); // true
 *
 * // Position 0 before any quotes
 * $({value: {startInclusive: 0, endInclusive: 0}, str: 'a``'}); // false
 *
 * // Position 3 after opening quotes
 * $({value: {startInclusive: 3, endInclusive: 3}, str: '```a`'}); // true
 * ```
 */
export function $(
  { value, str, }: { value: rangeInt; str: string; },
): boolean {
  const strBefore = str.slice(0, value.startInclusive,);
  // Odd or even?
  const effectiveBackticksInStrBefore =
    Array.from(strBefore.matchAll(/(?<!\\)(?:\\\\)*`/g,),).length;
  return (effectiveBackticksInStrBefore % 2 !== 0);
}
