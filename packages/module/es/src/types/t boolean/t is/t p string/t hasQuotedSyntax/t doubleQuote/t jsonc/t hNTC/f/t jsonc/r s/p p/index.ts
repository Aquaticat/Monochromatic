import type {
  $ as HasNoTrailingCommas,
} from '@/src/types/type string/type hasQuotedSyntax/type doubleQuote/type jsonc/type hNTC/type';

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
  let position = 0;
  let insideString = false;
  let escaped = false;

  while (position < value.length) {
    const currentChar = value[position];

    if (insideString) {
      // Handle escape sequences inside strings
      if (escaped)
        escaped = false;
      else if (currentChar === '\\')
        escaped = true;
      else if (currentChar === '"')
        insideString = false;
    }
    else {
      // Outside of strings
      if (currentChar === '"')
        insideString = true;
      else if (currentChar === ',') {
        // Check if this comma is a trailing comma
        let checkPosition = position + 1;

        // Skip whitespace and comments after the comma
        while (checkPosition < value.length) {
          const checkChar = value[checkPosition];

          // Skip whitespace
          if (/\s/.test(checkChar,)) {
            checkPosition++;
            continue;
          }

          // Skip inline comments
          if (checkChar === '/' && checkPosition + 1 < value.length) {
            if (value[checkPosition + 1] === '/') {
              // Skip to end of line
              checkPosition += 2;
              while (checkPosition < value.length && value[checkPosition] !== '\n')
                checkPosition++;
              if (checkPosition < value.length)
                checkPosition++; // Skip newline
              continue;
            }
            else if (value[checkPosition + 1] === '*') {
              // Skip block comment
              checkPosition += 2;
              while (checkPosition < value.length - 1) {
                if (value[checkPosition] === '*' && value[checkPosition + 1] === '/') {
                  checkPosition += 2;
                  break;
                }
                checkPosition++;
              }
              continue;
            }
          }

          // Check if we found a closing bracket/brace after comma and whitespace/comments
          if (checkChar === '}' || checkChar === ']')
            return false; // Found trailing comma

          break; // Found non-whitespace, non-comment, non-closing character
        }
      }
    }

    position++;
  }

  return true; // No trailing commas found
}
