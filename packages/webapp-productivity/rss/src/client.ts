// 104 lines: scroll observer + feed binding are tightly coupled; splitting loses the shared closure context
import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';
import {
  HALF,
  QUARTER,
  THREE_QUARTERS,
} from '@monochromatic-dev/module-numeric-const';
import * as v from 'valibot';

//region Scroll event observer: Tracks element visibility and dispatches custom scroll lifecycle events

/**
 * Attaches an IntersectionObserver to an element, dispatching custom events
 * for scroll lifecycle transitions (enter, leave, half-visible, fully visible, scrolled out).
 *
 * @param scrollOptions - Element to observe and optional IntersectionObserver configuration
 *
 * @returns IntersectionObserver instance controlling the observation
 *
 * @example
 * ```ts
 * const observer = addScrollEvents({ element: myDiv });
 * ```
 */
function addScrollEvents(scrollOptions: {
  element: HTMLElement;
  options?: IntersectionObserverInit;
},): IntersectionObserver {
  /** Destructured inputs so the body reads without `scrollOptions.` prefix. */
  const {
    element,
    options = {},
  } = scrollOptions;
  /** Defaults merged with caller overrides so the observer sees a complete config. */
  const config: IntersectionObserverInit = {
    threshold: [
      0,
      QUARTER,
      HALF,
      THREE_QUARTERS,
      1,
    ],
    rootMargin: '0px',
    ...options,
  };

  /** Closure latch so `scrolledIn` fires exactly once per visibility cycle. */
  let wasFullyVisible = false;
  /** Closure cursor for ratio crossings so enter/leave events trigger on transition, not state. */
  let lastRatio = 0;

  /** IntersectionObserver bound to the closure state above so callbacks share lifecycle. */
  const observer = new IntersectionObserver(
    function onIntersect(entries,) {
      /** First entry per spec, used as the source of the ratio reading. */
      const [entry,] = entries;
      if (!entry) {
        console.error(
          `empty entries for observer`,
          entries,
          observer,
        );
        return;
      }
      /** Current intersection ratio used by every transition check below. */
      const ratio = entry.intersectionRatio;

      if (ratio === 1 && !wasFullyVisible) {
        wasFullyVisible = true;
        element.dispatchEvent(new CustomEvent('scrolledIn',),);
      }

      if (wasFullyVisible && ratio === 0) {
        element.dispatchEvent(new CustomEvent('scrolledOut',),);
        wasFullyVisible = false;
      }

      if (lastRatio === 0 && ratio > 0)
        element.dispatchEvent(new CustomEvent('enterViewport',),);

      if (lastRatio > 0 && ratio === 0)
        element.dispatchEvent(new CustomEvent('leaveViewport',),);

      if (ratio >= HALF && lastRatio < HALF)
        element.dispatchEvent(new CustomEvent('halfVisible',),);

      lastRatio = ratio;
    },
    config,
  );

  observer.observe(element,);
  return observer;
}

//endregion Scroll event observer

//region Feed element binding: Connects scroll events to the ignore API for auto-dismissal

/**
 * All feed elements on the page, bound to scroll-based ignore behavior.
 *
 * @see `addScrollEvents` for the scroll lifecycle that triggers ignore calls
 */
const elements: NodeListOf<HTMLElement> = document.querySelectorAll<HTMLElement>(
  '.feed',
);
elements.forEach(function bindScrollIgnore(element,) {
  addScrollEvents({ element, },);
  element.addEventListener(
    'scrolledOut',
    function onScrolledOut() {
      void (async function onScrolledOutAsync(): Promise<void> {
        try {
          console.error('scrolledOut',);
          /** Required metadata wrapper so a missing element fails loud, not silent. */
          const metadata = nonNullishOrThrow(
            element.querySelector<HTMLElement>('.feed__metadata',),
          );
          /** Required link anchor inside metadata so the href is guaranteed present. */
          const anchor: HTMLAnchorElement = nonNullishOrThrow(
            metadata.querySelector<HTMLAnchorElement>('.feed__link',),
          );

          /** Request body shape varies by whether the href is a valid URL. */
          const body: Record<string, string> = v
              .safeParse(
                v.pipe(
                  v.string(),
                  v.url(),
                ),
                anchor.href,
              )
              .success
            ? { link: anchor.href, }
            : { metadataOuterHtml: metadata.outerHTML, };

          /** Ignore-API response held so the ok check and text read share one Response. */
          const response = await fetch(
            `/api/ignore/new`,
            {
              method: 'POST',
              body: JSON.stringify(body,),
            },
          );
          if (!response.ok) {
            console.error(
              `ignore request failed`,
              response,
            );
            return;
          }
          /** Response text persisted for the success log line. */
          const text = await response.text();
          console.error(`ignored: ${text}`,);
          element.dataset.ignored = '';
        }
        catch (error: unknown) {
          console.error(
            `scrolledOut handler failed`,
            error,
          );
        }
      })();
    },
  );
},);

//endregion Feed element binding

export {};
