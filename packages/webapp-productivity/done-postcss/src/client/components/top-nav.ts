/**
 * `\<top-nav\>`: sticky navigation bar with hamburger menu, page heading, and search link.
 * Dispatches a `menu-open` composed event when the hamburger is clicked.
 */
import { hDom as h, } from '@monochromatic-dev/module-hyperscript/ts';
import { TOP_NAV_STYLES, } from './top-nav-styles.ts';

/**
 * `\<top-nav\>` web component with hamburger, heading, and search icon.
 */
class TopNav extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  readonly #shadow: ShadowRoot;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders the navigation bar with hamburger, heading, and search link. */
  connectedCallback(): void {
    const heading = this.getAttribute('heading',) ?? '';
    this.#shadow.replaceChildren(
      h({
        tag: 'style',
        text: TOP_NAV_STYLES,
      },),
      h({
        tag: 'button',
        class: 'action menu-toggle',
        attrs: { 'aria-label': 'Open menu', },
        children: [
          h({
            tag: 'span',
            class: 'hamburger',
            children: [
              h({
                tag: 'span',
                class: 'line',
              },),
              h({
                tag: 'span',
                class: 'line',
              },),
              h({
                tag: 'span',
                class: 'line',
              },),
            ],
          },),
        ],
        on: {
          // oxlint-disable-next-line unicorn/consistent-function-scoping -- bound to class instance via .bind(this)
          click: function openMenu(this: TopNav,): void {
            this.dispatchEvent(
              new CustomEvent(
                'menu-open',
                {
                  bubbles: true,
                  composed: true,
                },
              ),
            );
          }
            .bind(this,),
        },
      },),
      h({
        tag: 'h1',
        text: heading,
      },),
      h({
        tag: 'a',
        class: 'action',
        attrs: {
          href: '/search',
          'aria-label': 'Search',
        },
        children: [
          h({
            tag: 'span',
            class: 'search-icon',
            children: [
              h({
                tag: 'span',
                class: 'circle',
              },),
              h({
                tag: 'span',
                class: 'handle',
              },),
            ],
          },),
        ],
      },),
    );
  }
}

customElements.define(
  'top-nav',
  TopNav,
);
