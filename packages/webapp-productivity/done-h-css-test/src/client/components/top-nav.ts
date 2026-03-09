import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { cssCalc, cssCompounded, cssInt, cssRem, cssRotate, cssTurn, cssVar } from "@monochromatic-dev/module-es/h-css";
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
      'flex-grow': 1,
      'text-align': 'center',
      'font-size': cssRem(1.5),
      'font-weight': cssInt(400),
      'line-height': 'normal',
      'margin-block': 0,
      'margin-inline': 0,
    },
  }),
  css({
    rule: '.action',
    decls: {
      ...appearanceNone(),
      ...flexCenter(),
      ...minTouchTarget(),
      color: cssVar('fg'),
      'text-decoration': 'none',
    },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: cssRem(-0.125) }) }),
    ],
  }),
  css({
    rule: '.hamburger',
    decls: {
      'inline-size': cssRem(2),
      'block-size': cssRem(2),
      ...flexColumn(),
      'justify-content': 'center',
      'align-items': 'center',
      gap: cssRem(0.375),
    },
  }),
  css({
    rule: '.line',
    decls: {
      'inline-size': cssRem(1.75),
      'block-size': cssRem(0.25),
      'background-color': cssVar('fg'),
      display: 'block',
    },
  }),
  css({
    rule: '.search-icon',
    decls: { 'inline-size': cssRem(2), 'block-size': cssRem(2), position: 'relative' },
  }),
  css({
    rule: '.circle',
    decls: {
      position: 'absolute',
      'inset-block-start': 0,
      'inset-inline-start': 0,
      'inline-size': cssRem(1.375),
      'block-size': cssRem(1.375),
      'border-width': cssRem(0.25),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      ...borderRadiusFull(),
    },
  }),
  css({
    rule: '.handle',
    decls: {
      position: 'absolute',
      'inset-block-start': cssCalc(`${cssRem(19)} / 16`),
      'inset-inline-start': cssCalc(`${cssRem(19)} / 16`),
      'inline-size': cssRem(0.25),
      'block-size': cssRem(0.875),
      'background-color': cssVar('fg'),
      transform: cssRotate(cssTurn(-0.125)),
      'transform-origin': cssCompounded(['top', 'left']),
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
          'padding-inline-start': cssVar('min-gap'),
          'border-block-end-width': cssCalc(`${cssRem(1)} / 16`),
          'border-block-end-style': 'solid',
          'border-block-end-color': cssVar('bg-weaker'),
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
