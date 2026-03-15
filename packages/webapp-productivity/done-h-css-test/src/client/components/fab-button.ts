import {
  cssInt,
  cssRem,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import { $ as css, } from '../css.ts';
import {
  borderRadiusFull,
  flexCenter,
  focusOutline,
  minTouchTarget,
} from '../mixins.ts';

/** Compiled CSS string for `<fab-button>` Shadow DOM. */
const STYLES = [
  css({
    rule: ':host',
    decls: {
      position: 'fixed',
      'inset-block-end': cssRem(1,),
      'inset-inline-end': cssRem(1,),
      'z-index': cssInt(50,),
    },
  },),
  css({
    rule: 'button',
    decls: {
      ...flexCenter(),
      ...minTouchTarget(),
      'inline-size': cssRem(4,),
      'block-size': cssRem(4,),
      ...borderRadiusFull(),
      'background-color': cssVar('fg',),
      'border-width': cssRem(0.25,),
      'border-style': 'solid',
      'border-color': cssVar('bg',),
      color: cssVar('bg',),
      'font-size': cssRem(2,),
      cursor: 'pointer',
      'line-height': 1.2,
    },
    children: [
      css({ rule: '&:hover', decls: { opacity: 0.85, }, },),
      css({ rule: '&:focus-visible', decls: focusOutline(), },),
    ],
  },),
]
  .join('',);

/**
 * `<fab-button>` -- floating action button pinned to the bottom-right.
 * Reads the `label` attribute for accessibility and renders a `<slot>` for custom content.
 */
class FabButton extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders the action button with label and slot into the shadow root. */
  connectedCallback(): void {
    const label = this.getAttribute('label',) ?? 'Action';
    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      h({
        tag: 'button',
        attrs: { part: 'button', 'aria-label': label, },
        children: [h({ tag: 'slot', text: '+', },),],
      },),
    );
  }
}

customElements.define('fab-button', FabButton,);
