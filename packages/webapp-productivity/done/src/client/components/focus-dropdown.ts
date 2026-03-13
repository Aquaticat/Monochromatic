import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

/** Z-index for the dropdown menu overlay. */
const MENU_Z_INDEX = 10;

/** Shadow DOM styles for the `\<focus-dropdown\>` component. */
const STYLES = css(`
  :host {
    display: block;
    inline-size: 100%;
    position: relative;
  }
  .trigger {
    @apply --button-outlined;
    inline-size: 100%;
    text-align: start;

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: 0.125rem;
    }
  }
  .text {
    flex: 1;
    text-align: start;
  }
  .divider {
    inline-size: calc(1 / 16 * 1rem);
    block-size: 100%;
    background-color: var(--fg-weaker);
  }
  .menu {
    position: absolute;
    inset-block-start: 100%;
    inset-inline-start: 0;
    inline-size: 100%;
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    background-color: var(--bg);
    padding-block: 0.25rem;
    padding-inline: 0;
    margin-block: 0;
    margin-inline: 0;
    list-style: none;
    z-index: ${String(MENU_Z_INDEX)};

    &:not(:popover-open) { display: none; }
  }
  .option {
    padding-block: 0.5rem;
    padding-inline: 0.5rem;
    cursor: pointer;

    &:hover {
      background-color: var(--hover-bg);
    }
  }
`);

/** Default focus preset options. */
const DEFAULT_PRESETS = [
  "Adulting tasks first",
  "Quick wins only",
  "Deep work focus",
];

/**
 * `\<focus-dropdown\>` -- popover-based dropdown for selecting a focus preset.
 * Reads initial value from the `value` attribute and dispatches `change`
 * events with `\{ value \}` when a preset is selected.
 */
class FocusDropdown extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Currently selected preset value. */
  #value: string;

  /** Initializes the shadow root with empty value. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#value = "";
  }

  /** Reads initial value from attribute and renders the dropdown. */
  connectedCallback(): void {
    this.#value = this.getAttribute("value") ?? "Select focus...";
    this.#render();
  }

  /** Renders the trigger button and popover menu with preset options. */
  #render(): void {
    const textSpan = h({ tag: "span", class: "text", text: this.#value });
    const menu = h({
      tag: "ul",
      class: "menu",
      attrs: { popover: "auto" },
      // oxlint-disable-next-line no-restricted-syntax/no-arrow-function -- arrow needed: closures over `this.#value` and `this.dispatchEvent`
      children: DEFAULT_PRESETS.map((preset) => h({
        tag: "li",
        class: "option",
        text: preset,
        on: {
          // oxlint-disable-next-line no-restricted-syntax/no-arrow-function -- arrow needed: click handler must reference outer `this`
          click: () => {
            this.#value = preset;
            textSpan.textContent = preset;
            menu.hidePopover();
            this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: preset } }));
          },
        },
      })),
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
        on: { click: function onTriggerClick() { menu.togglePopover(); } },
      }),
      menu,
    );
  }
}

customElements.define("focus-dropdown", FocusDropdown);
