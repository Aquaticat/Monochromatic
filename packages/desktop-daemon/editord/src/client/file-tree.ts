/**
 * `<file-tree>` web component.
 *
 * A directory tree sidebar with one-level-ahead preloading. When a directory
 * is rendered, its child directories' contents are prefetched concurrently.
 * Clicking a file dispatches a `file-select` CustomEvent with the absolute path.
 *
 * No virtualization — the entire expanded tree is rendered into the DOM.
 */

// oxlint-disable max-lines -- web component class with five lifecycle/render methods; further splitting fractures the component

import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';
import {
  COLLAPSED,
  EXPANDED,
  STYLES,
} from './file-tree.styles.ts';

/** Entry in a directory listing. */
export type DirEntry = {
  /** File or directory name (no path separator). */
  name: string;
  /** Whether entry is a directory. */
  isDirectory: boolean;
};

/**
 * `<file-tree>` — directory tree sidebar with one-level-ahead preloading.
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

  /** Callback to fetch directory contents. Set by the parent application. */
  fetchDir: ((path: string,) => Promise<DirEntry[]>) | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
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
    this.#renderEntries(this.#tree, rootPath, entries,);
    void this.#preloadChildren(rootPath, entries,);
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
  #renderEntries(
    container: HTMLElement,
    parentPath: string,
    entries: DirEntry[],
  ): void {
    const tree = this;
    const elements = entries.map(function createEntryElement(entry,) {
      const fullPath = parentPath === '/'
        ? `/${entry.name}`
        : `${parentPath}/${entry.name}`;

      if (entry.isDirectory)
        return tree.#createDirEntry(fullPath, entry.name,);

      return tree.#createFileEntry(fullPath, entry.name,);
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
  async #preloadChildren(
    parentPath: string,
    entries: DirEntry[],
  ): Promise<void> {
    const tree = this;
    const fetchDir = this.fetchDir;
    if (fetchDir === null)
      return;

    await Promise.allSettled(
      entries
        .filter(function isDir(entry,) {
          return entry.isDirectory;
        },)
        .map(async function prefetchDir(entry,) {
          const fullPath = parentPath === '/'
            ? `/${entry.name}`
            : `${parentPath}/${entry.name}`;
          const children = await fetchDir(fullPath,);
          tree.#prefetchCache.set(fullPath, children,);
        },),
    );
  }

  /**
   * Creates an expandable directory entry that loads children from
   * the prefetch cache or fetches on demand.
   *
   * @param path - absolute path of the directory
   *
   * @param name - directory name for display
   *
   * @returns directory entry element with toggle and children container
   */
  #createDirEntry(path: string, name: string,): HTMLElement {
    const tree = this;
    let isExpanded = false;
    let isLoaded = false;
    let isLoading = false;

    const toggle = h({ tag: 'span', class: 'toggle', text: COLLAPSED, },);
    const children = h({ tag: 'div', class: 'children', },);
    children.hidden = true;

    const label = h({
      tag: 'div',
      class: 'entry-label',
      children: [
        toggle,
        h({ tag: 'span', class: 'name', text: name, },),
      ],
      on: {
        click: async function handleDirClick() {
          if (isLoading)
            return;

          isExpanded = !isExpanded;
          children.hidden = !isExpanded;
          toggle.textContent = isExpanded ? EXPANDED : COLLAPSED;

          if (isExpanded && !isLoaded) {
            isLoading = true;
            try {
              const cached = tree.#prefetchCache.get(path,);
              let entries: DirEntry[];
              if (cached !== undefined) {
                entries = cached;
                tree.#prefetchCache.delete(path,);
              }
              else {
                const fetchDir = tree.fetchDir;
                entries = fetchDir !== null
                  ? await fetchDir(path,)
                  : [];
              }
              tree.#renderEntries(children, path, entries,);
              isLoaded = true;
              void tree.#preloadChildren(path, entries,);
            }
            catch (error) {
              console.error(`[file-tree] failed to list ${path}:`, error,);
            }
            isLoading = false;
          }
        },
      },
    },);

    return h({
      tag: 'div',
      class: 'entry',
      children: [label, children,],
    },);
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
  #createFileEntry(path: string, name: string,): HTMLElement {
    const tree = this;

    const label = h({
      tag: 'div',
      class: 'entry-label',
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

    return h({
      tag: 'div',
      class: 'entry',
      children: [label,],
    },);
  }
}

customElements.define('file-tree', FileTree,);
