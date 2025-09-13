import type {
  $ as HasNoTrailingCommas,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNTC/t/index.ts';

import {
  $ as inQuotes,
} from '@_/types/t object/t record/t p string/t rangeNumber/t int/w/t array t p string hasQuotedSyntax doubleQuote/inQuotes/r s/p n/index.ts';
import type {$ as RangeInt} from '@_/types/t object/t record/t p string/t rangeNumber/t int/t/index.ts';
import type {$ as Int} from '@_/types/t number/t finite/t int/t/index.ts';
import type {$ as Jsonc} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

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
export function $(value: Jsonc,): value is HasNoTrailingCommas {
  const potentialTrailingCommas = value.matchAll(/,\w{0,}[\}\]]/gv,);

  for (const potentialTrailingComma of potentialTrailingCommas) {
    const rangeInt = {
      startInclusive: potentialTrailingComma.index as Int,
      endInclusive: (potentialTrailingComma.index + potentialTrailingComma[0].length) as Int,
    } as RangeInt;

    const rangeIntWInQuotesInfo = inQuotes({value: rangeInt, strs: [value]});

    // return false for the entire fn on not-in-quotes

    if (rangeIntWInQuotesInfo.__brand.inQuotes?.get(value) === false) {
      return false;
    }
  }

  return true;
}
