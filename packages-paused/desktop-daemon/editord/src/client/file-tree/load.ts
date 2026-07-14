/**
 * Directory loading handler for the file tree.
 *
 * Processes `dir-open` events by rendering cached entries immediately
 * (when available) and always verifying with a fresh server fetch.
 * This avoids stale prefetch data when files are created between
 * the parent directory expansion and subdirectory expansion.
 */

import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import {
  createTreeDirEntry,
  type DirOpenDetail,
} from './dir-entry.ts';
import {
  buildRecencyIndex,
  childPath,
  preloadChildren,
} from './entries.ts';
import { createTreeFileEntry, } from './file-entry.ts';
import type { FileTreeState, } from './state.ts';

import type { DirEntry, } from '../../../protocol.ts';

/**
 * Tagged logger for the directory loading subsystem.
 */
const l = tagged({
  tag: 'file-tree-load',
  l: rootLogger,
},);

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
 *
 * @example
 * ```ts
 * loadDirChildren({ detail: event.detail, state: sessionState, });
 * ```
 */
export function loadDirChildren({
  detail,
  state,
}: {
  readonly detail: DirOpenDetail;
  readonly state: FileTreeState;
},): void {
  /**
   * Destructured up-front so the closure below references stable bindings, not `detail.x` reads.
   */
  const {
    path,
    childrenContainer,
  } = detail;
  if (state.loadedDirs
    .has(path,))
    return;
  state.loadedDirs
    .add(path,);
  state.onDirExpanded?.(path,);

  /**
   * Tracked in `loadPromises` so concurrent expansions can coalesce.
   */
  const loadPromise = (async function load(): Promise<void> {
    try {
      /**
       * Pulled out of the prefetch cache; rendered immediately for perceived responsiveness.
       */
      const cached = state.prefetchCache
        .get(path,);
      state.prefetchCache
        .delete(path,);

      // Render cached entries immediately for responsiveness
      if (cached !== undefined) {
        childrenContainer.replaceChildren(
          ...createEntryElements({
            parentPath: path,
            entries: cached,
            recentPaths: state
              .recentPaths,
          },),
        );
      }

      // Always verify with a fresh fetch: prefetch cache can be stale
      // when files are created after the parent directory was expanded
      /**
       * Fresh listing from the server; replaces the cached render below.
       */
      const entries = await (state.fetchDir?.(path,)
        ?? Promise
        .resolve([],));

      /**
       * Authoritative DOM children built from the fresh listing.
       */
      const children = createEntryElements({
        parentPath: path,
        entries,
        recentPaths: state
          .recentPaths,
      },);
      childrenContainer.replaceChildren(...children,);

      if (state.fetchDir
        !== null) {
        void preloadChildren({
          parentPath: path,
          entries,
          fetchDir: state.fetchDir,
          prefetchCache: state.prefetchCache,
        },);
      }
    }
    catch (error) {
      l.error(`failed to list ${path}: ${String(error,)}`,);
      state.loadedDirs
        .delete(path,);
    }
    state.loadPromises
      .delete(path,);
  })();

  state.loadPromises
    .set(
    path,
    loadPromise,
  );
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
 *
 * @example
 * ```ts
 * const result = createEntryElements({ parentPath: '/home/user/project/src/main.ts', entries: [], recentPaths: '/home/user/project/src/main.ts', });
 * ```
 */
export function createEntryElements({
  parentPath,
  entries,
  recentPaths,
}: {
  readonly parentPath: string;
  readonly entries: readonly DirEntry[];
  readonly recentPaths: readonly string[];
},): HTMLElement[] {
  /**
   * Built once outside the map so per-entry recency lookups are O(1).
   */
  const recencyIndex = buildRecencyIndex({ recentPaths, },);

  return entries.map(function createEntry(entry,) {
    /**
     * Joined parent + entry name; reused for path-based attributes below.
     */
    const fullPath = childPath({
      parentPath,
      name: entry.name,
    },);
    if (entry.isDirectory) {
      return createTreeDirEntry({
        path: fullPath,
        name: entry.name,
      },);
    }
    return createTreeFileEntry({
      path: fullPath,
      name: entry.name,
      recencyIndex: recencyIndex.get(fullPath,)
        ?? (-1),
    },);
  },);
}
