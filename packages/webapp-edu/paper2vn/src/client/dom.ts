/**
 * Tiny DOM construction helpers for paper2vn screens.
 *
 * h-html in `module-hyperscript` returns strings, which is wrong for
 * client-side mounting (we need real elements with event listeners).
 * These helpers create real `Element` nodes with the same shape.
 */

/** Tag-narrowed element type lookup. */
type TagNameMap = HTMLElementTagNameMap;

/**
 * Creates an HTMLElement with the given tag, attributes, and children.
 *
 * @param tag - HTML tag name
 *
 * @param attrs - attribute and event listener bag; keys starting with
 *   `on` (e.g. `onclick`) are treated as event listeners, the rest as
 *   string attributes
 *
 * @param children - child nodes or strings to append
 *
 * @returns the created element
 *
 * @example
 * ```ts
 * const btn = el(
 *   'button',
 *   { 'data-variant': 'primary', onclick: () => alert('hi') },
 *   ['Click me'],
 * );
 * ```
 */
export function el<K extends keyof TagNameMap,>(
  tag: K,
  attrs: Record<string, string | EventListener | undefined> = {},
  children: readonly (Node | string)[] = [],
): TagNameMap[K] {
  const node = document.createElement(tag,);
  for (const [
    key,
    value,
  ] of Object.entries(attrs,)) {
    if (value === undefined)
      continue;
    if (key.startsWith('on',) && typeof value === 'function') {
      node.addEventListener(
        key
          .slice(2,)
          .toLowerCase(),
        value,
      );
      continue;
    }
    if (typeof value === 'string') {
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
 */
export function clear(parent: Node,): void {
  if (parent instanceof Element) {
    parent.replaceChildren();
    return;
  }
  while (parent.firstChild !== null)
    parent.removeChild(parent.firstChild,);
}
