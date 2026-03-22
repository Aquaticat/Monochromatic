/**
 * `<references-popup>` web component.
 *
 * Displays a navigable list of reference locations from the language server.
 * Supports keyboard navigation (arrow keys, Enter) and click selection.
 * Emits a `reference-select` event when a location is chosen.
 *
 * Uses the Popover API (`popover="auto"`) for top-layer rendering and
 * light dismiss. An invisible anchor div is placed at the editor cursor
 * and CSS anchor positioning auto-flips when overflowing the viewport.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import { middleOut, } from './middle-out.ts';
import { STYLES, } from './references-popup.styles.ts';

/** Single reference location with display label. */
export type ReferenceLocation = {
  /** Absolute file path. */
  path: string;
  /** 0-based line number. */
  line: number;
  /** Display label (relative path). */
  label: string;
};

/** Detail emitted with the `reference-select` event. */
export type ReferenceSelectDetail = {
  /** Absolute file path. */
  path: string;
  /** 1-based line number for navigation. */
  line: number;
};

/**
 * `<references-popup>` -- language server references dropdown.
 *
 * Dispatches `reference-select` CustomEvent when a location is accepted.
 */
export class ReferencesPopup extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;
  /** Container for the list items. */
  #list: HTMLDivElement | null = null;
  /** Currently displayed locations. */
  #locations: ReferenceLocation[] = [];
  /** Index of the selected item (-1 = none). */
  #selectedIndex = -1;
  /** Measured width of a single monospace character in pixels. */
  #charWidthPx = 0;

  /**
   * Invisible anchor div positioned at the editor cursor.
   * The popup uses CSS `position-anchor` to attach to it.
   */
  #anchor: HTMLDivElement;

  /** Initializes the shadow root and creates the anchor div. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
    this.#anchor = document.createElement('div',);
    this.#anchor.style.setProperty('position', 'fixed',);
    this.#anchor.style.setProperty('anchor-name', '--ref-anchor',);
    this.#anchor.style.setProperty('inline-size', '2px',);
    this.#anchor.style.setProperty('background-color', 'red',);
    this.#anchor.style.setProperty('pointer-events', 'none',);
    this.#anchor.style.setProperty('z-index', '9999',);
  }

  /** Renders the container and sets up popover behavior. */
  connectedCallback(): void {
    this.#list = h({ tag: 'div', class: 'list', },);
    this.#shadow.replaceChildren(h({ tag: 'style', text: STYLES, },), this.#list,);
    this.setAttribute('popover', 'auto',);

    /** Clean up anchor div when popover is light-dismissed. */
    const popup = this;
    this.addEventListener('toggle', function handleToggle(event,) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle event on popover is ToggleEvent
      if ((event as ToggleEvent).newState === 'closed') {
        popup.#anchor.remove();
        popup.#locations = [];
        popup.#selectedIndex = -1;
      }
    },);
  }

  /**
   * Shows the popup with reference locations anchored near the editor cursor.
   *
   * @param locations - reference locations to display
   *
   * @param x - horizontal viewport coordinate of the editor cursor (pixels)
   *
   * @param y - top of the editor cursor (pixels)
   *
   * @param cursorHeight - height of the editor cursor (pixels)
   */
  show({ locations, x, y, cursorHeight, }: { locations: ReferenceLocation[]; x: number; y: number; cursorHeight: number }): void {
    if (this.#list === null || locations.length === 0) return;
    this.#locations = locations;
    this.#selectedIndex = 0;

    /** Insert anchor div as sibling and position it to overlay the editor cursor. */
    this.parentElement?.insertBefore(this.#anchor, this,);
    this.#anchor.style.setProperty('inset-inline-start', `${x}px`,);
    this.#anchor.style.setProperty('inset-block-start', `${y}px`,);
    this.#anchor.style.setProperty('block-size', `${cursorHeight}px`,);

    this.showPopover();

    this.#measureCharWidth();
    const budget = this.#charBudget();

    this.#list.replaceChildren(...locations.map(function renderItem(loc, index,) {
      const truncated = budget > 0
        ? middleOut({ text: loc.label, query: loc.label.split('/',).pop() ?? '', budget, },)
        : loc.label;
      const item = h({ tag: 'div', class: 'item', },);
      item.append(
        h({ tag: 'span', class: 'item-path', text: truncated, },),
        h({ tag: 'span', class: 'line-num', text: `:${String(loc.line + 1,)}`, },),
      );
      if (index === 0) item.setAttribute('data-selected', '',);
      return item;
    },),);
  }

  /** Hides the popup and removes the anchor div. */
  hide(): void {
    try { this.hidePopover(); } catch { /* already hidden */ }
    this.#anchor.remove();
    this.#locations = [];
    this.#selectedIndex = -1;
  }

  /**
   * Whether the popup is currently visible.
   *
   * @returns true if the popover is open
   */
  get visible(): boolean { return this.matches(':popover-open',); }

  /** Moves the selection up or down. */
  navigate({ direction, }: { direction: 'up' | 'down' }): void {
    if (this.#locations.length === 0 || this.#list === null) return;
    if (direction === 'up') {
      this.#selectedIndex = this.#selectedIndex <= 0 ? this.#locations.length - 1 : this.#selectedIndex - 1;
    }
    else {
      this.#selectedIndex = this.#selectedIndex >= this.#locations.length - 1 ? 0 : this.#selectedIndex + 1;
    }
    for (const [i, child,] of [...this.#list.children,].entries()) {
      if (i === this.#selectedIndex) { (child as HTMLElement).setAttribute('data-selected', '',); child.scrollIntoView({ block: 'nearest', },); }
      else (child as HTMLElement).removeAttribute('data-selected',);
    }
  }

  /**
   * Accepts the selected location and dispatches a `reference-select` event.
   *
   * @returns selected location detail, or null if nothing selected
   */
  accept(): ReferenceSelectDetail | null {
    if (this.#selectedIndex < 0 || this.#selectedIndex >= this.#locations.length) return null;
    const loc = this.#locations[this.#selectedIndex];
    if (loc === undefined) return null;
    const detail: ReferenceSelectDetail = { path: loc.path, line: loc.line + 1, };
    this.hide();
    this.dispatchEvent(new CustomEvent('reference-select', { detail, bubbles: true, composed: true, },),);
    return detail;
  }

  /**
   * Measures the width of a single monospace character using canvas text metrics.
   */
  #measureCharWidth(): void {
    const { font, } = getComputedStyle(this,);
    const canvas = document.createElement('canvas',);
    const ctx = canvas.getContext('2d',);
    if (ctx === null) return;
    ctx.font = font;
    this.#charWidthPx = ctx.measureText('0',).width;
  }

  /**
   * Computes the character budget for middle-out path truncation.
   *
   * @returns number of monospace characters that fit in one row
   */
  #charBudget(): number {
    if (this.#charWidthPx <= 0) return 0;
    return Math.floor(this.clientWidth / this.#charWidthPx,);
  }
}

customElements.define('references-popup', ReferencesPopup,);
