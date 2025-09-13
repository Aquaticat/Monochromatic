import type {
  $ as Value,
} from '@_/types/t object/t record/t p string/t rangeNumber/t int/t/index.ts';
import type {
  $ as DoubleQuote,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t/index.ts';

import { $ as named, } from '../p n/index.ts';

/**
 * Determines if a range position is inside double quotes for multiple strings and merges with existing quote information.
 *
 * For each string, uses quote parity logic: odd count of effective quotes before position indicates inside quotes,
 * even count indicates outside quotes. Handles escaped backslashes properly to distinguish
 * between escaped quotes (`\"`) and quotes following escaped backslashes (`\\\"`).
 *
 * Assumes all input strings are well-formed with even total number of effective quotes (all quotes properly paired).
 *
 * @param value - Range object with startInclusive position to check
 * @param strs - Array of double-quoted syntax strings to analyze
 * @returns Updated Value object with merged quote status information in the inQuotes map
 * @example
 * ```ts
 * const range = { startInclusive: 1, endInclusive: 1, __brand: { rangeNumber: true } };
 * const strings = ['"hello"', 'world"test"'] as DoubleQuote[];
 * const result = $(range, strings);
 * // result.__brand.inQuotes will contain the quote status for each string
 * ```
 */
export function $(value: Value, strs: DoubleQuote[],): Value {
  return named({ value, strs, },);
}
