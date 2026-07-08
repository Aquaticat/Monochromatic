/**
 * ANSI color helpers for Claude statusline output.
 *
 * @module
 */

//region ANSI escape constants

/**
 * ANSI reset; appended after every coloured segment to avoid bleeding into adjacent text.
 */
const RESET = '\u001B[0m';

/**
 * ANSI red; reserved for critical states.
 */
const RED = '\u001B[31m';

/**
 * ANSI green; reserved for healthy states.
 */
const GREEN = '\u001B[32m';

/**
 * ANSI yellow; reserved for caution states and the effort indicator.
 */
const YELLOW = '\u001B[33m';

/**
 * ANSI magenta; reserved for the upper context-usage tier below the maximum.
 */
const MAGENTA = '\u001B[35m';

/**
 * ANSI white; reserved for the top context-usage tier.
 */
const WHITE = '\u001B[37m';

//endregion ANSI escape constants

//region Color helper

/**
 * Wraps a string in an ANSI colour code and reset.
 *
 * @param code - escape sequence opening the colour scope
 *
 * @param value - content to render inside that scope
 *
 * @returns concatenation of code, content, and {@link RESET}
 *
 * @example
 * ```ts
 * color({ code: RED, value: 'warning' });
 * ```
 */
function color({
  code,
  value,
}: Readonly<{
  code: string;
  value: string;
}>,): string {
  return `${code}${value}${RESET}`;
}

//endregion Color helper

export {
  GREEN,
  MAGENTA,
  RED,
  WHITE,
  YELLOW,
  color,
};
