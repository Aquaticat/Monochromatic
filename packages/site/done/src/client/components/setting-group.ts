import "./toggle-switch.ts";

class SettingGroup extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const label = this.getAttribute("label") ?? "";
    const description = this.getAttribute("description") ?? "";
    const mode = this.getAttribute("mode") ?? "toggle";
    const on = this.hasAttribute("on");

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          gap: var(--min-padding, 8px);
        }
        .header {
          display: flex;
          gap: var(--min-gap, 16px);
          align-items: center;
        }
        .label {
          font-size: 1rem;
          flex: 1;
        }
        .desc {
          font-size: 0.9375rem;
          line-height: 1.5;
          color: var(--gray-fg-weaker, #444);
        }
        button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border: 1px solid var(--gray-fg, #111);
          padding: 0.5rem;
          height: 48px;
          background: transparent;
          color: var(--gray-fg, #111);
          font: inherit;
          cursor: pointer;
        }
      </style>
      <div class="header">
        <span class="label">${label}</span>
        ${mode === "button" ? `<button part="action"><slot name="action">connect?</slot></button>` : `<toggle-switch ${on ? 'on' : ''}></toggle-switch>`}
      </div>
      ${description.length > 0 ? `<p class="desc">${description}</p>` : ""}
    `;
  }
}

customElements.define("setting-group", SettingGroup);
