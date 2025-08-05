import {
  notNullishOrThrow,
  wait,
} from '@monochromatic-dev/module-es';
import { z, } from 'zod/v4-mini';

console.log('client',);

function addScrollEvents(element: HTMLElement, options = {},): IntersectionObserver {
  const config = {
    threshold: [0, 0.25, 0.5, 0.75, 1,],
    rootMargin: '0px',
    ...options,
  };

  let wasFullyVisible = false;
  let lastRatio = 0;

  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (!entry) {
      console.log(
        `${JSON.stringify(entries,)} empty for observer ${JSON.stringify(observer,)}`,
      );
      return;
    }
    const ratio = entry.intersectionRatio;

    // Scrolled in (became fully visible)
    if (ratio === 1 && !wasFullyVisible) {
      wasFullyVisible = true;
      element.dispatchEvent(new CustomEvent('scrolledIn',),);
    }

    // Scrolled out (completely hidden after being fully visible)
    if (wasFullyVisible && ratio === 0) {
      element.dispatchEvent(new CustomEvent('scrolledOut',),);
      wasFullyVisible = false;
    }

    // Entering viewport
    if (lastRatio === 0 && ratio > 0)
      element.dispatchEvent(new CustomEvent('enterViewport',),);

    // Leaving viewport
    if (lastRatio > 0 && ratio === 0)
      element.dispatchEvent(new CustomEvent('leaveViewport',),);

    // Visibility threshold events
    if (ratio >= 0.5 && lastRatio < 0.5)
      element.dispatchEvent(new CustomEvent('halfVisible',),);

    lastRatio = ratio;
  }, config,);

  observer.observe(element,);
  return observer;
}

// Usage
const elements: NodeListOf<HTMLElement> = document.querySelectorAll('.feed',);
elements.forEach(function scroll(element,) {
  addScrollEvents(element,);
  element.addEventListener('scrolledOut', async function onScrolledOut() {
    console.log('scrolledOut',);
    const metadata = notNullishOrThrow(element.querySelector('.feed__metadata',),);
    const a: HTMLAnchorElement = notNullishOrThrow(
      metadata.querySelector('.feed__link',),
    );

    const body: Record<string, string> = (z.url().parse(a.href,))
      ? { link: a.href, }
      : { metadataOuterHtml: metadata.outerHTML, };

    const response = await fetch(`/api/ignore/new`, {
      method: 'POST',
      body: JSON.stringify(body),
    },);
    if (!response.ok) {
      console.log(`${JSON.stringify(response,)} not ok on scrolledOut`,);
      return;
    }
    try {
      const text = await response.text();
      console.log(`${text} on scrolledOut`,);
      element.classList.add('ignore');
    }
    catch (error: unknown) {
      console.log(`${JSON.stringify(error,)} on scrolledOut`,);
    }
  },);
},);

while (true) {
  await wait(5000,);
  try {
    const serverHash = await (await fetch('/api/asset/hash',)).text();
    if (serverHash !== document.documentElement.dataset.assetHash) {
      console.log(
        `serverHash ${serverHash} !== ${document.documentElement.dataset.assetHash}, reloading`,
      );
      await wait(5000,);
      window.location.reload();
    }
    else {
      console.log(`serverHash ${serverHash} same`,);
    }
  }
  catch (error: unknown) {
    console.log(JSON.stringify(error,),);
  }
}
