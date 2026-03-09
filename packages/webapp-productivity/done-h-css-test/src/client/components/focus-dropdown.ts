import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";
import { buttonOutlined, focusOutline } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: { display: 'block', 'inline-size': '100%', position: 'relative' },
  }),
  css({
    rule: '.trigger',
    decls: { ...buttonOutlined(), 'inline-size': '100%', 'text-align': 'start' },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline() }),
    ],
  }),
  css({
    rule: '.text',
    decls: { flex: '1', 'text-align': 'start' },
  }),
  css({
    rule: '.divider',
    decls: {
      'inline-size': 'calc(1 / 16 * 1rem)',
      'block-size': '100%',
      'background-color': 'var(--fg-weaker)',
    },
  }),
  css({
    rule: '.menu',
    decls: {
      position: 'absolute',
      'inset-block-start': '100%',
      'inset-inline-start': '0',
      'inline-size': '100%',
      'border-width': 'calc(1 / 16 * 1rem)',
      'border-style': 'solid',
      'border-color': 'var(--fg)',
      'background-color': 'var(--bg)',
      'padding-block': '0.25rem',
      'padding-inline': '0',
      'margin-block': '0',
      'margin-inline': '0',
      'list-style': 'none',
      'z-index': '10',
    },
    children: [
      css({ rule: '&:not(:popover-open)', decls: { display: 'none' } }),
    ],
  }),
  css({
    rule: '.option',
    decls: { 'padding-block': '0.5rem', 'padding-inline': '0.5rem', cursor: 'pointer' },
    children: [
      css({ rule: '&:hover', decls: { 'background-color': 'var(--hover-bg)' } }),
    ],
  }),
].join('');

const DEFAULT_PRESETS = [
  "Adulting tasks first",
  "Quick wins only",
  "Deep work focus",
];

/**
 * `<focus-dropdown>` -- popover-based dropdown for selecting a focus preset.
 * Reads initial value from the `value` attribute and dispatches `change`
 * events with `{ value }` when a preset is selected.
 */
class FocusDropdown extends HTMLElement {
  #shadow: ShadowRoot;
  #value: string;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#value = "";
  }

  connectedCallback(): void {
    this.#value = this.getAttribute("value") ?? "Select focus...";
    this.#render();
  }

  #render(): void {
    const textSpan = h({ tag: "span", class: "text", text: this.#value });

    const menu = h({
      tag: "ul",
      class: "menu",
      attrs: { popover: "auto" },
      children: DEFAULT_PRESETS.map((preset) =>
        h({
          tag: "li",
          class: "option",
          text: preset,
          on: {
            click: () => {
              this.#value = preset;
              textSpan.textContent = preset;
              menu.hidePopover();
              this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: preset } }));
            },
          },
        }),
      ),
    });

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({
        tag: "button",
        class: "trigger",
        children: [
          textSpan,
          h({ tag: "span", class: "divider" }),
          h({ tag: "span", text: "\u25BC" }),
        ],
        on: { click: () => { menu.togglePopover(); } },
      }),
      menu,
    );
  }
}

customElements.define("focus-dropdown", FocusDropdown);
