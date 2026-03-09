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
import { cssCalc, cssInt, cssNum, cssPercent, cssRaw, cssRem, cssS, cssTranslateX, cssVar, cssVi } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { appearanceNone, flexCenter, flexColumn, flexRow, focusOutline, minTouchTarget, shadowDomGlobals } from "../mixins.ts";

/** Viewport breakpoint matching the body flex-wrap threshold.
 *  Below this width the sidebar stacks and the inline nav hides. */
const DESKTOP_BREAKPOINT = "48rem";

const STYLES = [
  css({ rule: ':host', decls: { display: 'block' } }),
  css({ rule: '.wrapper', decls: { 'block-size': cssPercent(100) } }),

  //region Shared nav styles
  css({
    rule: '.divider',
    decls: {
      'block-size': cssCalc(`${cssRem(1)} / 16`),
      'background-color': cssVar('bg-weaker'),
      'inline-size': cssPercent(100),
    },
  }),
  css({
    rule: 'nav',
    decls: { ...flexColumn(), gap: cssVar('min-gap'), 'flex-grow': 1, 'padding-block-start': cssVar('min-gap') },
  }),
  css({
    rule: 'a',
    decls: {
      ...flexRow(),
      gap: cssVar('min-gap'),
      'min-block-size': cssRem(3),
      'padding-block': 0,
      'padding-inline': cssVar('min-gap'),
      color: cssVar('fg'),
      'text-decoration': 'none',
      'font-size': cssRem(1.25),
      'font-weight': cssInt(400),
    },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': cssVar('hover-bg') } }),
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: cssRem(-0.125) }) }),
    ],
  }),
  css({
    rule: '.header',
    decls: {
      ...flexRow(),
      'justify-content': 'space-between',
      'padding-block-start': cssVar('min-gap'),
      'padding-block-end': cssVar('min-padding'),
      'padding-inline-start': cssVar('min-gap'),
      'padding-inline-end': cssVar('min-padding'),
      'min-block-size': cssRem(4),
    },
  }),
  css({
    rule: '.close',
    decls: { ...appearanceNone(), ...flexCenter(), ...minTouchTarget() },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: cssRem(-0.125) }) }),
      css({ rule: '& svg', decls: { 'inline-size': cssRem(2), 'block-size': cssRem(2) } }),
    ],
  }),
  //endregion Shared nav styles

  //region Inline sidebar
  css({
    rule: '.sidebar',
    decls: {
      ...flexColumn(),
      'block-size': cssPercent(100),
      'border-inline-end-width': cssCalc(`${cssRem(1)} / 16`),
      'border-inline-end-style': 'solid',
      'border-inline-end-color': cssVar('bg-weaker'),
      display: 'none',
    },
    children: [
      css({
        rule: '& .header',
        decls: {
          'padding-block': cssVar('min-padding'),
          'padding-inline-start': cssVar('min-gap'),
          'padding-inline-end': cssVar('min-padding'),
        },
      }),
      css({ rule: '& .close', decls: { display: 'none' } }),
    ],
  }),
  css({
    at: 'media',
    params: `(min-width: ${DESKTOP_BREAKPOINT})`,
    children: [
      css({ rule: '.sidebar', decls: { ...flexColumn() } }),
    ],
  }),
  //endregion Inline sidebar

  //region Popover panel
  css({
    rule: '.panel',
    decls: {
      position: 'fixed',
      'inset-block': 0,
      'inset-inline': 0,
      'margin-block': 0,
      'margin-inline': 0,
      'padding-block': 0,
      'padding-inline': 0,
      'border-style': 'none',
      'inline-size': cssPercent(100),
      'max-inline-size': cssPercent(100),
      'block-size': cssPercent(100),
      'max-block-size': cssPercent(100),
      'z-index': cssInt(100),
      display: 'flex',
      'background-color': 'transparent',
      'overflow-x': 'visible',
      'overflow-y': 'visible',
    },
  }),
  css({ rule: '.panel:not(:popover-open)', decls: { display: 'none' } }),
  css({
    at: 'keyframes',
    params: 'drawer-slide-in',
    children: [
      css({ rule: 'from', decls: { transform: cssTranslateX(cssPercent(-100)), opacity: 0 } }),
      css({ rule: 'to', decls: { transform: cssTranslateX(cssNum(0)), opacity: 1 } }),
    ],
  }),
  css({
    at: 'keyframes',
    params: 'scrim-fade-in',
    children: [
      css({ rule: 'from', decls: { 'background-color': 'transparent' } }),
      css({ rule: 'to', decls: { 'background-color': cssVar('overlay-bg') } }),
    ],
  }),
  css({
    rule: '.panel:popover-open',
    decls: {
      'animation-name': cssRaw('scrim-fade-in'),
      'animation-duration': cssS(0.2),
      'animation-timing-function': 'ease-out',
      'animation-fill-mode': 'both',
    },
  }),
  css({
    rule: '.panel:popover-open > .panel-drawer',
    decls: {
      'animation-name': cssRaw('drawer-slide-in'),
      'animation-duration': cssS(0.25),
      'animation-timing-function': cssRaw('cubic-bezier(0, 0, 0.2, 1)'),
      'animation-fill-mode': 'both',
    },
  }),
  css({
    rule: '.panel-drawer',
    decls: {
      'background-color': cssVar('bg'),
      'inline-size': cssRem(20),
      'max-inline-size': cssVi(85),
      'block-size': cssPercent(100),
      ...flexColumn(),
    },
  }),
  //endregion Popover panel

  ...shadowDomGlobals(),
].join('');

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
