/**
 * `<side-drawer>` -- intrinsic sidebar navigation.
 *
 * Renders two copies of the nav: an inline sidebar visible when the
 * component is narrow (~22 rem, meaning it sits beside the main content
 * in the Every Layout sidebar pattern), and a popover panel opened by
 * the hamburger menu when the component is full-width (stacked).
 *
 * Visibility is governed entirely by a CSS container query on the
 * wrapper element -- no viewport media queries, no JS resize observers.
 *
 * Exceeds 100 lines: the component contains two parallel DOM trees
 * (inline nav + popover panel), each with header/close/nav, plus
 * the styles for both modes including the container query -- splitting
 * would scatter the two halves of a single layout concern.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

/** Viewport breakpoint matching the body flex-wrap threshold.
 *  Below this width the sidebar stacks and the inline nav hides. */
const DESKTOP_BREAKPOINT = "48rem";

const STYLES = css(`
  :host {
    display: block;
  }

  /*region Container -- enables intrinsic mode switching */

  .wrapper {
    block-size: 100%;
  }

  /*endregion Container */

  /*region Shared nav styles */

  .divider {
    block-size: calc(1 / 16 * 1rem);
    background-color: var(--bg-weaker);
    inline-size: 100%;
  }

  nav {
    @apply --flex-column;
    gap: var(--min-gap);
    flex: 1;
    padding-block-start: var(--min-gap);
  }

  a {
    @apply --flex-row;
    gap: var(--min-gap);
    min-block-size: 3rem;
    padding-block: 0;
    padding-inline: var(--min-gap);
    color: var(--fg);
    text-decoration: none;
    font-size: 1.25rem;
    font-weight: 400;

    &:hover {
      background-color: var(--hover-bg);
    }

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: -0.125rem;
    }
  }

  .header {
    @apply --flex-row;
    justify-content: space-between;
    padding-block-start: var(--min-gap);
    padding-block-end: var(--min-padding);
    padding-inline-start: var(--min-gap);
    padding-inline-end: var(--min-padding);
    min-block-size: 4rem;
  }

  .close {
    @apply --appearance-none;
    @apply --flex-center;
    @apply --min-touch-target;

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: -0.125rem;
    }

    & svg {
      inline-size: 2rem;
      block-size: 2rem;
    }
  }

  /*endregion Shared nav styles */

  /*region Inline sidebar -- visible when the component is narrow (sidebar mode) */

  .sidebar {
    @apply --flex-column;
    block-size: 100%;
    border-inline-end-width: calc(1 / 16 * 1rem);
    border-inline-end-style: solid;
    border-inline-end-color: var(--bg-weaker);

    & .header {
      padding-block: var(--min-padding);
      padding-inline-start: var(--min-gap);
      padding-inline-end: var(--min-padding);
    }

    & .close { display: none; }
  }

  /* Narrow viewport: inline sidebar hidden, popover takes over */
  .sidebar { display: none; }

  @media (min-width: ${DESKTOP_BREAKPOINT}) {
    .sidebar { @apply --flex-column; }
  }

  /*endregion Inline sidebar */

  /*region Popover panel -- hamburger-triggered overlay for narrow/stacked screens */

  .panel {
    /* Override popover UA defaults */
    position: fixed;
    inset: 0;
    margin: 0;
    padding-block: 0;
    padding-inline: 0;
    border-style: none;
    inline-size: 100%;
    max-inline-size: 100%;
    block-size: 100%;
    max-block-size: 100%;

    z-index: 100;
    display: flex;
    background-color: transparent;
    overflow: visible;
  }

  .panel:not(:popover-open) { display: none; }

  @keyframes drawer-slide-in {
    from {
      transform: translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes scrim-fade-in {
    from { background-color: transparent; }
    to { background-color: var(--overlay-bg); }
  }

  .panel:popover-open {
    animation-name: scrim-fade-in;
    animation-duration: 200ms;
    animation-timing-function: ease-out;
    animation-fill-mode: both;
  }

  .panel:popover-open > .panel-drawer {
    animation-name: drawer-slide-in;
    animation-duration: 250ms;
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
    animation-fill-mode: both;
  }

  .panel-drawer {
    background-color: var(--bg);
    inline-size: 20rem;
    max-inline-size: 85vw;
    block-size: 100%;
    @apply --flex-column;
  }

  /*endregion Popover panel */

  @apply --shadow-dom-globals;
`);

