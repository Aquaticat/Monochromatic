/**
 * Minimal JSX-to-HTML runtime for static MDX rendering.
 *
 * **Why not Preact / React?**
 * `@mdx-js/mdx` `evaluate` needs a JSX runtime (`jsx`, `jsxs`, `Fragment`)
 * and then the result must be serialized to an HTML string.
 * Preact + `preact-render-to-string` can do this, but for static MDX-to-HTML
 * (no hydration, no hooks, no state, no client interactivity) they are
 * unnecessary: the only operation is recursive string concatenation with
 * HTML escaping. A full virtual DOM intermediate representation adds
 * allocation overhead and two extra dependencies for features that can
 * never execute in this context.
 *
 * **How it works.**
 * Each `jsx` call directly returns a `SafeHtml` wrapper (`{ html: string }`)
 * instead of a virtual DOM node. The wrapper solves the escaping problem:
 * raw text children (plain strings from MDX content) are HTML-escaped,
 * while results from nested `jsx` calls (which are `SafeHtml` objects)
 * pass through unescaped. Function components (including MDX content
 * components) are called with their props and return `SafeHtml` directly --
 * no separate render pass needed.
 *
 * Reuses `escapeHtml` and `VOID_ELEMENTS` from `@monochromatic-dev/module-hyperscript`
 * to avoid duplicating HTML generation internals.
 */
import {
  escapeHtml,
  VOID_ELEMENTS,
} from '@monochromatic-dev/module-hyperscript/ts';

//region Types

/** Wrapper distinguishing rendered HTML from raw text in the JSX tree. */
export type SafeHtml = { readonly html: string };

//endregion Types

//region Internals

/**
 * Maps JSX prop names to their HTML attribute equivalents.
 *
 * Only includes names that differ between JSX and HTML.
 */
const PROP_TO_ATTR: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
};

/**
 * Checks whether a value is already-rendered HTML from a `jsx` call.
 *
 * @param value - child value to test
 *
 * @returns `true` if value is a `SafeHtml` wrapper
 */
function isSafeHtml(value: unknown,): value is SafeHtml {
  return value !== null
    && typeof value === 'object'
    && 'html' in value;
}

/**
 * Recursively renders a child value to an HTML string.
 *
 * - `SafeHtml` objects pass through (already rendered by a `jsx` call)
 * - Strings are HTML-escaped (raw text content from MDX)
 * - Numbers are stringified without escaping
 * - Arrays are recursively joined
 * - `null`, `undefined`, and booleans produce empty strings
 *   (matching React/Preact conditional rendering behaviour)
 *
 * @param child - value from `props.children`
 *
 * @returns HTML string
 */
function renderChild(child: unknown,): string {
  if (child === null || child === undefined || typeof child === 'boolean') return '';
  if (isSafeHtml(child,)) return child.html;
  if (typeof child === 'string') return escapeHtml(child,);
  if (typeof child === 'number') return String(child,);
  if (Array.isArray(child,)) return child.map(renderChild,).join('',);
  return '';
}

/**
 * Renders JSX props to an HTML attribute string.
 *
 * Skips `children` and `dangerouslySetInnerHTML` (handled separately).
 * Maps JSX names (e.g. `className`) to HTML names (e.g. `class`).
 * Boolean `true` produces a valueless attribute; `false`/`null`/`undefined` omits it.
 *
 * @param props - JSX props object
 *
 * @returns space-prefixed attribute string (empty string if no attributes)
 */
function renderAttrs(props: Record<string, unknown>,): string {
  let result = '';
  for (const [key, value,] of Object.entries(props,)) {
    if (key === 'children' || key === 'dangerouslySetInnerHTML') continue;
    if (value === null || value === undefined || value === false) continue;
    const name = PROP_TO_ATTR[key] ?? key;
    if (value === true) {
      result += ` ${name}`;
    } else {
      result += ` ${name}="${escapeHtml(String(value,),)}"`;
    }
  }
  return result;
}

//endregion Internals

//region Public API -- JSX runtime exports

/**
 * Fragment component -- renders children without a wrapper element.
 *
 * Used by the JSX compiler for `<>...</>` syntax.
 *
 * @param props - props containing children
 *
 * @returns rendered children as `SafeHtml`
 */
export function Fragment(props: { children?: unknown },): SafeHtml {
  return { html: renderChild(props.children,), };
}

/**
 * JSX factory that produces HTML strings instead of virtual DOM nodes.
 *
 * Serves as both `jsx` and `jsxs` for the automatic JSX runtime.
 * When `type` is a function (component), it is called with `props`
 * and its return value (a `SafeHtml` object) is used directly.
 * When `type` is a string (HTML element), attributes and children
 * are rendered to an HTML string.
 *
 * @param type - element tag name or component function
 * @param props - JSX props including `children`
 * @param _key - reconciliation key (ignored for static rendering)
 *
 * @returns rendered HTML wrapped in `SafeHtml`
 *
 * @example
 * ```ts
 * jsx('p', { className: 'intro', children: 'Hello' });
 * // { html: '<p class="intro">Hello</p>' }
 * ```
 */
export function jsx(
  type: string | ((props: Record<string, unknown>) => SafeHtml),
  props: Record<string, unknown>,
  _key?: string,
): SafeHtml {
  if (typeof type === 'function') {
    return type(props,);
  }

  const attrs = renderAttrs(props,);

  if (VOID_ELEMENTS.has(type,)) {
    return { html: `<${type}${attrs}>`, };
  }

  const inner = props.dangerouslySetInnerHTML !== null
      && props.dangerouslySetInnerHTML !== undefined
    ? (props.dangerouslySetInnerHTML as { __html: string }).__html
    : renderChild(props.children,);

  return { html: `<${type}${attrs}>${inner}</${type}>`, };
}

/**
 * JSX factory for elements with statically known children.
 *
 * Identical to {@link jsx} for static rendering -- the `s` variant exists
 * in React/Preact for reconciliation optimizations that do not apply here.
 */
export const jsxs = jsx;

//endregion Public API -- JSX runtime exports
