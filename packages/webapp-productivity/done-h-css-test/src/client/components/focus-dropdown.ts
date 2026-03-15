/**
 * `<focus-dropdown>` -- popover-based dropdown for selecting a focus preset.
 * Reads initial value from the `value` attribute and dispatches `change`
 * events with `{ value }` when a preset is selected.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import { FOCUS_DROPDOWN_STYLES, } from './focus-dropdown-styles.ts';

/** Available focus preset labels. */
const DEFAULT_PRESETS = [
  'Adulting tasks first',
  'Quick wins only',
  'Deep work focus',
];

/**
 * `<focus-dropdown>` web component.
 *
 * Popover-based dropdown that lets users select a focus preset.
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

  /** Reads the `value` attribute and renders the dropdown. */
  connectedCallback(): void {
    this.#value = this.getAttribute('value',) ?? 'Select focus...';
    this.#render();
  }

  /** Renders the trigger button, divider, and popover menu into the shadow root. */
  #render(): void {
    const textSpan = h({ tag: 'span', class: 'text', text: this.#value, },);
    const self = this;

    const menu = h({
      tag: 'ul',
      class: 'menu',
      attrs: { popover: 'auto', },
      children: DEFAULT_PRESETS.map(function buildOption(preset,) {
        return h({
          tag: 'li',
          class: 'option',
          text: preset,
          on: {
            click: function handleOptionClick() {
              self.#value = preset;
              textSpan.textContent = preset;
              menu.hidePopover();
              self.dispatchEvent(
                new CustomEvent('change', { bubbles: true,
                  detail: { value: preset, }, },),
              );
            },
          },
        },);
      },),
    },);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: FOCUS_DROPDOWN_STYLES, },),
      h({
        tag: 'button',
        class: 'trigger',
        children: [
          textSpan,
          h({ tag: 'span', class: 'divider', },),
          h({ tag: 'span', text: '\u25BC', },),
        ],
        on: { click: function handleTriggerClick() {
          menu.togglePopover();
        }, },
      },),
      menu,
    );
  }
}

customElements.define('focus-dropdown', FocusDropdown,);
