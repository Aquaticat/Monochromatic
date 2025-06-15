/**
 * Checks if a string is enclosed in single quotes.
 * Verifies that the string starts and ends with single quote characters (`'`).
 *
 * @param input - String to check for single quote enclosure
 * @returns True if string starts and ends with single quotes
 *
 * @example
 * ```ts
 * isSingleQuotedString("'hello'"); // true
 * isSingleQuotedString('"hello"'); // false
 * isSingleQuotedString("hello"); // false
 * isSingleQuotedString("'"); // false (too short)
 * isSingleQuotedString("''"); // true (empty quoted string)
 * ```
 */
export function isSingleQuotedString(
  input: string,
): boolean {
  return input.startsWith("'") && input.endsWith("'");
}

/**
 * Checks if a string is enclosed in double quotes.
 * Verifies that the string starts and ends with double quote characters (`"`).
 *
 * @param input - String to check for double quote enclosure
 * @returns True if string starts and ends with double quotes
 *
 * @example
 * ```ts
 * isDoubleQuotedString('"hello"'); // true
 * isDoubleQuotedString("'hello'"); // false
 * isDoubleQuotedString("hello"); // false
 * isDoubleQuotedString('"'); // false (too short)
 * isDoubleQuotedString('""'); // true (empty quoted string)
 * ```
 */
export function isDoubleQuotedString(
  input: string,
): boolean {
  return input.startsWith('"') && input.endsWith('"');
}

/**
 * Converts a double-quoted string to single-quoted format.
 * If the string is already single-quoted, returns it unchanged.
 * Handles escape sequence conversion from double-quote format to single-quote format.
 *
 * @param input - String to convert to single-quoted format
 * @returns String converted to single quotes
 * @throws {Error} If input isn't properly quoted with single or double quotes
 *
 * @example
 * ```ts
 * toSingleQuotedString('"hello"'); // "'hello'"
 * toSingleQuotedString("'world'"); // "'world'" (unchanged)
 * toSingleQuotedString('"say \\"hi\\""'); // "'say \"hi\"'"
 *
 * // Throws error for unquoted strings
 * toSingleQuotedString('hello'); // Error: Expected quoted string
 * ```
 */
export function toSingleQuotedString(
  input: string,
): string {
  if (isSingleQuotedString(input)) {
    return input;
  }

  if (!isDoubleQuotedString(input)) {
    throw new Error(
      `Expected a string to be either already single or double quoted, but got: ${input}`,
    );
  }

  const doubleQuotedInputWoSideQuotes = input.slice(1, -1);
  const singleQuotedStringWoSideQuotes = doubleQuotedInputWoSideQuotes.replaceAll(
    String.raw`\"`,
    `'`,
  );
  return `'${singleQuotedStringWoSideQuotes}'`;
}

/**
 * Converts a single-quoted string to double-quoted format.
 * If the string is already double-quoted, returns it unchanged.
 * Handles escape sequence conversion from single-quote format to double-quote format.
 *
 * @param input - String to convert to double-quoted format
 * @returns String converted to double quotes
 * @throws {Error} If input isn't properly quoted with single or double quotes
 *
 * @example
 * ```ts
 * toDoubleQuotedString("'hello'"); // '"hello"'
 * toDoubleQuotedString('"world"'); // '"world"' (unchanged)
 * toDoubleQuotedString("'can\\'t'"); // '"can\'t"'
 *
 * // Throws error for unquoted strings
 * toDoubleQuotedString('hello'); // Error: Expected quoted string
 * ```
 */
export function toDoubleQuotedString(
  input: string,
): string {
  if (isDoubleQuotedString(input)) {
    return input;
  }

  if (!isSingleQuotedString(input)) {
    throw new Error(
      `Expected a string to be either already single or double quoted, but got: ${input}`,
    );
  }

  const singleQuotedInputWoSideQuotes = input.slice(1, -1);
  const doubleQuotedStringWoSideQuotes = singleQuotedInputWoSideQuotes.replaceAll(
    String.raw`\'`,
    `"`,
  );
  return `"${doubleQuotedStringWoSideQuotes}"`;
}
