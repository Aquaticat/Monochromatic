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
 */
export function resolveRefreshContainer({
  tree,
  path,
  rootPath,
  loadedDirs,
}: {
  tree: HTMLDivElement;
  path: string;
  rootPath: string;
  loadedDirs: Set<string>;
},): HTMLElement | null {
  let container: HTMLElement | null = null;
  if (path === rootPath)
    container = tree;
  else {
    const summary = tree.querySelector<HTMLElement>(
      `summary[data-path="${CSS.escape(path,)}"]`,
    );
    if (summary === null)
      return null;
    container = summary.parentElement?.querySelector<HTMLElement>(':scope > .children',)
      ?? null;
  }
  if (container === null)
    return null;
  if (path !== rootPath && !loadedDirs.has(path,))
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
 */
export async function performRefreshDir({
  tree,
  path,
  rootPath,
  state,
}: {
  tree: HTMLDivElement;
  path: string;
  rootPath: string;
  state: FileTreeState;
},): Promise<void> {
  if (state.fetchDir === null)
    return;
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
      if (state.fetchDir !== null) {
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
 */
export async function refreshDirContents(
  {
    container,
    path,
    fetchDir,
    recentPaths,
    preloadFn,
  }: {
    container: HTMLElement;
    path: string;
    fetchDir: (dirPath: string,) => Promise<DirEntry[]>;
    recentPaths: string[];
    preloadFn: (opts: {
      parentPath: string;
      entries: DirEntry[]
    },) => void;
  },
): Promise<void> {
  const entries = await fetchDir(path,);

  /** Preserve existing `<tree-dir-entry>` elements for subdirs that still exist. */
  const existingDirs = new Map<string, TreeDirEntry>();
  for (const dirEntry of container.querySelectorAll<TreeDirEntry>(
    ':scope > tree-dir-entry',
  )) {
    if (dirEntry.entryPath !== '')
      existingDirs.set(
        dirEntry.entryPath,
        dirEntry,
      );
  }

  const elements = entries.map(function createOrReuseEntry(entry,) {
    const fullPath = childPath({
      parentPath: path,
      name: entry.name,
    },);
    if (entry.isDirectory) {
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
      recencyIndex: recentPaths.indexOf(fullPath,),
    },);
  },);

  container.replaceChildren(...elements,);
  preloadFn({
    parentPath: path,
    entries,
  },);
}
