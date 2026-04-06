import type {
  $ as hasNoBlockComments,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNBC/t/index.ts';
import type {
  $ as hasNoInlineComments,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNIC/t/index.ts';
import type {
  $ as hasNoTrailingCommas,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNTC/t/index.ts';

/**
 * Type guard checking whether a string is valid strict JSON (no comments, no trailing commas).
 *
 * @param value - string to parse as strict JSON
 *
 * @returns `true` when the string parses as valid JSON
 *
 * @example
 * ```ts
 * $('{"key": "value"}'); // true
 * $('{"key": "value",}'); // false (trailing comma)
 * $('not json'); // false
 * ```
 */
export function $(
  value: string,
): value is hasNoTrailingCommas & hasNoBlockComments & hasNoInlineComments {
  try {
    JSON.parse(
      value,
      function alwaysNull() {
        return null;
      },
    );
    return true;
  }
  catch {
    return false;
  }
}
