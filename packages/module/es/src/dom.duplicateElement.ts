import { thunk } from './function.thunk.ts';

/**
 * Replaces an element's parent's content with clones of that element.
 * Any other sibling elements will be removed.
 *
 * @param templateElement - Reference to element
 * @param targetCount - Desired number of cloned elements to become the new children of the parent. A count of 0 will remove all children.
 * @example
 * ```html
 * <!-- Initial DOM -->
 * <div id="container">
 *   <span>Some other element</span>
 *   <p class="element-to-replicate">Original</p>
 *   <span>Another element</span>
 * </div>
 * ```
 * ```ts
 * import { notNullishOrThrow } from '@monochromatic-dev/module-es';
 * const elementToReplicate: HTMLElement = notNullishOrThrow(document.querySelector('.element-to-replicate'));
 * // Call the function to replace children with 3 clones
 * replicateElementAsParentContent(elementToReplicate, 3);
 * ```
 * ```html
 * <!-- Resulting DOM -->
 * <div id="container">
 *   <p class="element-to-replicate">Original</p>
 *   <p class="element-to-replicate">Original</p>
 *   <p class="element-to-replicate">Original</p>
 * </div>
 * ```
 */
export function replicateElementAsParentContent(templateElement: HTMLElement,
  targetCount: number): void
{
  // Get the parent of the template element.
  const parent = templateElement.parentElement;

  // If the element has no parent, we can't replace children.
  if (!parent) {
    throw new Error(
      `Cannot replicate: The element '${templateElement.outerHTML}' has no parent.`,
    );
  }

  const clones = Array.from(
    { length: targetCount },
    function wrapper() {
      return deepCloneNode(templateElement);
    },
  );

  // Replace all children of the parent element with the newly created clones.
  parent.replaceChildren(...clones);
}

export function deepCloneNode<const T extends Node,>(element: T): T {
  return element.cloneNode(true) as T;
}

export function replicateElementAsContentOf(templateElement: HTMLElement,
  parentElement: HTMLElement, targetCount: number): void
{
  const clones = Array.from(
    { length: targetCount },
    function wrapper() {
      return deepCloneNode(templateElement);
    },
  );

  parentElement.replaceChildren(...clones);
}
