// 104 lines: scroll observer + feed binding are tightly coupled; splitting loses the shared closure context
import { $ as notNullishOrThrow, } from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { z, } from 'zod/v4-mini';

//region Scroll event observer -- Tracks element visibility and dispatches custom scroll lifecycle events

/**
 * Attaches an IntersectionObserver to an element, dispatching custom events
 * for scroll lifecycle transitions (enter, leave, half-visible, fully visible, scrolled out).
 * @param options - Element to observe and optional IntersectionObserver configuration
 * @returns IntersectionObserver instance controlling the observation
 * @example
 * ```ts
 * const observer = addScrollEvents({ element: myDiv });
 * ```
 */
function addScrollEvents({ element, options = {}, }: {
  element: HTMLElement;
  options?: IntersectionObserverInit;
}): IntersectionObserver {
  const config: IntersectionObserverInit = {
    threshold: [0, 0.25, 0.5, 0.75, 1,],
    rootMargin: '0px',
    ...options,
  };

  let wasFullyVisible = false;
  let lastRatio = 0;

  const observer = new IntersectionObserver(function onIntersect(entries,) {
    const entry = entries[0];
    if (!entry) {
      console.error(`empty entries for observer`, entries, observer,);
      return;
    }
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

    const halfVisibleThreshold = 0.5;
    if (ratio >= halfVisibleThreshold && lastRatio < halfVisibleThreshold)
      element.dispatchEvent(new CustomEvent('halfVisible',),);

    lastRatio = ratio;
  }, config,);

  observer.observe(element,);
  return observer;
}

//endregion Scroll event observer

//region Feed element binding -- Connects scroll events to the ignore API for auto-dismissal

/** @see {@link addScrollEvents} for the scroll lifecycle that triggers ignore calls */
const elements: NodeListOf<HTMLElement> = document.querySelectorAll('.feed',);
elements.forEach(function bindScrollIgnore(element,) {
  addScrollEvents({ element, },);
  element.addEventListener('scrolledOut', async function onScrolledOut() {
    console.error('scrolledOut',);
    const metadata = notNullishOrThrow(element.querySelector('.feed__metadata',),);
    const anchor: HTMLAnchorElement = notNullishOrThrow(
      metadata.querySelector('.feed__link',),
    );

    const body: Record<string, string> = z.url().safeParse(anchor.href,).success
      ? { link: anchor.href, }
      : { metadataOuterHtml: metadata.outerHTML, };

    const response = await fetch(`/api/ignore/new`, {
      method: 'POST',
      body: JSON.stringify(body,),
    },);
    if (!response.ok) {
      console.error(`ignore request failed`, response,);
      return;
    }
    try {
      const text = await response.text();
      console.error(`ignored: ${text}`,);
      element.dataset.ignored = '';
    }
    catch (error: unknown) {
      console.error(`failed to read ignore response`, error,);
    }
  },);
},);

//endregion Feed element binding

export {};
