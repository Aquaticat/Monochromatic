/**
 * `<tree-dir-entry>` web component.
 *
 * A directory entry in the file tree using native `<details><summary>`
 * elements. Uses `display: contents` so the inner `<details>` participates
 * directly in the parent's flex layout.
 *
 * Dispatches `dir-open` when expanded and `show-context` on right-click.
 * Does not manage data fetching — the parent `<file-tree>` handles that
 * via event delegation.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import { nameToOrder, } from './order.ts';

/** Detail payload for the `dir-open` CustomEvent. */
export type DirOpenDetail = {
  /** Absolute directory path. */
  path: string;
  /** Container element to populate with children. */
  childrenContainer: HTMLDivElement;
};

/** Detail payload for the `show-context` CustomEvent. */
export type ShowContextDetail = {
  /** Horizontal click position in pixels. */
  x: number;
  /** Vertical click position in pixels. */
  y: number;
  /** Absolute entry path. */
  path: string;
  /** Whether this is a directory or file entry. */
  kind: 'dir' | 'file';
};

/**
 * Prevents the default browser context menu.
 *
 * @param event - context menu event to suppress
 */
function suppressContextMenu(event: Event,): void { event.preventDefault(); }

/**
 * `<tree-dir-entry>` — directory entry with native `<details>` toggle.
 *
 * @example
 * ```ts
 * const entry = createTreeDirEntry({ path: '/src', name: 'src' });
 * container.appendChild(entry);
 * ```
 */
export class TreeDirEntry extends HTMLElement {
  /** Absolute path of this directory. */
  entryPath = '';
  /** Display name. */
  entryName = '';
  /** Container `<div class="children">` for child entries. */
  #childrenContainer: HTMLDivElement | null = null;
  /** Inner `<details>` element that provides native toggle behavior. */
  #details: HTMLDetailsElement | null = null;
  /** Guards against re-rendering when the element is re-inserted into the DOM. */
  #initialized = false;

  /**
   * @returns container for child entry elements
   */
  get childrenContainer(): HTMLDivElement | null { return this.#childrenContainer; }

  /** Builds the `<details><summary>` structure and attaches event handlers. */
  connectedCallback(): void {
    if (this.#initialized) return;
    this.#initialized = true;

    this.dataset['path'] = this.entryPath;
    this.#childrenContainer = h({ tag: 'div', class: 'children', },);

    const entry = this;
    const summary = h({
      tag: 'summary',
      attrs: { 'data-path': this.entryPath, },
      children: [h({ tag: 'span', class: 'name', text: this.entryName, },),],
      on: {
        mouseup: function handleDirContext(event: MouseEvent,) {
          if (event.button !== 2) return;
          event.preventDefault();
          entry.dispatchEvent(new CustomEvent('show-context', {
            bubbles: true,
            detail: { x: event.clientX, y: event.clientY, path: entry.entryPath, kind: 'dir' as const, },
          },),);
        },
        contextmenu: suppressContextMenu,
      },
    },);

    this.#details = h({
      tag: 'details',
      children: [summary, this.#childrenContainer,],
      on: {
        toggle: function handleToggle(event: Event,) {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle fires on <details>
          const detailsEl = event.currentTarget as HTMLDetailsElement;
          if (!detailsEl.open) return;
          entry.dispatchEvent(new CustomEvent('dir-open', {
            bubbles: true,
            detail: { path: entry.entryPath, childrenContainer: entry.#childrenContainer, },
          },),);
        },
      },
    },);

    this.#details.style.order = String(nameToOrder({ name: this.entryName, },),);
    this.append(this.#details,);
  }
}

/**
 * Creates a `<tree-dir-entry>` element with the given path and name.
 *
 * @param path - absolute directory path
 *
 * @param name - display name
 *
 * @returns configured element (renders on DOM insertion)
 */
export function createTreeDirEntry({ path, name, }: { path: string; name: string }): TreeDirEntry {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- guaranteed by customElements.define
  const entry = document.createElement('tree-dir-entry',) as TreeDirEntry;
  entry.entryPath = path;
  entry.entryName = name;
  return entry;
}

customElements.define('tree-dir-entry', TreeDirEntry,);
