import {
  hDom as h,
} from '@monochromatic-dev/module-hyperscript/ts';
import { css, } from '../css.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: registers the toggle-switch custom element
import './toggle-switch.ts';

/** Shadow DOM styles for the `\<setting-group\>` component. */
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
`,);

/**
 * `\<setting-group\>` -- a single settings row with a label, description,
 * and an action control (toggle switch or button) determined by the `mode` attribute.
 */
class SettingGroup extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders the setting group with label, optional description, and action control. */
  connectedCallback(): void {
    const label = this.getAttribute('label',) ?? '';
    const description = this.getAttribute('description',) ?? '';
    const mode = this.getAttribute('mode',) ?? 'toggle';
    const on = this.hasAttribute('on',);

    const actionElement = mode === 'button'
      ? h({
        tag: 'button',
        attrs: { part: 'action', },
        children: [
          h({ tag: 'slot', attrs: { name: 'action', }, text: 'connect?', },),
        ],
      },)
      : h({
        tag: 'toggle-switch',
        attrs: on ? { on: '', } : {},
      },);

    const children: (HTMLElement)[] = [
      h({
        tag: 'style',
        text: STYLES,
      },),
      h({
        tag: 'div',
        class: 'header',
        children: [
          h({
            tag: 'span',
            class: 'label',
            text: label,
          },),
          actionElement,
        ],
      },),
    ];

    if (description.length > 0) {
      children.push(h({
        tag: 'p',
        class: 'desc',
        text: description,
      },),);
    }

    this.#shadow.replaceChildren(...children,);
  }
}

customElements.define(
  'setting-group',
  SettingGroup,
);
