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

// oxlint-disable max-lines -- context menu with two item variants (button/input), anchor positioning, and popover lifecycle

import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';

/**
 * Single menu item definition.
 * When `defaultValue` is set, an inline text input appears next to the label.
 */
export type ContextMenuItem = {
  /** Display label for the menu item. */
  label: string;
  /** Callback invoked when the item is activated (click or Enter in input). */
  action: (value?: string) => void;
  /** When set, renders an inline input pre-filled with this value. */
  defaultValue?: string;
};

/**
 * Prevents click events from bubbling to the menu item container.
 *
 * @param event - mouse event to stop
 */
function stopClickPropagation(event: MouseEvent,): void {
  event.stopPropagation();
}

/** CSS anchor name for the context menu click-point anchor. */
const ANCHOR_NAME = '--ctx-anchor';

/**
 * Manages a single context menu instance.
 *
 * The popup lives in the top layer via `popover="auto"`, escaping
 * any overflow clipping. Light dismiss (click outside, Escape)
 * is handled natively by the browser.
 */
export class ContextMenu {
  /** Invisible anchor div positioned at the click point. */
  #anchor: HTMLDivElement;

  /** Popover element, or null when hidden. */
  #popup: HTMLDivElement | null = null;

  /** Callback fired when the popover is dismissed by the browser. */
  #onToggleBound: (event: Event) => void;

  constructor() {
    this.#anchor = h({
      tag: 'div',
      style: {
        position: 'fixed',
        'anchor-name': ANCHOR_NAME,
        'inline-size': '0',
        'block-size': '0',
        'pointer-events': 'none',
      },
    },);

    this.#onToggleBound = function handleToggle(event: Event,): void {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle event on popover elements always carries newState
      if ((event as ToggleEvent).newState === 'closed') {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- currentTarget is always the popover div
        const popup = event.currentTarget as HTMLDivElement;
        popup.remove();
      }
    };
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
  show({ x, y, items, }: { x: number; y: number; items: ContextMenuItem[] }): void {
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
        ? self.#renderInputItem({ item, onActivate, },)
        : self.#renderButtonItem({ item, onActivate, },);
    },);

    /** Position the invisible anchor at the click point. */
    this.#anchor.style.setProperty('inset-inline-start', `${x}px`,);
    this.#anchor.style.setProperty('inset-block-start', `${y}px`,);
    document.body.append(this.#anchor,);

    this.#popup = h({
      tag: 'div',
      attrs: { popover: 'auto', },
      style: {
        inset: 'auto',
        margin: '0',
        'position-anchor': ANCHOR_NAME,
        'inset-block-start': 'anchor(end)',
        'inset-inline-start': 'anchor(start)',
        'position-try-fallbacks': 'flip-block, flip-inline, flip-block flip-inline',
        'min-inline-size': '10rem',
        'background-color': 'var(--bg)',
        'border-style': 'solid',
        'border-width': '0.0625rem',
        'border-color': 'var(--hover-border)',
        'border-radius': '0.25rem',
        'padding-block': '0.25rem',
        'font-family': "'JetBrains Mono', monospace",
        'font-size': '1rem',
        color: 'var(--fg)',
      },
      children: menuItems,
    },);

    this.#popup.addEventListener('toggle', this.#onToggleBound,);
    document.body.append(this.#popup,);
    this.#popup.showPopover();

    const [firstItem,] = menuItems;
    if (firstItem !== undefined) firstItem.focus();
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

  /**
   * Creates a plain clickable menu item element.
   *
   * @param item - menu item definition
   *
   * @param onActivate - hides the menu and fires the action
   *
   * @returns menu item element
   */
  #renderButtonItem({ item, onActivate, }: {
    item: ContextMenuItem;
    onActivate: (action: () => void) => void;
  }): HTMLElement {
    return h({
      tag: 'div',
      style: {
        'padding-block': '0.25rem',
        'padding-inline': '0.5rem',
        cursor: 'pointer',
        'white-space': 'nowrap',
      },
      attrs: { tabindex: '0', },
      text: item.label,
      on: {
        click: function handleClick(): void { onActivate(item.action,); },
        keydown: function handleKeydown(event: KeyboardEvent,): void {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(item.action,);
          }
        },
        mouseover: function handleOver(event: MouseEvent,): void {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- currentTarget is always the div we attached the listener to
          (event.currentTarget as HTMLElement).style.backgroundColor = 'var(--tree-hover-bg)';
        },
        mouseout: function handleOut(event: MouseEvent,): void {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- currentTarget is always the div we attached the listener to
          (event.currentTarget as HTMLElement).style.backgroundColor = '';
        },
      },
    },);
  }

  /**
   * Creates a menu item with label + inline text input.
   *
   * @param item - menu item with `defaultValue` set
   *
   * @param onActivate - hides the menu and fires the action
   *
   * @returns menu item element containing label and input
   */
  #renderInputItem({ item, onActivate, }: {
    item: ContextMenuItem;
    onActivate: (action: () => void) => void;
  }): HTMLElement {
    const input = h({
      tag: 'input',
      style: {
        'flex-grow': '1',
        'min-inline-size': '8rem',
        'background-color': 'transparent',
        'border-style': 'none',
        'border-block-end-style': 'solid',
        'border-block-end-width': '0.0625rem',
        'border-block-end-color': 'var(--fg)',
        color: 'var(--fg)',
        'font-family': 'inherit',
        'font-size': 'inherit',
        'outline-style': 'none',
        opacity: '0.7',
      },
      attrs: { type: 'text', value: item.defaultValue ?? '', },
      on: {
        keydown: function handleInputKeydown(event: KeyboardEvent,): void {
          if (event.key === 'Enter') {
            event.preventDefault();
            const { value, } = input;
            if (value !== '') {
              onActivate(function fireAction(): void { item.action(value,); },);
            }
          }
        },
        click: stopClickPropagation,
      },
    },);

    return h({
      tag: 'div',
      style: {
        display: 'flex',
        'align-items': 'center',
        gap: '0.5rem',
        'padding-block': '0.25rem',
        'padding-inline': '0.5rem',
        'white-space': 'nowrap',
      },
      children: [
        h({ tag: 'span', text: item.label, style: { 'flex-shrink': '0', }, },),
        input,
      ],
    },);
  }
}
