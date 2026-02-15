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
      <style>
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
          background: rgba(0, 0, 0, 0.3);
        }
        .drawer {
          position: relative;
          z-index: 1;
          background: var(--gray-bg, #eee);
          width: 320px;
          max-width: 85vw;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--min-gap, 16px) var(--min-padding, 8px) var(--min-padding, 8px) var(--min-gap, 16px);
          min-height: 64px;
        }
        .close {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          width: 48px;
          height: 48px;
          padding: 0;
          background: transparent;
          cursor: pointer;
        }
        .close svg { width: 32px; height: 32px; }
        .divider {
          height: 1px;
          background: var(--gray-bg-weaker, #bbb);
          width: 100%;
        }
        nav {
          display: flex;
          flex-direction: column;
          gap: var(--min-gap, 16px);
          flex: 1;
          padding-top: var(--min-gap, 16px);
        }
        ::slotted(a), a {
          display: flex;
          align-items: center;
          gap: var(--min-gap, 16px);
          min-height: 48px;
          padding: 0 var(--min-gap, 16px);
          color: var(--gray-fg, #111);
          text-decoration: none;
          font-size: 1.25rem;
          font-weight: 400;
        }
        a:hover { background: rgba(0, 0, 0, 0.05); }

        @media (min-width: 768px) {
          :host {
            width: 352px;
            flex-shrink: 0;
            height: 100dvh;
            position: sticky;
            top: 0;
          }
          .overlay {
            display: flex !important;
            position: relative;
            inset: auto;
            z-index: auto;
            height: 100%;
          }
          .backdrop { display: none; }
          .drawer {
            width: 352px;
            max-width: 352px;
            border-right: 1px solid var(--gray-bg-weaker, #bbb);
            height: 100%;
          }
          .close { display: none; }
          .header {
            padding: var(--min-padding, 8px) var(--min-padding, 8px) var(--min-padding, 8px) var(--min-gap, 16px);
          }
        }
      </style>
      <div class="overlay${this.open ? " open" : ""}">
        <div class="backdrop"></div>
        <aside class="drawer">
          <div class="header">
            <span style="font-size:1.25rem">Firstname</span>
            <button class="close" aria-label="Close menu">
              <svg viewBox="0 0 48 48" fill="none" stroke="#111" stroke-width="4">
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
