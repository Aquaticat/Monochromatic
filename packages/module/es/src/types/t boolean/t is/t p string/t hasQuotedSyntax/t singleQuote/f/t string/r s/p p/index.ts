import type {
  $ as SingleQuotedSyntax,
} from '@_/types/t string/t hasQuotedSyntax/t singleQuote/t/index.ts';

/**
 * Checks if a string has single-quoted syntax by examining the first effective (unescaped) quote.
 *
 * Determines quoted syntax type by finding the first quote character that is not escaped
 * and checking if it's a single quote. Handles escaped backslashes properly to distinguish
 * between escaped quotes and quotes following escaped backslashes.
 *
 * @param value - String to check for single-quoted syntax
 *
 * @returns True if the first effective quote is a single quote
 *
 * @example
 * ```ts
 * $("'hello'"); // true - starts with single quote
 * $('"hello"'); // false - starts with double quote
 * $('`hello`'); // false - starts with backtick
 * $('no quotes'); // false - no quotes found
 * $("\\'hello'"); // false - first quote is escaped
 * $('\\\\\'hello\''); // true - quote after escaped backslash
 * $("{'a': 'b'}"); // true - quote inside
 * ```
 */
export function $(value: string,): value is SingleQuotedSyntax {
  // get first effective (unescaped) quote
  /**
   * First unescaped quote, distinguishing single quote from other quote kinds.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- canonical first-unescaped-quote scan; the lookbehind `(?<!\\)(?:\\\\)*` matches a quote not preceded by an odd number of backslashes — expressing the escape-counting rule via index walk is significantly more code and equally bounded. Input length bounds runtime linearly; no nested quantifiers means no backtracking.
  const firstEffectiveQuoteMatch = /(?<!\\)(?:\\\\)*["'`]/.exec(value,);

  // assert that's a single quote
  return firstEffectiveQuoteMatch?.[0]
    === "'";
}
