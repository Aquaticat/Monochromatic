import { css } from "../css.ts";

const STYLES = css(`
  :host {
    display: block;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: none;
  }
  .overlay.open { display: flex; }
  .backdrop {
    position: absolute;
    inset: 0;
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
  }
  .close:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: -0.125rem;
  }
  .close svg {
    inline-size: 2rem;
    block-size: 2rem;
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
  ::slotted(a), a {
    @apply --flex-row;
    gap: var(--min-gap);
    min-block-size: 3rem;
    padding-block: 0;
    padding-inline: var(--min-gap);
    color: var(--fg);
    text-decoration: none;
    font-size: 1.25rem;
    font-weight: 400;
  }
  a:hover {
    background-color: var(--hover-bg);
  }
  a:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: -0.125rem;
  }

  @media (min-width: 48rem) {
    :host {
      inline-size: 22rem;
      block-size: 100dvh;
      position: sticky;
      inset-block-start: 0;
    }
    .overlay {
      display: flex;
      position: relative;
      inset: auto;
      z-index: auto;
      block-size: 100%;
    }
    .backdrop { display: none; }
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
    this.#shadow.querySelector(".backdrop")?.addEventListener("click", () => { this.open = false; });
    this.#shadow.querySelector(".close")?.addEventListener("click", () => { this.open = false; });
  }

  attributeChangedCallback(): void {
    const overlay = this.#shadow.querySelector(".overlay") as HTMLElement | null;
    if (overlay !== null) {
      overlay.classList.toggle("open", this.open);
    }
  }

  #render(): void {
    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="overlay${this.open ? " open" : ""}">
        <div class="backdrop"></div>
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
