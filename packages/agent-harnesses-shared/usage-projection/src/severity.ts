/**
 * Rate-limit severity selection and styling.
 *
 * @module
 */

import {
  PERCENT_BASE,
  PROJECTED_OVERRUN_THRESHOLD,
  RATE_LIMIT_CAUTION_THRESHOLD,
  RATE_LIMIT_CRITICAL_THRESHOLD,
} from './constants.ts';
import type {
  RateLimitSeverity,
  RateLimitSnapshot,
  RateLimitStyle,
} from './types.ts';

//region Severity helpers

/**
 * Computes remaining percentage for display.
 *
 * @param snapshot - current limiter sample
 *
 * @returns remaining percentage clamped to zero
 *
 * @example
 * ```ts
 * remainingPercent(snapshot);
 * ```
 */
function remainingPercent(snapshot: RateLimitSnapshot,): number {
  return Math.max(
    0,
    Math.floor(PERCENT_BASE - snapshot.usedPercent,),
  );
}

/**
 * Selects rate-limit severity from remaining capacity and projection.
 *
 * @param remaining - remaining percentage
 *
 * @param projectedPercent - projected end-of-window usage percentage
 *
 * @returns selected severity
 *
 * @example
 * ```ts
 * rateLimitSeverity({ remaining: 12, projectedPercent: 0 });
 * ```
 */
function rateLimitSeverity({
  remaining,
  projectedPercent,
}: Readonly<{
  remaining: number;
  projectedPercent: number;
}>,): RateLimitSeverity {
  if ((projectedPercent > PROJECTED_OVERRUN_THRESHOLD) || (remaining <= RATE_LIMIT_CRITICAL_THRESHOLD))
    return 'red';
  if (remaining <= RATE_LIMIT_CAUTION_THRESHOLD)
    return 'yellow';
  return 'green';
}

/**
 * Styles text with the selected rate-limit severity callback.
 *
 * @param text - text to style
 *
 * @param severity - selected severity
 *
 * @param style - host style callbacks
 *
 * @returns styled text
 *
 * @example
 * ```ts
 * styleBySeverity({ text: '50% left', severity: 'green', style });
 * ```
 */
function styleBySeverity({
  text,
  severity,
  style,
}: Readonly<{
  text: string;
  severity: RateLimitSeverity;
  style: RateLimitStyle;
}>,): string {
  if (severity === 'red')
    return style.red(text,);
  if (severity === 'yellow')
    return style.yellow(text,);
  return style.green(text,);
}

//endregion Severity helpers

export {
  rateLimitSeverity,
  remainingPercent,
  styleBySeverity,
};
