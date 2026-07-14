/**
 * Tiny DOM construction helpers for paper2vn screens.
 *
 * h-html in `module-hyperscript` returns strings, which is wrong for
 * client-side mounting (we need real elements with event listeners).
 * These helpers create real `Element` nodes with the same shape.
 */

/**
 * Tag-narrowed element type lookup.
 */
type TagNameMap = HTMLElementTagNameMap;

/**
 * Attribute and event-listener bag passed to {@link el}.
 */
export type ElAttrs = Record<string, string | EventListener | undefined>;

/**
 * Allowed child nodes for {@link el}.
 */
export type ElChildren = readonly (Node | string)[];

/**
 * Hyperscript factory. Same shape as React.createElement and
 * `module-hyperscript/h-html`. Creates a real DOM Element with the given
 * tag, attributes, and children.
 *
 * @param tag - HTML tag name
 *
 * @param attrs - attribute and event listener bag; keys starting with `on`
 *   (e.g. `onclick`) are treated as event listeners, the rest as string
 *   attributes
 *
 * @param children - child nodes or strings to append
 *
 * @returns the created element
 *
 * @example
 * ```ts
 * const btn = el({
 *   tag: 'button',
 *   attrs: { 'data-variant': 'primary', onclick: function go(): void { console.error('hi'); } },
 *   children: ['Click me'],
 * });
 * ```
 */
export function el<K extends keyof TagNameMap,>(
  {
    tag,
    attrs = {},
    children = [],
  }: {
    tag: K;
    attrs?: ElAttrs;
    children?: ElChildren;
  },
): TagNameMap[K] {
  /**
   * Newly created element receiving the wired attributes and children.
   */
  const node = document.createElement(tag,);
  for (
    const [
      key,
      value,
    ] of Object.entries(attrs,)
  ) {
    if (value === undefined)
      continue;
    if (key.startsWith('on',)
      && ((typeof value) === 'function')) {
      node.addEventListener(
        key
          .slice(2,)
          .toLowerCase(),
        value,
      );
      continue;
    }
    if ((typeof value) === 'string') {
      node.setAttribute(
        key,
        value,
      );
    }
  }
  for (const child of children)
    node.append(child,);
  return node;
}

/**
 * Removes every child from a node.
 *
 * @param parent - element whose children should be cleared
 *
 * @example
 * ```ts
 * clear(dialogueEl);
 * dialogueEl.append(nextBeatTextNode);
 * ```
 */
export function clear(parent: Node,): void {
  if (parent instanceof Element) {
    parent.replaceChildren();
    return;
  }
  while (parent.firstChild
    !== null)
    parent.firstChild
      .remove();
}
