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
 * TICKER_QUOTES.length // 9
 * ```
 */
const TICKER_QUOTES = [
  // Cookie Clicker: the game's newsticker has this news
  'flavor text flavored flavorless',
  // AI slop: "slop" as slang for low-effort AI-generated content
  'sloppiest sloppy slop',
  // SpongeBob, the Krusty Krab training video: "the finest dining establishment ever established for dining"
  'programmable blogging program programmed for blogging',
  // Recursive error message: an error handler that errors while handling errors
  'ErrorError: ErrorError in erroring Error to ErrorError',
  // TC39 pipeline operator proposal: stuck in the standardization pipeline since 2017
  'pipeline operator stuck in pipeline',
  // Mafumafu: "すーぱーぬこになれんかった" (Super Nuko ni Narenkatta, 2019)
  `I wasn't able to become a super cat after all.`,
  // Francis Bacon: "Of Studies" (1597), with the literal food reading swapped in
  'Bacon: Some ... are to be tasted, others to be swallowed, and some few to be chewed and digested.',
  // Viral video: Exotic Black TV cleaning a Himalayan marmot with a paint roller (2025)
  'Marmots can be cleaned with paint rollers.',
  // Phil Karlton: "There are only two hard things in Computer Science: cache invalidation and naming things."
  'There are only 10 hard problems in computer science: cache invalidation, naming things, and off by one.',
] as const;

//endregion Ticker quotes

//region Animation constants

/**
 * Number of quotes in the ticker.
 */
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
 * TOTAL_DURATION // 31.5
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
  /**
   * Accumulator pushed into across the loop; flattened into the keyframe rule list at the end.
   */
  const stops: string[] = [];
  /**
   * Vertical translate granularity expressed as a percentage of the ticker height.
   */
  const stepPercent = 100 / QUOTE_COUNT;

  for (let loopIndex = 0; loopIndex < QUOTE_COUNT; loopIndex++) {
    /**
     * Loop iteration's hold-start percentage marking when this quote becomes stationary.
     */
    const holdStart = ((loopIndex * (HOLD_DURATION + SCROLL_DURATION)) / TOTAL_DURATION) * 100;
    /**
     * Loop iteration's hold-end percentage marking when this quote begins scrolling out.
     */
    const holdEnd = (((loopIndex * (HOLD_DURATION + SCROLL_DURATION)) + HOLD_DURATION)
      / TOTAL_DURATION)
      * 100;
    /**
     * Pre-formatted transform value applied to the hold-start and hold-end stops.
     */
    const offset = cssTranslateY(cssPercent(-(loopIndex * stepPercent),),);

    stops.push(
      $({
        rule: `${holdStart.toFixed(2,)}%`,
        decls: { transform: offset, },
      },),
    );

    if (loopIndex < (QUOTE_COUNT - 1)) {
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
        transform: cssTranslateY(
          cssPercent((-(QUOTE_COUNT - 1)) * (100 / QUOTE_COUNT),),
        ),
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
