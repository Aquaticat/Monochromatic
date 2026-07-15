/**
 * Plain usage projection style callbacks.
 *
 * @module
 */

import type { RateLimitStyle, } from './types.ts';

/**
 * Returns text unchanged.
 *
 * @param text - value to return unchanged
 *
 * @returns original text
 *
 * @example
 * ```ts
 * identityStyle('warning');
 * ```
 */
function identityStyle(text: string,): string {
  return text;
}

/**
 * Style object used by tests and non-UI execution paths.
 */
const PLAIN_RATE_LIMIT_STYLE: RateLimitStyle = {
  green: identityStyle,
  yellow: identityStyle,
  red: identityStyle,
};

export {
  PLAIN_RATE_LIMIT_STYLE,
  identityStyle,
};
