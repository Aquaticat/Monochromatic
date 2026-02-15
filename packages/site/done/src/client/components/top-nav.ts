class TopNav extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const heading = this.getAttribute("heading") ?? "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--min-gap, 16px);
          height: 48px;
          padding: 0 var(--min-padding, 8px);
          background: var(--gray-bg, #eee);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        h1 {
          flex: 1;
          text-align: center;
          font-size: 1.5rem;
          font-weight: 400;
          line-height: normal;
          margin: 0;
        }
        .action {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--gray-fg, #111);
          padding: 0;
          text-decoration: none;
        }
        .hamburger {
          width: 32px;
          height: 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 6px;
        }
        .line {
          width: 28px;
          height: 4px;
          background: var(--gray-fg, #111);
          display: block;
        }
        .search-icon {
          width: 32px;
          height: 32px;
          position: relative;
        }
        .circle {
          position: absolute;
          top: 0;
          left: 0;
          width: 22px;
          height: 22px;
          border: 4px solid var(--gray-fg, #111);
          border-radius: 999px;
        }
        .handle {
          position: absolute;
          top: 19px;
          left: 19px;
          width: 4px;
          height: 14px;
          background: var(--gray-fg, #111);
          transform: rotate(-45deg);
          transform-origin: top left;
        }
        @media (min-width: 768px) {
          :host {
            justify-content: space-between;
            padding-left: var(--min-gap, 16px);
            border-bottom: 1px solid var(--gray-bg-weaker, #bbb);
          }
          .menu-toggle { display: none; }
          h1 { text-align: left; }
        }
      </style>
      <button class="action menu-toggle" aria-label="Open menu">
        <span class="hamburger">
          <span class="line"></span>
          <span class="line"></span>
          <span class="line"></span>
        </span>
      </button>
      <h1>${heading}</h1>
      <a class="action" href="/search" aria-label="Search">
        <span class="search-icon">
          <span class="circle"></span>
          <span class="handle"></span>
        </span>
      </a>
    `;

    this.#shadow.querySelector(".menu-toggle")?.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("menu-open", { bubbles: true, composed: true }));
    });
  }
}

customElements.define("top-nav", TopNav);
