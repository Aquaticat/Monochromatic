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

  /** Last focused tree item, retained after focus leaves the tree. */
  #lastFocused: HTMLElement | null = null;

  /** Cache of preloaded directory children, keyed by absolute path. */
  #prefetchCache = new Map<string, DirEntry[]>();

  /** Tracks directories whose contents have already been loaded. */
  #loadedDirs = new Set<string>();

  /** In-flight load promises keyed by directory path, awaited by `restoreExpansion`. */
  #loadPromises = new Map<string, Promise<void>>();

  /** Callback to fetch directory contents. Set by the parent application. */
  fetchDir: ((path: string,) => Promise<DirEntry[]>) | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /**
   * Directory scope of the last focused tree item.
   * For `<summary>` (directory) elements, returns the path directly.
   * For `.file-label` (file) elements, returns the parent directory.
   * Persists after focus leaves the tree (e.g. when the search overlay opens).
   *
   * @returns directory path, or empty string when nothing has been focused
   */
  get selectedDir(): string {
    if (this.#lastFocused === null)
      return '';

    const itemPath = this.#lastFocused.dataset['path'] ?? '';
    if (itemPath === '')
      return '';

    if (this.#lastFocused.tagName === 'SUMMARY')
      return itemPath;

    const lastSlash = itemPath.lastIndexOf('/');
    return lastSlash > 0 ? itemPath.slice(0, lastSlash,) : '';
  }

  /** Renders the tree container and attaches styles, and listens for focus changes. */
  connectedCallback(): void {
    const tree = this;
    this.#tree = h({ tag: 'div', class: 'tree', },);
    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#tree,
    );
    this.#shadow.addEventListener('focusin', function handleFocusIn(event,) {
      if (event.target instanceof HTMLElement)
        tree.#lastFocused = event.target;
    },);
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
   * Collects the absolute paths of all currently expanded directories.
   * Walks all open `<details>` elements and reads their `data-path`
   * attribute from the inner `<summary>`.
   *
   * @returns array of absolute directory paths that are expanded
   */
  get expandedDirs(): string[] {
    if (this.#tree === null) return [];

    const dirs: string[] = [];
    for (const details of this.#tree.querySelectorAll<HTMLDetailsElement>('details[open]',)) {
      const path = details.querySelector<HTMLElement>('summary',)?.dataset['path'] ?? '';
      if (path !== '') dirs.push(path,);
    }
    return dirs;
  }

  /**
   * Restores previously expanded directories by programmatically
   * opening each `<details>` element from root outward.
   * Directories are sorted by depth so parents load before children,
   * ensuring nested directories exist in the DOM before expansion.
   * Awaits each directory's load promise so child entries are rendered
   * before attempting to expand the next depth level.
   *
   * @param dirs - absolute paths of directories to expand
   */
  async restoreExpansion({ dirs, }: { dirs: string[] }): Promise<void> {
    if (this.#tree === null || this.fetchDir === null || dirs.length === 0)
      return;

    /** Sort by path depth (fewer separators first) so parents expand before children. */
    const sorted = dirs.toSorted(function byDepth(a, b,) {
      return a.split('/').length - b.split('/').length;
    },);

    for (const dirPath of sorted) {
      const summary = this.#tree.querySelector<HTMLElement>(`summary[data-path="${CSS.escape(dirPath,)}"]`,);
      if (summary === null) {
        l.warn(`skipping expansion of ${dirPath}: not found in tree`,);
        continue;
      }

      const details = summary.parentElement;
      if (details instanceof HTMLDetailsElement && !details.open) {
        details.open = true;
        /** Dispatch toggle event to trigger the lazy-load handler. */
        details.dispatchEvent(new Event('toggle',),);
        /** Await the in-flight load so children render before expanding the next level. */
        // oxlint-disable-next-line eslint(no-await-in-loop) -- sequential expansion is intentional: parent directories must render before children can be found in the DOM
        await this.#loadPromises.get(dirPath,);
      }
    }
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
      attrs: { 'data-path': path, },
      children: [
        toggle,
        h({ tag: 'span', class: 'name', text: name, },),
      ],
    },);

    const details = h({
      tag: 'details',
      children: [summary, childrenContainer,],
      on: {
        toggle: function handleToggle(event,) {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- toggle event always fires on the <details> element that owns it
          const detailsElement = event.currentTarget as HTMLDetailsElement;
          const isExpanded = detailsElement.open;
          toggle.textContent = isExpanded ? EXPANDED : COLLAPSED;

          if (!isExpanded || tree.#loadedDirs.has(path,))
            return;

          tree.#loadedDirs.add(path,);

          /** Store the load promise so `restoreExpansion` can await it. */
          const loadPromise = (async function loadDir(): Promise<void> {
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
            tree.#loadPromises.delete(path,);
          })();
          tree.#loadPromises.set(path, loadPromise,);
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
      attrs: { 'data-path': path, tabindex: '0', },
      children: [
        h({ tag: 'span', class: 'toggle', },),
        h({ tag: 'span', class: 'name', text: name, },),
      ],
      on: {
        click: function handleFileClick() {
          label.focus();
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
