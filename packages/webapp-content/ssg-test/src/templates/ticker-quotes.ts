/**
 * Ticker quotes displayed in the footer newsticker.
 *
 * Shared between the footer template (`footer.ts`) and the footer
 * styles (`styles/footer.ts`) so the keyframe animation stays in
 * sync with the actual number of quotes.
 */

/**
 * Ticker quotes displayed one at a time in the footer.
 *
 * @example
 * ```ts
 * TICKER_QUOTES.length // 6
 * ```
 */
export const TICKER_QUOTES = [
  'flavor text flavored flavorless',
  'sloppiest sloppy slop',
  'drinking drinks may make drinkers drunk',
  'programmable blogging program programmed for blogging',
  'ErrorError: ErrorError in erroring Error to ErrorError',
  'pipeline operator stuck in pipeline',
] as const;
