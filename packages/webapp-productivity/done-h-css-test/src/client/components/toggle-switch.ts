import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { borderRadiusFull, flexCenter } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: {
      display: 'inline-flex',
      cursor: 'pointer',
      'inline-size': '3rem',
      'block-size': '2rem',
    },
  }),
  css({
    rule: '.track',
    decls: {
      'inline-size': '100%',
      'block-size': '100%',
      'border-width': 'calc(1 / 16 * 1rem)',
      'border-style': 'solid',
      'border-color': 'var(--fg)',
      ...borderRadiusFull(),
      'background-color': 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    },
  }),
  css({
    rule: '.thumb',
    decls: {
      position: 'absolute',
      'inset-block-start': '50%',
      transform: 'translateY(-50%)',
      'inline-size': '2rem',
      'block-size': '2rem',
      ...borderRadiusFull(),
      'border-width': 'calc(1 / 16 * 1rem)',
      'border-style': 'solid',
      'border-color': 'var(--fg)',
      'background-color': 'var(--bg-stronger)',
      ...flexCenter(),
      'font-size': '1rem',
      transition: 'inset-inline-start 0.15s, inset-inline-end 0.15s',
    },
  }),
  css({
    rule: '.thumb.on',
    decls: {
      'inset-inline-end': 'calc(-1 / 16 * 1rem)',
      'inset-inline-start': 'auto',
    },
  }),
  css({
    rule: '.thumb.off',
    decls: {
      'inset-inline-start': 'calc(-1 / 16 * 1rem)',
      'inset-inline-end': 'auto',
    },
  }),
].join('');

/**
 * `<toggle-switch>` -- boolean toggle with animated thumb.
 * Reflects state via the `on` attribute and dispatches a `change` event on toggle.
 */
class ToggleSwitch extends HTMLElement {
  static observedAttributes = ["on"];

  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

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
      h({ tag: "style", text: STYLES }),
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
