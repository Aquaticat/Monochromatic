/**
 * Replaces an element's parent's content with clones of that element.
 * Any other sibling elements will be removed.
 *
 * @param templateElement - Reference to element
 *
 * @param targetCount - Desired number of cloned elements to become the new children of the parent. A count of 0 will remove all children.
 *
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
 * const elementToReplicate = document.querySelector<HTMLElement>('.element-to-replicate',)!;
 * replicateElementAsParentContent({ templateElement: elementToReplicate, targetCount: 3, },);
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
export function replicateElementAsParentContent(
  {
    templateElement,
    targetCount,
  }: {
    templateElement: HTMLElement;
    targetCount: number;
  },
): void {
  // Get the parent of the template element.
  const parent = templateElement.parentElement;

  // If the element has no parent, we can't replace children.
  if (!parent) {
    throw new Error(
      `Cannot replicate: The element '${templateElement.outerHTML}' has no parent.`,
    );
  }

  const clones = Array.from(
    { length: targetCount, },
    function wrapper() {
      return deepCloneNode(templateElement,);
    },
  );

  // Replace all children of the parent element with the newly created clones.
  parent.replaceChildren(...clones,);
}

/**
 * Deep clones a DOM node, preserving all descendants and attributes.
 *
 * @param element - Node to clone
 *
 * @returns Deep clone of the node with the same type
 *
 * @example
 * ```ts
 * const link = document.querySelector<HTMLAnchorElement>('a.primary',)!;
 * const linkClone = deepCloneNode(link,);
 * // linkClone retains its HTMLAnchorElement type without a manual cast.
 * linkClone.href = '/secondary';
 * document.body.append(linkClone,);
 * ```
 */
export function deepCloneNode<const T extends Node,>(element: T,): T {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- DOM Node.cloneNode returns Node; the whole purpose of this wrapper is to restore the concrete type T at the call site
  return element.cloneNode(true,) as T;
}

/**
 * Replaces a target parent element's content with clones of a template element.
 *
 * @param templateElement - Element to clone
 *
 * @param parentElement - Parent element whose children will be replaced
 *
 * @param targetCount - Number of clones to insert
 *
 * @example
 * ```html
 * <!-- Initial DOM -->
 * <template id="row-template"><li class="row">…</li></template>
 * <ul id="list"></ul>
 * ```
 * ```ts
 * const template = (document.querySelector<HTMLTemplateElement>('#row-template',)!).content
 *   .firstElementChild as HTMLElement;
 * const list = document.querySelector<HTMLElement>('#list',)!;
 * replicateElementAsContentOf({ templateElement: template, parentElement: list, targetCount: 3, },);
 * // #list now holds three independent clones; the <template> is untouched.
 * ```
 */
export function replicateElementAsContentOf(
  {
    templateElement,
    parentElement,
    targetCount,
  }: {
    templateElement: HTMLElement;
    parentElement: HTMLElement;
    targetCount: number;
  },
): void {
  const clones = Array.from(
    { length: targetCount, },
    function wrapper() {
      return deepCloneNode(templateElement,);
    },
  );

  parentElement.replaceChildren(...clones,);
}
