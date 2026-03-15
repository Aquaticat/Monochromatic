/**
 * `<side-drawer>` -- intrinsic sidebar navigation.
 *
 * Renders two copies of the nav: an inline sidebar visible when the
 * component is narrow, and a popover panel opened by the hamburger menu
 * when the component is full-width (stacked).
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { SIDE_DRAWER_STYLES } from "./side-drawer-styles.ts";
import { buildCloseButton, buildHeader, buildNav } from "./side-drawer-helpers.ts";

/**
 * `<side-drawer>` web component.
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

  /** Whether the popover panel is currently visible. */
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
      h({ tag: "style", text: SIDE_DRAWER_STYLES }),
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
