import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { buttonOutlined, flexColumn, flexRow, focusOutline } from "../mixins.ts";
import "./toggle-switch.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: { ...flexColumn(), gap: 'var(--min-padding)' },
  }),
  css({
    rule: '.header',
    decls: { ...flexRow(), gap: 'var(--min-gap)' },
  }),
  css({
    rule: '.label',
    decls: { 'font-size': '1rem', flex: '1' },
  }),
  css({
    rule: '.desc',
    decls: { 'font-size': 'calc(15 / 16 * 1rem)', 'line-height': '1.5', color: 'var(--fg-weaker)' },
  }),
  css({
    rule: 'button',
    decls: buttonOutlined(),
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
].join('');

/**
 * `<setting-group>` -- a single settings row with a label, description,
 * and an action control (toggle switch or button) determined by the `mode` attribute.
 */
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

    const actionElement = mode === "button"
      ? h({ tag: "button", attrs: { part: "action" }, children: [h({ tag: "slot", attrs: { name: "action" }, text: "connect?" })] })
      : h({ tag: "toggle-switch", attrs: on ? { on: "" } : {} });

    const children: (HTMLElement)[] = [
      h({ tag: "style", text: STYLES }),
      h({
        tag: "div",
        class: "header",
        children: [
          h({ tag: "span", class: "label", text: label }),
          actionElement,
        ],
      }),
    ];

    if (description.length > 0) {
      children.push(h({ tag: "p", class: "desc", text: description }));
    }

    this.#shadow.replaceChildren(...children);
  }
}

customElements.define("setting-group", SettingGroup);
