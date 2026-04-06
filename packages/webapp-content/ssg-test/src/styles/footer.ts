/**
 * Footer newsticker animation styles.
 *
 * A CSS-only vertical ticker that scrolls through quotes one line at
 * a time. The footer clips to a single line height (`1lh`) and the
 * inner track translates upward on a looping keyframe animation.
 */
import {
  cssLh,
  cssPercent,
  cssS,
  cssTranslateY,
  hCss as $,
} from '@monochromatic-dev/module-hyperscript/ts';

//region Constants

/**
 * Number of quotes in the ticker.
 *
 * @example
 * ```ts
 * QUOTE_COUNT // 6
 * ```
 */
const QUOTE_COUNT = 6;

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

//endregion

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
    const holdEnd = (i * (HOLD_DURATION + SCROLL_DURATION) + HOLD_DURATION) / TOTAL_DURATION * 100;
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
      decls: { transform: cssTranslateY(cssPercent(-(QUOTE_COUNT - 1) * (100 / QUOTE_COUNT),),), },
    },),
  );

  return stops;
}

//endregion

//region Main export

/**
 * Footer and ticker track styles with scroll animation.
 *
 * @returns CSS string for footer rules and `@keyframes ticker-scroll`
 *
 * @example
 * ```ts
 * const css = footerStyles();
 * ```
 */
export function footerStyles(): string {
  return [
    $({
      rule: 'footer',
      decls: {
        'overflow-block': 'clip',
        'block-size': cssLh(1,),
        'text-align': 'center',
      },
    },),
    $({
      rule: 'footer p',
      decls: {
        'margin-block': 0,
      },
    },),
    $({
      rule: '.ticker-track',
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

//endregion
