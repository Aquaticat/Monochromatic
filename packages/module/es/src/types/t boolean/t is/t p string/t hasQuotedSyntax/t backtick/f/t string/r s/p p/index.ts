import type {
  $ as BacktickSyntax,
} from '@_/types/type string/type hasQuotedSyntax/type backtick/type/index.ts';

/**
 * Checks if a string has backtick-quoted syntax by examining the first effective (unescaped) quote.
 *
 * Determines quoted syntax type by finding the first quote character that is not escaped
 * and checking if it's a backtick. Handles escaped backslashes properly to distinguish
 * between escaped quotes and quotes following escaped backslashes.
 *
 * @param value - String to check for backtick-quoted syntax
 * @returns True if the first effective quote is a backtick
 * @example
 * ```ts
 * $('`hello`'); // true - starts with backtick
 * $('"hello"'); // false - starts with double quote
 * $("'hello'"); // false - starts with single quote
 * $('no quotes'); // false - no quotes found
 * $('\\`hello`'); // false - first quote is escaped
 * $('\\\\`hello`'); // true - quote after escaped backslash
 * $('`template ${var}`'); // true - backtick template literal
 * ```
 */
export function $(value: string,): value is BacktickSyntax {
  // get first effective (unescaped) quote
  const firstEffectiveQuoteMatch = value.match(/(?<!\\)(?:\\\\)*['"`]/,);

  // assert that's a backtick
  return firstEffectiveQuoteMatch?.[0] === '`';
}
