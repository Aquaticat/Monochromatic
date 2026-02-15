/**
 * Type-safe hyperscript factory for creating DOM elements.
 *
 * Replaces verbose imperative sequences like:
 * ```ts
 * const div = document.createElement('div');
 * div.className = 'card';
 * div.textContent = 'hello';
 * parent.append(div);
 * ```
 * with a declarative call:
 * ```ts
 * const div = $({ tag: 'div', class: 'card', text: 'hello' });
 * parent.append(div);
 * ```
 *
 * @param options - Named parameters describing the element
 * @param options.tag - HTML tag name (type-safe via `HTMLElementTagNameMap`) or custom element tag
 * @param options.class - CSS class name(s), maps to `element.className`
 * @param options.text - Text content, maps to `element.textContent`
 * @param options.html - Inner HTML string, maps to `element.innerHTML`
 * @param options.attrs - Record of attributes set via `setAttribute`
 * @param options.style - Record of inline style properties
 * @param options.on - Record of event listeners keyed by event name
 * @param options.children - Child nodes to append
 * @returns Correctly-typed HTML element
 *
 * @example Standard HTML element
 * ```ts
 * const button = $({
 *   tag: 'button',
 *   class: 'primary',
 *   text: 'Click me',
 *   on: { click: () => console.log('clicked') },
 * });
 * // button is HTMLButtonElement
 * ```
 *
 * @example Custom element with attributes
 * ```ts
 * const nav = $({
 *   tag: 'top-nav',
 *   attrs: { heading: 'Inbox' },
 * });
 * // nav is HTMLElement (custom elements aren't in HTMLElementTagNameMap)
 * ```
 *
 * @example Nested children
 * ```ts
 * const list = $({
 *   tag: 'ul',
 *   class: 'task-list',
 *   children: tasks.map(task =>
 *     $({ tag: 'li', text: task.title })
 *   ),
 * });
 * ```
 */

/** Resolves a tag name to its element type, falling back to `HTMLElement` for custom elements */
type ElementFromTag<TTag extends string> =
  TTag extends keyof HTMLElementTagNameMap
    ? HTMLElementTagNameMap[TTag]
    : HTMLElement;

/** Named parameters for element creation */
type HOptions<TTag extends string> = {
  /** HTML tag name or custom element tag */
  tag: TTag;
  /** CSS class name(s) */
  class?: string;
  /** Text content */
  text?: string;
  /** Raw inner HTML */
  html?: string;
  /** Attributes set via `setAttribute` */
  attrs?: Record<string, string>;
  /** Inline style properties (camelCase keys, e.g. `{ flexDirection: 'column' }`) */
  style?: Record<string, string>;
  /** Event listeners keyed by event name (known DOM events are type-checked, unknown ones accepted as fallback) */
  on?: {
    [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void | Promise<void>;
  } & {
    [K in string]?: (event: any) => void | Promise<void>;
  };
  /** Child nodes to append */
  children?: ReadonlyArray<Node | string>;
};

/* @__NO_SIDE_EFFECTS__ */ export function $<const TTag extends string>(
  { tag, class: className, text, html, attrs, style, on, children, }: HOptions<TTag>,
): ElementFromTag<TTag> {
  const element = document.createElement(tag,) as ElementFromTag<TTag>;

  if (className !== undefined) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  if (html !== undefined) {
    element.innerHTML = html;
  }

  if (attrs !== undefined) {
    for (const [key, value,] of Object.entries(attrs,)) {
      element.setAttribute(key, value,);
    }
  }

  if (style !== undefined) {
    for (const [property, value,] of Object.entries(style,)) {
      // Accepts both camelCase (flexDirection) and kebab-case (flex-direction)
      (element.style as unknown as Record<string, string>)[property] = value;
    }
  }

  if (on !== undefined) {
    for (const [eventName, handler,] of Object.entries(on,)) {
      element.addEventListener(eventName, handler as EventListener,);
    }
  }

  if (children !== undefined) {
    element.append(...children,);
  }

  return element;
}
