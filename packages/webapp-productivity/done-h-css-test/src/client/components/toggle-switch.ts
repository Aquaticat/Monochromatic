import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { cssCalc, cssPercent, cssRaw, cssRem, cssS, cssTranslateY, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { borderRadiusFull, flexCenter } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: {
      display: 'inline-flex',
      cursor: 'pointer',
      'inline-size': cssRem(3),
      'block-size': cssRem(2),
    },
  }),
  css({
    rule: '.track',
    decls: {
      'inline-size': cssPercent(100),
      'block-size': cssPercent(100),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      ...borderRadiusFull(),
      'background-color': cssVar('bg'),
      position: 'relative',
      'overflow-x': 'hidden',
      'overflow-y': 'hidden',
    },
  }),
  css({
    rule: '.thumb',
    decls: {
      position: 'absolute',
      'inset-block-start': cssPercent(50),
      transform: cssTranslateY(cssPercent(-50)),
      'inline-size': cssRem(2),
      'block-size': cssRem(2),
      ...borderRadiusFull(),
      'border-width': cssCalc(`${cssRem(1)} / 16`),
      'border-style': 'solid',
      'border-color': cssVar('fg'),
      'background-color': cssVar('bg-stronger'),
      ...flexCenter(),
      'font-size': cssRem(1),
      'transition-property': cssRaw('inset-inline-start, inset-inline-end'),
      'transition-duration': cssS(0.15),
    },
  }),
  css({
    rule: '.thumb.on',
    decls: {
      'inset-inline-end': cssCalc(`${cssRem(-1)} / 16`),
      'inset-inline-start': 'auto',
    },
  }),
  css({
    rule: '.thumb.off',
    decls: {
      'inset-inline-start': cssCalc(`${cssRem(-1)} / 16`),
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
