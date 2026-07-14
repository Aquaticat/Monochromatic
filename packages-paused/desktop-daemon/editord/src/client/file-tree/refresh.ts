/**
 * Directory refresh logic for the file tree.
 *
 * Re-fetches a directory listing and updates the DOM, preserving
 * expansion state of existing subdirectories by reusing their
 * `<tree-dir-entry>` elements.
 */

import type { DirEntry, } from '../../../protocol.ts';
import {
  createTreeDirEntry,
  type TreeDirEntry,
} from './dir-entry.ts';
import {
  buildRecencyIndex,
  childPath,
  preloadChildren,
} from './entries.ts';
import { createTreeFileEntry, } from './file-entry.ts';
import type { FileTreeState, } from './state.ts';

/**
 * Resolves the DOM container for a directory's children.
 * The root directory uses the tree element itself; subdirectories
 * use the `.children` div inside their `<details>` element.
 *
 * @param tree - tree container element
 *
 * @param path - absolute directory path to resolve
 *
 * @param rootPath - absolute root directory path
 *
 * @param loadedDirs - set of directories whose contents have been loaded
 *
 * @returns container element, or null if not found or not loaded
 *
 * @example
 * ```ts
 * const result = resolveRefreshContainer({ tree: treeElement, path: '/home/user/project/src/main.ts', rootPath: '/home/user/project', loadedDirs: loadedDirs, });
 * ```
 */
export function resolveRefreshContainer({
  tree,
  path,
  rootPath,
  loadedDirs,
}: {
  readonly tree: HTMLDivElement;
  readonly path: string;
  readonly rootPath: string;
  readonly loadedDirs: ReadonlySet<string>;
},): HTMLElement | null {
  /**
   * Container that holds the directory's child entries; resolved branchwise below.
   */
  let container: HTMLElement | null = null;
  if (path === rootPath)
    container = tree;
  else {
    /**
     * Summary node of the matching `<details>`; the parent of its `.children` sibling.
     */
    const summary = tree.querySelector<HTMLElement>(
      `summary[data-path="${CSS.escape(path,)}"]`,
    );
    if (summary === null)
      return null;
    container = summary.parentElement
      ?.querySelector<HTMLElement>(':scope > .children',)
      ?? null;
  }
  if (container === null)
    return null;
  if ((path !== rootPath) && (!loadedDirs.has(path,)))
    return null;
  return container;
}

/**
 * Performs a full refresh of a directory, resolving the container and updating entries.
 *
 * @param tree - tree container element
 *
 * @param path - absolute path of the directory to refresh
 *
 * @param rootPath - absolute root directory path
 *
 * @param state - tree's internal state
 *
 * @example
 * ```ts
 * await performRefreshDir({ tree: treeElement, path: '/home/user/project/src', rootPath: '/home/user/project', state: treeState, });
 * ```
 */
export async function performRefreshDir({
  tree,
  path,
  rootPath,
  state,
}: {
  readonly tree: HTMLDivElement;
  readonly path: string;
  readonly rootPath: string;
  readonly state: FileTreeState;
},): Promise<void> {
  if (state.fetchDir
    === null)
    return;
  /**
   * DOM container for the refreshed directory; null when the path is not currently expanded.
   */
  const container = resolveRefreshContainer({
    tree,
    path,
    rootPath,
    loadedDirs: state.loadedDirs,
  },);
  if (container === null)
    return;
  await refreshDirContents({
    container,
    path,
    fetchDir: state.fetchDir,
    recentPaths: state.recentPaths,
    preloadFn: function preload(opts,) {
      if (state.fetchDir
        !== null) {
        void preloadChildren({
          ...opts,
          fetchDir: state.fetchDir,
          prefetchCache: state
            .prefetchCache,
        },);
      }
    },
  },);
}

/**
 * Re-fetches a directory's listing and updates the DOM.
 *
 * Preserves existing `<tree-dir-entry>` elements for subdirectories
 * that still exist, creating new components only for new entries.
 *
 * @param container - DOM container for the directory's children
 *
 * @param path - absolute directory path
 *
 * @param fetchDir - function to fetch directory contents
 *
 * @param recentPaths - current recent file paths for recency markers
 *
 * @param preloadFn - preloads subdirectory children
 *
 * @example
 * ```ts
 * await refreshDirContents({ container: dirElement, path: '/home/user/project/src/main.ts', fetchDir: function handleFetchDir() { l.info("done"); }, recentPaths: '/home/user/project/src/main.ts', preloadFn: preloadChildren, });
 * ```
 */
export async function refreshDirContents(
  {
    container,
    path,
    fetchDir,
    recentPaths,
    preloadFn,
  }: {
    readonly container: HTMLElement;
    readonly path: string;
    readonly fetchDir: (dirPath: string,) => Promise<readonly DirEntry[]>;
    readonly recentPaths: readonly string[];
    readonly preloadFn: (opts: {
      readonly parentPath: string;
      readonly entries: readonly DirEntry[];
    },) => void;
  },
): Promise<void> {
  /**
   * Fresh listing fetched from the server; replaces the current DOM children.
   */
  const entries = await fetchDir(path,);

  /**
   * Preserve existing `<tree-dir-entry>` elements for subdirs that still exist.
   */
  const existingDirs = new Map<string, TreeDirEntry>();
  for (const dirEntry of container.querySelectorAll<TreeDirEntry>(
    ':scope > tree-dir-entry',
  )) {
    if (dirEntry.entryPath
      !== '') {
      existingDirs.set(
        dirEntry.entryPath,
        dirEntry,
      );
    }
  }

  /**
   * Path-to-index lookup used to render recency markers on file entries.
   */
  const recencyMap = buildRecencyIndex({ recentPaths, },);

  /**
   * Final array of child elements; reuses dir nodes where possible to keep expansion state.
   */
  const elements = entries.map(function createOrReuseEntry(entry,) {
    /**
     * Absolute path of the current entry, derived from the parent path and the entry name.
     */
    const fullPath = childPath({
      parentPath: path,
      name: entry.name,
    },);
    if (entry.isDirectory) {
      /**
       * Reused directory entry from the prior render, or undefined when this is a new dir.
       */
      const existing = existingDirs.get(fullPath,);
      if (existing !== undefined) {
        existingDirs.delete(fullPath,);
        return existing;
      }
      return createTreeDirEntry({
        path: fullPath,
        name: entry.name,
      },);
    }
    return createTreeFileEntry({
      path: fullPath,
      name: entry.name,
      recencyIndex: recencyMap.get(fullPath,)
        ?? (-1),
    },);
  },);

  container.replaceChildren(...elements,);
  preloadFn({
    parentPath: path,
    entries,
  },);
}
