import {
  cssInt,
  cssPercent,
  cssRem,
  cssTranslateX,
  cssVar,
} from '@monochromatic-dev/module-es/h-css';
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import { $ as css, } from '../css.ts';

/** Z-index for toast positioning above page content. */
const TOAST_Z_INDEX = 1_000;

/** Center position percentage for inline-start. */
const CENTER_PERCENT = 50;

/** Negative center offset for translateX centering. */
const NEG_CENTER_PERCENT = -50;

/** Toast block padding in rem. */
const TOAST_PADDING_BLOCK = 0.55;

/** Toast inline padding in rem. */
const TOAST_PADDING_INLINE = 0.85;

/** Shadow DOM styles for the `\<toast-message\>` component. */
const STYLES = [
  css({
    rule: ':host',
    decls: {
      position: 'fixed',
      'inset-block-end': cssRem(1,),
      'inset-inline-start': cssPercent(CENTER_PERCENT,),
      transform: cssTranslateX(cssPercent(NEG_CENTER_PERCENT,),),
      'z-index': cssInt(TOAST_Z_INDEX,),
    },
  },),
  css({
    rule: '.content',
    decls: {
      'background-color': cssVar('red-bg',),
      color: cssVar('bg-stronger',),
      'padding-block': cssRem(TOAST_PADDING_BLOCK,),
      'padding-inline': cssRem(TOAST_PADDING_INLINE,),
    },
  },),
]
  .join('',);

/** Auto-dismiss duration in milliseconds. */
const DISMISS_MS = 3_000;

/**
 * `\<toast-message\>` -- ephemeral notification that auto-dismisses.
 * Reads the `message` attribute for display text.
 */
class ToastMessage extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Handle for the auto-dismiss timer, or null when not scheduled. */
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders content and schedules auto-removal after `DISMISS_MS`. */
  connectedCallback(): void {
    this.#render();
    const removeFn = this.remove.bind(this,);
    this.#timer = setTimeout(
      function dismiss(): void {
        removeFn();
      },
      DISMISS_MS,
    );
  }

  /** Cancels the auto-dismiss timer when the element is removed early. */
  disconnectedCallback(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer,);
      this.#timer = null;
    }
  }

  /** Renders the toast content into the shadow root. */
  #render(): void {
    const message = this.getAttribute('message',) ?? '';
    this.#shadow.replaceChildren(
      h({
        tag: 'style',
        text: STYLES,
      },),
      h({
        tag: 'div',
        class: 'content',
        text: message,
      },),
    );
  }
}

customElements.define(
  'toast-message',
  ToastMessage,
);

/**
 * Shows a toast notification that auto-dismisses after 3 seconds.
 * Removes any existing toast before showing the new one.
 *
 * @param message - Text to display in the toast
 */
export function showToast(message: string,): void {
  document.querySelector<HTMLElement>('toast-message',)?.remove();

  const toast = document.createElement('toast-message',);
  toast.setAttribute(
    'message',
    message,
  );
  document.body.append(toast,);
}
