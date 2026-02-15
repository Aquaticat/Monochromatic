import { css } from "../css.macro.ts" with { type: "macro" };
import "./toggle-switch.ts";

const STYLES = css(`
  :host {
    @apply --flex-column;
    gap: var(--min-padding);
  }
  .header {
    @apply --flex-row;
    gap: var(--min-gap);
  }
  .label {
    font-size: 1rem;
    flex: 1;
  }
  .desc {
    font-size: calc(15 / 16 * 1rem);
    line-height: 1.5;
    color: var(--fg-weaker);
  }
  button {
    @apply --button-outlined;
  }
  button:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
`);

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
      <style>${STYLES}</style>
      <div class="header">
        <span class="label">${label}</span>
        ${mode === "button" ? `<button part="action"><slot name="action">connect?</slot></button>` : `<toggle-switch ${on ? 'on' : ''}></toggle-switch>`}
      </div>
      ${description.length > 0 ? `<p class="desc">${description}</p>` : ""}
    `;
  }
}

customElements.define("setting-group", SettingGroup);
