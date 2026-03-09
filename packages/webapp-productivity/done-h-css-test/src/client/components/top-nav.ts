import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { appearanceNone, borderRadiusFull, flexCenter, flexColumn, focusOutline, minTouchTarget, stickyBar } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: { ...stickyBar(), 'justify-content': 'center' },
  }),
  css({
    rule: 'h1',
    decls: {
      flex: '1',
      'text-align': 'center',
      'font-size': '1.5rem',
      'font-weight': '400',
      'line-height': 'normal',
      'margin-block': '0',
      'margin-inline': '0',
    },
  }),
  css({
    rule: '.action',
    decls: {
      ...appearanceNone(),
      ...flexCenter(),
      ...minTouchTarget(),
      color: 'var(--fg)',
      'text-decoration': 'none',
    },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: '-0.125rem' }) }),
    ],
  }),
  css({
    rule: '.hamburger',
    decls: {
      'inline-size': '2rem',
      'block-size': '2rem',
      ...flexColumn(),
      'justify-content': 'center',
      'align-items': 'center',
      gap: '0.375rem',
    },
  }),
  css({
    rule: '.line',
    decls: {
      'inline-size': '1.75rem',
      'block-size': '0.25rem',
      'background-color': 'var(--fg)',
      display: 'block',
    },
  }),
  css({
    rule: '.search-icon',
    decls: { 'inline-size': '2rem', 'block-size': '2rem', position: 'relative' },
  }),
  css({
    rule: '.circle',
    decls: {
      position: 'absolute',
      'inset-block-start': '0',
      'inset-inline-start': '0',
      'inline-size': '1.375rem',
      'block-size': '1.375rem',
      'border-width': '0.25rem',
      'border-style': 'solid',
      'border-color': 'var(--fg)',
      ...borderRadiusFull(),
    },
  }),
  css({
    rule: '.handle',
    decls: {
      position: 'absolute',
      'inset-block-start': 'calc(19 / 16 * 1rem)',
      'inset-inline-start': 'calc(19 / 16 * 1rem)',
      'inline-size': '0.25rem',
      'block-size': '0.875rem',
      'background-color': 'var(--fg)',
      transform: 'rotate(-45deg)',
      'transform-origin': 'top left',
    },
  }),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({
        rule: ':host',
        decls: {
          'justify-content': 'space-between',
          'padding-inline-start': 'var(--min-gap)',
          'border-block-end-width': 'calc(1 / 16 * 1rem)',
          'border-block-end-style': 'solid',
          'border-block-end-color': 'var(--bg-weaker)',
        },
      }),
      css({ rule: '.menu-toggle', decls: { display: 'none' } }),
      css({ rule: 'h1', decls: { 'text-align': 'start' } }),
    ],
  }),
].join('');

/**
 * `<top-nav>` -- sticky navigation bar with hamburger menu, page heading, and search link.
 * Dispatches a `menu-open` composed event when the hamburger is clicked.
 */
class TopNav extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const heading = this.getAttribute("heading") ?? "";

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "button",
        class: "action menu-toggle",
        attrs: { "aria-label": "Open menu" },
        children: [
          h({
            tag: "span",
            class: "hamburger",
            children: [
              h({ tag: "span", class: "line" }),
              h({ tag: "span", class: "line" }),
              h({ tag: "span", class: "line" }),
            ],
          }),
        ],
        on: {
          click: () => {
            this.dispatchEvent(new CustomEvent("menu-open", { bubbles: true, composed: true }));
          },
        },
      }),
      h({ tag: "h1", text: heading }),
      h({
        tag: "a",
        class: "action",
        attrs: { href: "/search", "aria-label": "Search" },
        children: [
          h({
            tag: "span",
            class: "search-icon",
            children: [
              h({ tag: "span", class: "circle" }),
              h({ tag: "span", class: "handle" }),
            ],
          }),
        ],
      }),
    );
  }
}

customElements.define("top-nav", TopNav);
