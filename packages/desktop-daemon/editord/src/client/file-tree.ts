/**
 * `<file-tree>` web component.
 *
 * A directory tree sidebar using native `<details><summary>` elements
 * for expand/collapse. The browser handles toggle state natively;
 * JS only handles lazy-loading directory contents on first expand
 * and one-level-ahead preloading.
 *
 * Clicking a file dispatches a `file-select` CustomEvent with the absolute path.
 * No virtualization — the entire expanded tree is rendered into the DOM.
 */

// oxlint-disable max-lines -- web component with lazy-loading, preloading, and two element factories; splitting fractures the component

import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';

import type { DirEntry, } from '../protocol.ts';
import {
  COLLAPSED,
  EXPANDED,
  STYLES,
} from './file-tree.styles.ts';
import { l as rootLogger, tagged, } from './log.ts';

/** Tagged logger for the file tree subsystem. */
const l = tagged({ tag: 'file-tree', l: rootLogger, },);

export type { DirEntry, };

/**
 * `<file-tree>` — directory tree sidebar with native `<details>` toggle.
 *
 * Set `fetchDir` to a function that returns directory entries for a given path,
 * then call `expandRoot(path)` to populate the tree. Clicking a file dispatches
 * a `file-select` CustomEvent with `{ path }` as the detail.
 */
export class FileTree extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Tree container element. */
  #tree: HTMLDivElement | null = null;

  /** Currently selected file label element. */
  #selectedLabel: HTMLElement | null = null;

  /** Cache of preloaded directory children, keyed by absolute path. */
  #prefetchCache = new Map<string, DirEntry[]>();

  /** Tracks directories whose contents have already been loaded. */
  #loadedDirs = new Set<string>();

  /** Callback to fetch directory contents. Set by the parent application. */
  fetchDir: ((path: string,) => Promise<DirEntry[]>) | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /**
   * Parent directory of the currently selected file.
   * Reads the `data-path` attribute from the selected label element
   * and returns its parent directory.
   *
   * @returns parent directory path, or empty string when nothing is selected
   */
  get selectedDir(): string {
    if (this.#selectedLabel === null)
      return '';

    const filePath = this.#selectedLabel.dataset['path'] ?? '';
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.slice(0, lastSlash,) : '';
  }

  /** Renders the tree container and attaches styles. */
  connectedCallback(): void {
    this.#tree = h({ tag: 'div', class: 'tree', },);
    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#tree,
    );
  }

  /**
   * Expands the root directory, renders its contents, and preloads
   * direct children of all subdirectories one level ahead.
   *
   * @param rootPath - absolute path to the root directory
   */
  async expandRoot(rootPath: string,): Promise<void> {
    if (this.#tree === null || this.fetchDir === null)
      return;

    const entries = await this.fetchDir(rootPath,);
    this.#renderEntries({ container: this.#tree, parentPath: rootPath, entries, },);
    void this.#preloadChildren({ parentPath: rootPath, entries, },);
  }

  /**
   * Builds the full path for a child entry within a parent directory.
   *
   * @param parentPath - absolute path of the parent directory
   *
   * @param name - child entry name
   *
   * @returns absolute path for the child
   */
  #childPath({ parentPath, name, }: { parentPath: string; name: string }): string {
    return parentPath === '/'
      ? `/${name}`
      : `${parentPath}/${name}`;
  }

  /**
   * Renders directory entries as child elements of a container.
   *
   * @param container - parent element to populate
   *
   * @param parentPath - absolute path of the parent directory
   *
   * @param entries - directory entries to render
   */
  #renderEntries({ container, parentPath, entries, }: {
    container: HTMLElement;
    parentPath: string;
    entries: DirEntry[];
  }): void {
    const tree = this;
    const elements = entries.map(function createEntryElement(entry,) {
      const fullPath = tree.#childPath({ parentPath, name: entry.name, },);

      if (entry.isDirectory)
        return tree.#createDirEntry({ path: fullPath, name: entry.name, },);

      return tree.#createFileEntry({ path: fullPath, name: entry.name, },);
    },);

    container.replaceChildren(...elements,);
  }

  /**
   * Fetches direct children for all directory entries concurrently
   * and stores them in the prefetch cache for instant expansion.
   *
   * @param parentPath - absolute path of the parent directory
   *
   * @param entries - directory entries whose subdirectories to preload
   */
  async #preloadChildren({ parentPath, entries, }: {
    parentPath: string;
    entries: DirEntry[];
  }): Promise<void> {
    const { fetchDir, } = this;
    if (fetchDir === null)
      return;

    const tree = this;
    await Promise.allSettled(
      entries
        .filter(function isDir(entry,) {
          return entry.isDirectory;
        },)
        .map(async function prefetchDir(entry,) {
          const fullPath = tree.#childPath({ parentPath, name: entry.name, },);
          const children = await fetchDir(fullPath,);
          tree.#prefetchCache.set(fullPath, children,);
        },),
    );
  }

  /**
   * Creates a `<details><summary>` directory entry that loads
   * children from the prefetch cache or fetches on demand.
   *
   * @param path - absolute path of the directory
   *
   * @param name - directory name for display
   *
   * @returns directory entry element with native expand/collapse
   */
  #createDirEntry({ path, name, }: { path: string; name: string }): HTMLElement {
    const tree = this;
    const toggle = h({ tag: 'span', class: 'toggle', text: COLLAPSED, },);
    const childrenContainer = h({ tag: 'div', class: 'children', },);

    const summary = h({
      tag: 'summary',
      children: [
        toggle,
        h({ tag: 'span', class: 'name', text: name, },),
      ],
    },);

    const details = h({
      tag: 'details',
      children: [summary, childrenContainer,],
      on: {
        toggle: async function handleToggle(event,) {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle event always fires on the <details> element that owns it
          const detailsElement = event.currentTarget as HTMLDetailsElement;
          const isExpanded = detailsElement.open;
          toggle.textContent = isExpanded ? EXPANDED : COLLAPSED;

          if (!isExpanded || tree.#loadedDirs.has(path,))
            return;

          tree.#loadedDirs.add(path,);
          try {
            const cached = tree.#prefetchCache.get(path,);
            const entries = cached !== undefined
              ? (tree.#prefetchCache.delete(path,), cached)
              : await (tree.fetchDir?.(path,) ?? Promise.resolve([],));
            tree.#renderEntries({ container: childrenContainer, parentPath: path, entries, },);
            void tree.#preloadChildren({ parentPath: path, entries, },);
          }
          catch (error) {
            l.error(`failed to list ${path}: ${String(error,)}`,);
            tree.#loadedDirs.delete(path,);
          }
        },
      },
    },);

    return details;
  }

  /**
   * Creates a clickable file entry that dispatches `file-select` on click.
   *
   * @param path - absolute path of the file
   *
   * @param name - file name for display
   *
   * @returns file entry element
   */
  #createFileEntry({ path, name, }: { path: string; name: string }): HTMLElement {
    const tree = this;

    const label = h({
      tag: 'div',
      class: 'file-label',
      attrs: { 'data-path': path, },
      children: [
        h({ tag: 'span', class: 'toggle', },),
        h({ tag: 'span', class: 'name', text: name, },),
      ],
      on: {
        click: function handleFileClick() {
          if (tree.#selectedLabel !== null)
            tree.#selectedLabel.classList.remove('selected',);

          tree.#selectedLabel = label;
          label.classList.add('selected',);

          tree.dispatchEvent(new CustomEvent('file-select', {
            detail: { path, },
            bubbles: true,
          },),);
        },
      },
    },);

    return label;
  }
}

customElements.define('file-tree', FileTree,);
