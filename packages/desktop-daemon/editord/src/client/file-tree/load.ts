/**
 * Directory loading handler for the file tree.
 *
 * Processes `dir-open` events by fetching entries from the cache
 * or network, creating child web components, and managing
 * the in-flight load promise.
 */

import type { FileTreeState, } from './state.ts';
import { createTreeDirEntry, type DirOpenDetail, } from './dir-entry.ts';
import { childPath, preloadChildren, } from './entries.ts';
import { createTreeFileEntry, } from './file-entry.ts';
import { l as rootLogger, tagged, } from '../log.ts';

import type { DirEntry, } from '../../../protocol.ts';

/** Tagged logger for the directory loading subsystem. */
const l = tagged({ tag: 'file-tree-load', l: rootLogger, },);

/**
 * Handles a `dir-open` event by loading directory children.
 *
 * Skips if the directory is already loaded. Creates child
 * `<tree-dir-entry>` and `<tree-file-entry>` elements and
 * kicks off a preload of grandchildren.
 *
 * @param detail - event detail with path and container
 *
 * @param state - tree's shared mutable state
 */
export function loadDirChildren({ detail, state, }: {
  detail: DirOpenDetail;
  state: FileTreeState;
}): void {
  const { path, childrenContainer, } = detail;
  if (state.loadedDirs.has(path,)) return;
  state.loadedDirs.add(path,);
  state.onDirExpanded?.(path,);

  const loadPromise = (async function load(): Promise<void> {
    try {
      const cached = state.prefetchCache.get(path,);
      const entries = cached !== undefined
        ? (state.prefetchCache.delete(path,), cached)
        : await (state.fetchDir?.(path,) ?? Promise.resolve([],));

      const children = createEntryElements({ parentPath: path, entries, recentPaths: state.recentPaths, },);
      childrenContainer.replaceChildren(...children,);

      if (state.fetchDir !== null) {
        void preloadChildren({ parentPath: path, entries, fetchDir: state.fetchDir, prefetchCache: state.prefetchCache, },);
      }
    }
    catch (error) {
      l.error(`failed to list ${path}: ${String(error,)}`,);
      state.loadedDirs.delete(path,);
    }
    state.loadPromises.delete(path,);
  })();

  state.loadPromises.set(path, loadPromise,);
}

/**
 * Maps server directory entries to web component elements.
 *
 * @param parentPath - absolute path of the parent directory
 *
 * @param entries - directory listing from the server
 *
 * @param recentPaths - current recent file paths for recency markers
 *
 * @returns array of `<tree-dir-entry>` and `<tree-file-entry>` elements
 */
export function createEntryElements({ parentPath, entries, recentPaths, }: {
  parentPath: string;
  entries: DirEntry[];
  recentPaths: string[];
}): HTMLElement[] {
  return entries.map(function createEntry(entry,) {
    const fullPath = childPath({ parentPath, name: entry.name, },);
    if (entry.isDirectory) return createTreeDirEntry({ path: fullPath, name: entry.name, },);
    return createTreeFileEntry({ path: fullPath, name: entry.name, recencyIndex: recentPaths.indexOf(fullPath,), },);
  },);
}
