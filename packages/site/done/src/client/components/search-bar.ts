class SearchBar extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get value(): string {
    const input = this.#shadow.querySelector("input");
    return input?.value ?? "";
  }

  set value(text: string) {
    const input = this.#shadow.querySelector("input");
    if (input !== null) {
      input.value = text;
    }
  }

  connectedCallback(): void {
    const query = this.getAttribute("value") ?? "";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: var(--min-gap, 16px);
          height: 48px;
          padding: 0 var(--min-padding, 8px);
          background: var(--gray-bg, #eee);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .back {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.5rem;
          color: var(--gray-fg, #111);
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 1rem;
          font-family: inherit;
          color: var(--gray-fg, #111);
          outline: none;
          height: 100%;
        }
        input::placeholder { color: var(--gray-medium, #888); }
        @media (min-width: 768px) {
          :host { border-bottom: 1px solid var(--gray-bg-weaker, #bbb); }
          .back { display: none; }
          input { font-size: 1.5rem; }
        }
      </style>
      <button class="back" aria-label="Go back">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20,6 10,16 20,26"/>
        </svg>
      </button>
      <input type="search" placeholder="Search titles, tags, ..." value="${query.replaceAll('"', '&quot;')}" autofocus>
    `;

    this.#shadow.querySelector(".back")?.addEventListener("click", () => {
      history.back();
    });

    const input = this.#shadow.querySelector("input");
    let timeout: ReturnType<typeof setTimeout>;
    input?.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent("search", { detail: { query: input.value.trim() }, bubbles: true }));
      }, 300);
    });
  }
}

customElements.define("search-bar", SearchBar);
