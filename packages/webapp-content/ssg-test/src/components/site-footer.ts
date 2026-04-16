/**
 * Site footer with rolling newsticker.
 *
 * Colocates the CSS animation, keyframe generation, ticker quotes,
 * and HTML template in a single `<site-footer>` custom element.
 * The footer clips to a single line height and the inner track
 * animates vertically to reveal each quote in sequence.
 */
import {
  cssLh,
  cssPercent,
  cssS,
  cssTranslateY,
  hCss as $,
  hHtml as h,
} from '@monochromatic-dev/module-hyperscript/ts';

//region Ticker quotes

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
] as const;

//endregion Ticker quotes

//region Animation constants

/** Number of quotes in the ticker. */
const QUOTE_COUNT = TICKER_QUOTES.length;

/**
 * Seconds each quote is held visible before scrolling.
 *
 * @example
 * ```ts
 * HOLD_DURATION // 3
 * ```
 */
const HOLD_DURATION = 3;

/**
 * Seconds for the scroll transition between quotes.
 *
 * @example
 * ```ts
 * SCROLL_DURATION // 0.5
 * ```
 */
const SCROLL_DURATION = 0.5;

/**
 * Total animation cycle duration in seconds.
 *
 * Each quote occupies `HOLD_DURATION + SCROLL_DURATION` seconds,
 * multiplied by the number of quotes.
 *
 * @example
 * ```ts
 * TOTAL_DURATION // 21
 * ```
 */
const TOTAL_DURATION = QUOTE_COUNT * (HOLD_DURATION + SCROLL_DURATION);

//endregion Animation constants

//region Keyframe generation

/**
 * Generates `@keyframes ticker-scroll` percentage stops.
 *
 * For each quote, two stops are produced:
 * - A hold stop at the start of the quote's display window
 * - A scroll-end stop after the transition to the next quote
 *
 * The final quote holds until 100% and wraps back to the start.
 *
 * @returns array of CSS keyframe rule strings
 *
 * @example
 * ```ts
 * const stops = tickerKeyframeStops();
 * // ['0%{transform:translateY(0%)}', '14.29%{transform:translateY(-16.6667%)}', ...]
 * ```
 */
function tickerKeyframeStops(): string[] {
  const stops: string[] = [];
  const stepPercent = 100 / QUOTE_COUNT;

  for (let i = 0; i < QUOTE_COUNT; i++) {
    const holdStart = (i * (HOLD_DURATION + SCROLL_DURATION) / TOTAL_DURATION) * 100;
    const holdEnd = (i * (HOLD_DURATION + SCROLL_DURATION) + HOLD_DURATION)
      / TOTAL_DURATION
      * 100;
    const offset = cssTranslateY(cssPercent(-(i * stepPercent),),);

    stops.push(
      $({
        rule: `${holdStart.toFixed(2,)}%`,
        decls: { transform: offset, },
      },),
    );

    if (i < QUOTE_COUNT - 1) {
      stops.push(
        $({
          rule: `${holdEnd.toFixed(2,)}%`,
          decls: { transform: offset, },
        },),
      );
    }
  }

  stops.push(
    $({
      rule: '100%',
      decls: {
        transform: cssTranslateY(cssPercent(-(QUOTE_COUNT - 1) * (100 / QUOTE_COUNT),),),
      },
    },),
  );

  return stops;
}

//endregion Keyframe generation

//region CSS

/**
 * Footer and ticker track styles with scroll animation.
 *
 * @returns CSS string for the `<site-footer>` element
 *
 * @example
 * ```ts
 * const styles = css();
 * ```
 */
export function css(): string {
  return [
    $({
      rule: 'site-footer footer',
      decls: {
        'overflow-block': 'clip',
        'block-size': cssLh(1,),
        'text-align': 'center',
      },
      children: [
        $({
          rule: '& p',
          decls: {
            'margin-block': 0,
          },
        },),
      ],
    },),
    $({
      rule: 'site-footer .ticker-track',
      decls: {
        'animation-name': 'ticker-scroll',
        'animation-duration': cssS(TOTAL_DURATION,),
        'animation-iteration-count': 'infinite',
        'animation-timing-function': 'ease-in-out',
      },
    },),
    $({
      at: 'keyframes',
      params: 'ticker-scroll',
      children: tickerKeyframeStops(),
    },),
  ]
    .join('\n',);
}

//endregion CSS

//region HTML

/**
 * Renders the site footer with a rolling newsticker.
 *
 * The footer clips to a single line height and the inner track
 * animates vertically to reveal each quote in sequence.
 *
 * @returns HTML string for the `<site-footer>` element
 *
 * @example
 * ```ts
 * const markup = html();
 * ```
 */
export function html(): string {
  return h({
    tag: 'site-footer',
    attrs: { 'data-is': '', },
    children: [
      h({
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
      },),
    ],
  },);
}

//endregion HTML
