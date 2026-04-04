/**
 * `\<focus-dropdown\>` -- popover-based dropdown for selecting a focus preset.
 * Reads initial value from the `value` attribute and dispatches `change`
 * events with `\{ value \}` when a preset is selected.
 */
import {
  hDom as h,
} from '@monochromatic-dev/module-hyperscript/ts';
import { FOCUS_DROPDOWN_STYLES, } from './focus-dropdown-styles.ts';

/** Default focus preset options. */
const DEFAULT_PRESETS = [
  'Adulting tasks first',
  'Quick wins only',
  'Deep work focus',
];

/**
 * `\<focus-dropdown\>` web component for selecting a focus preset.
 */
class FocusDropdown extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Currently selected preset value. */
  #value: string;

  /** Initializes the shadow root with empty value. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
    this.#value = '';
  }

  /** Reads initial value from attribute and renders the dropdown. */
  connectedCallback(): void {
    this.#value = this.getAttribute('value',) ?? 'Select focus...';
    this.#render();
  }

  /** Renders the trigger button and popover menu with preset options. */
  #render(): void {
    const textSpan = h({
      tag: 'span',
      class: 'text',
      text: this.#value,
    },);
    const menu = h({
      tag: 'ul',
      class: 'menu',
      attrs: { popover: 'auto', },
      children: DEFAULT_PRESETS.map(
        function buildOption(
          this: FocusDropdown,
          preset: string,
        ): HTMLElement {
          return h({
            tag: 'li',
            class: 'option',
            text: preset,
            on: {
              click: function selectPreset(this: FocusDropdown,): void {
                this.#value = preset;
                textSpan.textContent = preset;
                menu.hidePopover();
                this.dispatchEvent(
                  new CustomEvent(
                    'change',
                    { bubbles: true, detail: { value: preset, }, },
                  ),
                );
              }
                .bind(this,),
            },
          },);
        }
          .bind(this,),
      ),
    },);

    this.#shadow.replaceChildren(
      h({
        tag: 'style',
        text: FOCUS_DROPDOWN_STYLES,
      },),
      h({
        tag: 'button',
        class: 'trigger',
        children: [
          textSpan,
          h({
            tag: 'span',
            class: 'divider',
          },),
          h({
            tag: 'span',
            text: '\u25BC',
          },),
        ],
        on: { click: function onTriggerClick(): void {
          menu.togglePopover();
        }, },
      },),
      menu,
    );
  }
}

customElements.define(
  'focus-dropdown',
  FocusDropdown,
);
