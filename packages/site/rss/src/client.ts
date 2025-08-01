function addScrollEvents(element, options = {},) {
  const config = {
    threshold: [0, 0.25, 0.5, 0.75, 1,],
    rootMargin: '0px',
    ...options,
  };

  let wasFullyVisible = false;
  let lastRatio = 0;

  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
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
  element._scrollObserver = observer;
  return observer;
}

// Usage
const element = document.querySelector('.feed',);
addScrollEvents(element,);

element.addEventListener('scrolledOut', () => console.log('scrolledOut',),);
element.addEventListener('scrolledIn', () => console.log('scrolledIn',),);
element.addEventListener('enterViewport', () => console.log('enterViewport',),);
element.addEventListener('leaveViewport', () => console.log('leaveViewport',),);
element.addEventListener('halfVisible', () => console.log('halfVisible',),);
