import { css } from "../css.ts";

const STYLES = css(`
  :host {
    display: block;
  }
  .panel {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    border-style: none;
    padding-block: 0;
    padding-inline: 0;
    background-color: transparent;
    inline-size: auto;
    max-inline-size: none;
    max-block-size: none;
    overflow: visible;
  }

  /* Popover uses :popover-open instead of manual class toggling */
  .panel:not(:popover-open) { display: none; }

  .panel::backdrop {
    background-color: var(--overlay-bg);
  }
  .drawer {
    position: relative;
    z-index: 1;
    background-color: var(--bg);
    inline-size: 20rem;
    max-inline-size: 85vw;
    block-size: 100%;
    @apply --flex-column;
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

  @media (min-width: 48rem) {
    :host {
      inline-size: 22rem;
      block-size: 100dvh;
      position: sticky;
      inset-block-start: 0;
    }
    .panel {
      display: flex;
      position: relative;
      inset: auto;
      z-index: auto;
      block-size: 100%;
    }
    .panel::backdrop { display: none; }
    .drawer {
      inline-size: 22rem;
      max-inline-size: 22rem;
      border-inline-end-width: calc(1 / 16 * 1rem);
      border-inline-end-style: solid;
      border-inline-end-color: var(--bg-weaker);
      block-size: 100%;
    }
    .close { display: none; }
    .header {
      padding-block: var(--min-padding);
      padding-inline-start: var(--min-gap);
      padding-inline-end: var(--min-padding);
    }
  }
`);

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
    this.#shadow.querySelector(".close")?.addEventListener("click", () => { this.open = false; });

    // Light-dismiss: close when clicking the ::backdrop area (outside the drawer)
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
    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="panel" popover="manual">
        <aside class="drawer">
          <div class="header">
            <span style="font-size:1.25rem">Firstname</span>
            <button class="close" aria-label="Close menu">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4">
                <line x1="14" y1="14" x2="34" y2="34"/>
                <line x1="34" y1="14" x2="14" y2="34"/>
              </svg>
            </button>
          </div>
          <div class="divider"></div>
          <nav>
            <a href="/">Inbox</a>
            <a href="/in-progress">In Progress</a>
            <a href="/settings">Settings</a>
            <a href="#">Contact</a>
          </nav>
        </aside>
      </div>
    `;
  }
}

customElements.define("side-drawer", SideDrawer);
