/**
 * Context menu for the file tree.
 *
 * Uses the Popover API (`popover="auto"`) for top-layer rendering and
 * light dismiss. An invisible anchor div is positioned at the click point
 * and CSS anchor positioning places the menu beside it.
 *
 * Items can include an inline text input for actions that need user text
 * (rename, copy, move, new). The user types directly in the menu row
 * and presses Enter to confirm.
 */

import { hDom as h, } from '@monochromatic-dev/module-hyperscript/ts';

import {
  type ContextMenuItem,
  renderButtonItem,
  renderInputItem,
} from './items.ts';

export type { ContextMenuItem, } from './items.ts';

/**
 * Removes the popover element when dismissed by the browser.
 * Without hoisting: consistent-function-scoping lint warning since it captures no parent scope vars.
 *
 * @param event - popover toggle event
 */
function handlePopoverToggle(event: Event,): void {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle event on popover elements always carries newState
  if ((event as ToggleEvent).newState === 'closed') {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- currentTarget is always the popover div
    const popup = event.currentTarget as HTMLDivElement;
    popup.remove();
  }
}

/**
 * Manages a single context menu instance.
 *
 * The popup lives in the top layer via `popover="auto"`, escaping
 * any overflow clipping. Light dismiss (click outside, Escape)
 * is handled natively by the browser.
 */
export class ContextMenu {
  /** Invisible anchor div positioned at the click point. */
  readonly #anchor: HTMLDivElement;

  /** Popover element, or null when hidden. */
  #popup: HTMLDivElement | null = null;

  /** Callback fired when the popover is dismissed by the browser. */
  readonly #onToggleBound: (event: Event,) => void;

  /** Initializes the invisible anchor div and popover toggle handler. */
  constructor() {
    this.#anchor = h({
      tag: 'div',
      class: 'ctx-anchor',
    },);
    this.#onToggleBound = handlePopoverToggle;
  }

  /**
   * Shows the context menu at the given coordinates.
   *
   * @param x - horizontal click position in viewport pixels
   *
   * @param y - vertical click position in viewport pixels
   *
   * @param items - menu items to display
   */
  show({
    x,
    y,
    items,
  }: {
    x: number;
    y: number;
    items: ContextMenuItem[];
  },): void {
    this.hide();

    const self = this;

    /**
     * Hides the menu and invokes the given action callback.
     *
     * @param action - callback to invoke after hiding
     */
    function onActivate(action: () => void,): void {
      self.hide();
      action();
    }

    const menuItems = items.map(function renderItem(item,) {
      return item.defaultValue !== undefined
        ? renderInputItem({
          item,
          onActivate,
        },)
        : renderButtonItem({
          item,
          onActivate,
        },);
    },);

    /** Position the invisible anchor at the click point. */
    this.#anchor.style.setProperty(
      'inset-inline-start',
      `${x}px`,
    );
    this.#anchor.style.setProperty(
      'inset-block-start',
      `${y}px`,
    );
    document.body.append(this.#anchor,);

    this.#popup = h({
      tag: 'div',
      class: 'ctx-popup',
      attrs: { popover: 'auto', },
      children: menuItems,
    },);

    this.#popup.addEventListener(
      'toggle',
      this.#onToggleBound,
    );
    document.body.append(this.#popup,);
    this.#popup.showPopover();

    const [firstItem,] = menuItems;
    if (firstItem !== undefined)
      firstItem.focus();
  }

  /** Hides the context menu and cleans up the anchor. */
  hide(): void {
    if (this.#popup !== null) {
      this.#popup.hidePopover();
      this.#popup.remove();
      this.#popup = null;
    }
    this.#anchor.remove();
  }
}
