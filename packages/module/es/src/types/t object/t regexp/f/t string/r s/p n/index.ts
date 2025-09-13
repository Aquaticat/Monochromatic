/**
 * Converts a literal string into a literal RegExp that matches and only matches the string.
 *
 * Escapes all regex metacharacters in the input string to create a pattern that matches
 * the exact string content. Useful for creating regex patterns from user input or
 * when you need to match literal text that may contain special regex characters.
 *
 * @param str - to convert to regex pattern
 * @returns RegExp that matches the exact input string
 *
 * @example
 * ```ts
 * $("I love you."); // /I love you\./
 * $("Hello.*"); // /Hello\.\*{1}/
 * $("test[brackets]"); // /test\[brackets\]/
 * $("path/to/file"); // /path\/to\/file/
 * ```
 *
 * @example
 * Common use cases for safe regex creation:
 * ```ts
 * // Search for literal text that may contain special characters
 * const searchTerm = "user.name";
 * const regex = $(searchTerm);
 * regex.test("user.name"); // true
 * regex.test("userXname"); // false
 *
 * // Escape user input for safe regex matching
 * const userInput = "price: $100.00";
 * const safeRegex = $(userInput);
 * safeRegex.test("price: $100.00"); // true
 * ```
 *
 * Note: This function escapes all regex metacharacters including:
 * . * + ? ^ $ \{ \} [ ] ( ) | \\ /
 *
 * The regex pattern `/[$()*+.?[\\\]^{|}]/g` matches each metacharacter and replaces it with
 * an escaped version by prefixing it with a backslash. Here's what each metacharacter means:
 *
 * - `$` - End of string anchor (matches position, not character)
 * - `(` and `)` - Capturing group delimiters for grouping and capturing matches
 * - `*` - Zero or more quantifier (matches preceding element 0 or more times)
 * - `+` - One or more quantifier (matches preceding element 1 or more times)
 * - `.` - Any character wildcard (matches any single character except newline)
 * - `?` - Zero or one quantifier (matches preceding element 0 or 1 times)
 * - `[` and `]` - Character class delimiters for matching sets of characters
 * - `\` - Escape character for escaping special regex characters
 * - `^` - Start of string anchor OR negation in character classes
 * - `{` and `}` - Quantifier delimiters for exact repetition counts \{n,m\}
 * - `|` - Alternation operator for matching either left or right expression
 *
 * The forward slash `/` is also escaped in the replacement to prevent conflicts with
 * regex literal delimiters, even though it's not included in the character class pattern.
 */
export function $({str}: {str:string},): RegExp {
  // Escape all regex metacharacters to create a literal pattern
  // The pattern matches: $ ( ) * + . ? [ \ ] ^ { | }
  // Each matched character gets replaced with a backslash-escaped version
  // For example: "user.name" becomes "user\.name" which matches literal "user.name"
  const escapedPattern = str.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&',);
  return new RegExp(escapedPattern,);
}