/** Builds a nav element with the standard link set. */
function buildNav(): HTMLElement {
  return h({
    tag: "nav",
    children: [
      h({ tag: "a", attrs: { href: "/" }, text: "Inbox" }),
      h({ tag: "a", attrs: { href: "/in-progress" }, text: "In Progress" }),
      h({ tag: "a", attrs: { href: "/settings" }, text: "Settings" }),
      h({ tag: "a", attrs: { href: "#" }, text: "Contact" }),
    ],
  });
}

/** Builds a header row with a name label and an optional close button. */
function buildHeader(closeButton: HTMLElement | null): HTMLElement {
  const children: HTMLElement[] = [
    h({ tag: "span", style: { fontSize: "1.25rem" }, text: "Firstname" }),
  ];
  if (closeButton !== null) {
    children.push(closeButton);
  }
  return h({ tag: "div", class: "header", children });
}

/** Builds a close button with an X SVG icon. */
function buildCloseButton(label: string): HTMLElement {
  const button = h({
    tag: "button",
    class: "close",
    attrs: { "aria-label": label },
  });
  // innerHTML for SVG: h() creates HTML-namespace elements, SVG needs SVG namespace
  button.innerHTML = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4"><line x1="14" y1="14" x2="34" y2="34"/><line x1="34" y1="14" x2="14" y2="34"/></svg>`;
  return button;
}

/**
 * `<side-drawer>` -- navigation sidebar with intrinsic layout switching.
 *
 * When the component is narrow (inside the Every Layout sidebar flex container),
 * the inline sidebar is visible. When stacked (full viewport width), the inline
 * sidebar hides and the hamburger popover is used instead.
 *
 * Toggle the popover via the `open` attribute (set by the top-nav hamburger).
 */
class SideDrawer extends HTMLElement {
  static observedAttributes = ["open"];

  #shadow: ShadowRoot;
  #panel: HTMLDivElement | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get open(): boolean {
    return this.hasAttribute("open");
  }

  set open(value: boolean) {
    if (value) {
      this.setAttribute("open", "");
    } else {
      this.removeAttribute("open");
    }
  }

  connectedCallback(): void {
    this.#render();
    this.#panel = this.#shadow.querySelector(".panel") as HTMLDivElement;

    this.#shadow.querySelector(".panel-close")?.addEventListener("click", () => {
      this.open = false;
    });

    // Light-dismiss: close when clicking the backdrop area (outside the drawer)
    this.#panel.addEventListener("click", (event) => {
      if (event.target === this.#panel) {
        this.open = false;
      }
    });
  }

  attributeChangedCallback(): void {
    if (this.#panel === null) return;

    if (this.open) {
      this.#panel.showPopover();
    } else {
      this.#panel.hidePopover();
    }
  }

  #render(): void {
    const panelClose = buildCloseButton("Close menu");
    panelClose.classList.add("panel-close");

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "div",
        class: "wrapper",
        children: [
          //region Inline sidebar -- visible in sidebar mode
          h({
            tag: "aside",
            class: "sidebar",
            children: [
              buildHeader(null),
              h({ tag: "div", class: "divider" }),
              buildNav(),
            ],
          }),
          //endregion Inline sidebar

          //region Popover panel -- visible via hamburger in stacked mode
          h({
            tag: "div",
            class: "panel",
            attrs: { popover: "manual" },
            children: [
              h({
                tag: "aside",
                class: "panel-drawer",
                children: [
                  buildHeader(panelClose),
                  h({ tag: "div", class: "divider" }),
                  buildNav(),
                ],
              }),
            ],
          }),
          //endregion Popover panel
        ],
      }),
    );
  }
}

customElements.define("side-drawer", SideDrawer);
