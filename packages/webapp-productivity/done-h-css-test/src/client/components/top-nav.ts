/**
 * `<top-nav>` -- sticky navigation bar with hamburger menu, page heading, and search link.
 * Dispatches a `menu-open` composed event when the hamburger is clicked.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { TOP_NAV_STYLES } from "./top-nav-styles.ts";

/**
 * `<top-nav>` web component.
 *
 * Renders a sticky top bar with a hamburger toggle (for mobile), a heading,
 * and a search link.
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
      h({ tag: "style", text: TOP_NAV_STYLES }),
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
