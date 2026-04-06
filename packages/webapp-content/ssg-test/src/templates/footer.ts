/**
 * Site footer template with rolling newsticker.
 *
 * Renders a CSS-only vertical ticker that cycles through a list of
 * quotes one line at a time via `@keyframes` translation.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { TICKER_QUOTES, } from './ticker-quotes.ts';

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
