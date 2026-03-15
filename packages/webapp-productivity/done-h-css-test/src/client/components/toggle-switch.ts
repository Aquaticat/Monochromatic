/**
 * `<toggle-switch>` -- boolean toggle with animated thumb.
 * Reflects state via the `on` attribute and dispatches a `change` event on toggle.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { TOGGLE_SWITCH_STYLES } from "./toggle-switch-styles.ts";

/** `<toggle-switch>` web component. */
class ToggleSwitch extends HTMLElement {
  static observedAttributes = ["on"];

  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /** Whether the toggle is currently in the "on" position. */
  get on(): boolean {
    return this.hasAttribute("on");
  }

  set on(value: boolean) {
    if (value) {
      this.setAttribute("on", "");
    } else {
      this.removeAttribute("on");
    }
  }

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#handleClick);
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #handleClick = (): void => {
    this.on = !this.on;
    this.dispatchEvent(new CustomEvent("change", { detail: { on: this.on }, bubbles: true }));
  };

  #render(): void {
    const isOn = this.on;
    this.#shadow.replaceChildren(
      h({ tag: "style", text: TOGGLE_SWITCH_STYLES }),
      h({
        tag: "div",
        class: "track",
        children: [
          h({ tag: "span", class: `thumb ${isOn ? "on" : "off"}`, text: isOn ? "\u2713" : "\u2717" }),
        ],
      }),
    );
  }
}

customElements.define("toggle-switch", ToggleSwitch);
