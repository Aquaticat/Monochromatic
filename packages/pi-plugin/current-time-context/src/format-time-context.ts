/**
 * Current-time context formatter exported from the pi package.
 *
 * @module
 */

import {
  formatTimeContext as sharedFormatTimeContext,
} from '@monochromatic-dev/agent-harness-shared-current-time-context/ts';

//region Formatting

/**
 * Formats a {@link Date} as hidden current-time context using local wall-clock time.
 *
 * This wrapper keeps the pi package API local while delegating to the shared
 * formatter ({@link sharedFormatTimeContext}) used by the Claude Code
 * prompt-time hook.
 *
 * @param now - timestamp to format through local 24-hour clock fields
 *
 * @returns `<time>HH:MM</time>` with zero-padded hour and minute
 *
 * @example
 * ```ts
 * formatTimeContext(new Date(2026, 4, 1, 20, 48));
 * // '<time>20:48</time>'
 * ```
 */
function formatTimeContext(now: Date,): string {
  return sharedFormatTimeContext(now,);
}

//endregion Formatting

export { formatTimeContext, };
