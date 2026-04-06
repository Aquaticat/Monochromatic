/**
 * Site footer template with rolling newsticker.
 *
 * Renders a CSS-only vertical ticker that cycles through a list of
 * quotes one line at a time via `@keyframes` translation.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

/**
 * Ticker quotes displayed one at a time in the footer.
 *
 * @example
 * ```ts
 * TICKER_QUOTES.length // 6
 * ```
 */
const TICKER_QUOTES = [
  'flavor text flavored flavorless',
  'sloppiest sloppy slop',
  'drinking drinks may make drinkers drunk',
  'programmable blogging program programmed for blogging',
  'ErrorError: ErrorError in erroring Error to ErrorError',
  'pipeline operator stuck in pipeline',
];

/**
 * Renders the site footer with a rolling newsticker.
 *
 * The footer clips to a single line height and the inner track
 * animates vertically to reveal each quote in sequence.
 *
 * @returns HTML string for the `<footer>` element
 *
 * @example
 * ```ts
 * const html = footerFragment();
 * ```
 */
export function footerFragment(): string {
  return h({
    tag: 'footer',
    children: [
      h({
        tag: 'div',
        class: 'ticker-track',
        children: TICKER_QUOTES.map(function tickerLine(quote,) {
          return h({
            tag: 'p',
            text: quote,
          },);
        },),
      },),
    ],
  },);
}
