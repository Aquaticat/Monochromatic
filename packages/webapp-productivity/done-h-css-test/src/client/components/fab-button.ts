import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { borderRadiusFull, flexCenter, focusOutline, minTouchTarget } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: {
      position: 'fixed',
      'inset-block-end': '1rem',
      'inset-inline-end': '1rem',
      'z-index': '50',
    },
  }),
  css({
    rule: 'button',
    decls: {
      ...flexCenter(),
      ...minTouchTarget(),
      'inline-size': '4rem',
      'block-size': '4rem',
      ...borderRadiusFull(),
      'background-color': 'var(--fg)',
      'border-width': '0.25rem',
      'border-style': 'solid',
      'border-color': 'var(--bg)',
      color: 'var(--bg)',
      'font-size': '2rem',
      cursor: 'pointer',
      'line-height': '1.2',
    },
    children: [
      css({ rule: '&:hover', decls: { opacity: '0.85' } }),
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
].join('');

/**
 * `<fab-button>` -- floating action button pinned to the bottom-right.
 * Reads the `label` attribute for accessibility and renders a `<slot>` for custom content.
 */
class FabButton extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const label = this.getAttribute("label") ?? "Action";
    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "button",
        attrs: { part: "button", "aria-label": label },
        children: [h({ tag: "slot", text: "+" })],
      }),
    );
  }
}

customElements.define("fab-button", FabButton);
