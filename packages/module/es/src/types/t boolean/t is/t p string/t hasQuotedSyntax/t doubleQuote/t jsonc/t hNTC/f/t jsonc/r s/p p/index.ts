import type {
  $ as HasNoTrailingCommas,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNTC/t/index.ts';

// TODO: Change this to use rangeInt is inside quotes.

/**
 * Checks if a JSONC string contains no trailing commas.
 *
 * Analyzes the input string to detect trailing commas (commas followed by whitespace
 * and closing brackets/braces) while properly ignoring commas that appear inside
 * quoted strings. Handles escaped quotes and backslashes correctly to distinguish
 * between actual string delimiters and escaped characters.
 *
 * @param value - JSONC string to check for trailing commas
 * @returns True if no trailing commas are found, false otherwise
 * @example
 * ```ts
 * $('{"a": 1}'); // true - no trailing commas
 * $('{"a": 1,}'); // false - has trailing comma
 * $('[1, 2, 3]'); // true - no trailing commas
 * $('[1, 2, 3,]'); // false - has trailing comma
 * $('{"text": "value with , inside"}'); // true - comma inside string is ignored
 * $('{"a": 1, "b": 2}'); // true - normal comma, not trailing
 * ```
 */
export function $(value: string,): value is HasNoTrailingCommas {
  const potentialTrailingCommas = value.matchAll(/,\w{0,}[\}\]]/gv,);
}
