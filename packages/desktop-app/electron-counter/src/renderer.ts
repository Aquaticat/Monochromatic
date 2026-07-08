/**
 * Browser renderer for the Electron counter app.
 *
 * This file runs as a standard browser ES module. It never imports Node.js or
 * Electron APIs, so Electron can keep `sandbox`, `contextIsolation`, and
 * `nodeIntegration: false` enabled.
 *
 * @example
 * ```ts
 * renderCounterApp();
 * ```
 */

import {
  formatCount,
  formatDocumentTitle,
  incrementCount,
  INITIAL_COUNT,
} from './counter.js';

/**
 * DOM elements needed by the counter renderer.
 *
 * @example
 * ```ts
 * const elements: CounterElements = {
 *   countOutput: document.createElement('output'),
 *   incrementButton: document.createElement('button'),
 * };
 * ```
 */
type CounterElements = {
  readonly countOutput: HTMLOutputElement;
  readonly incrementButton: HTMLButtonElement;
};

/**
 * Error thrown when expected static markup is missing or has an unexpected tag.
 *
 * @example
 * ```ts
 * new MissingCounterElementError({ id: 'counter-value' });
 * ```
 */
class MissingCounterElementError extends Error {
  /**
   * Builds a descriptive DOM lookup error.
   *
   * @param id - Missing element id.
   *
   * @example
   * ```ts
   * new MissingCounterElementError({ id: 'increment-button' });
   * ```
   */
  public constructor({ id, }: { readonly id: string; },) {
    super(`Missing Electron counter element: ${id}`);
    this.name = MissingCounterElementError.name;
  }
}

/**
 * Returns element by id after checking its runtime constructor.
 *
 * @param id - Static element id expected in `index.html`.
 *
 * @param constructor - DOM constructor the element must satisfy.
 *
 * @returns Element narrowed to expected HTML element subtype.
 *
 * @throws MissingCounterElementError when element is absent or has wrong type.
 *
 * @example
 * ```ts
 * getElementByIdAs({ id: 'increment-button', constructor: HTMLButtonElement });
 * ```
 */
function getElementByIdAs<const ElementType extends HTMLElement>(
  {
    id,
    constructor,
  }: {
    readonly constructor: { new(): ElementType; };
    readonly id: string;
  },
): ElementType {
  /** Element found in static markup before runtime type narrowing. */
  const element = document.getElementById(id,);

  if (!(element instanceof constructor))
    throw new MissingCounterElementError({ id, },);

  return element;
}

/**
 * Reads and narrows all static DOM elements used by the renderer.
 *
 * @returns Counter DOM element collection.
 *
 * @example
 * ```ts
 * const elements = getCounterElements();
 * ```
 */
function getCounterElements(): CounterElements {
  return {
    countOutput: getElementByIdAs({
      id: 'counter-value',
      constructor: HTMLOutputElement,
    },),
    incrementButton: getElementByIdAs({
      id: 'increment-button',
      constructor: HTMLButtonElement,
    },),
  };
}

/**
 * Synchronises visible counter text, accessible button text, and document title.
 *
 * @param elements - DOM elements that display and mutate the count.
 *
 * @param count - Current counter value to render.
 *
 * @example
 * ```ts
 * updateRenderedCount({ elements: getCounterElements(), count: 0 });
 * ```
 */
function updateRenderedCount(
  {
    elements,
    count,
  }: {
    readonly count: number;
    readonly elements: CounterElements;
  },
): void {
  /** Human-readable counter label shared by visible and accessible text. */
  const countText = formatCount({ count, },);
  elements.countOutput.value = countText;
  elements.incrementButton.setAttribute(
    'aria-label',
    `Increment counter from ${count}`,
  );
  document.title = formatDocumentTitle({ count, },);
}

/**
 * Boots the counter renderer once static markup exists.
 *
 * @example
 * ```ts
 * renderCounterApp();
 * ```
 */
function renderCounterApp(): void {
  /** DOM elements controlled by the renderer. */
  const elements = getCounterElements();

  /** Mutable renderer-local count state. */
  let count = INITIAL_COUNT;

  updateRenderedCount({ elements, count, },);

  elements.incrementButton.addEventListener('click', function incrementFromClick(): void {
    count = incrementCount({ current: count, },);
    updateRenderedCount({ elements, count, },);
  },);
}

renderCounterApp();
