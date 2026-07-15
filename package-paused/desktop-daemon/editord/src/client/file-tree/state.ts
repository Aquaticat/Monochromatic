/**
 * Shared state type for the file tree component.
 *
 * Extracted to its own module to avoid circular imports
 * between `file-tree.ts` and modules that consume the state.
 */

import type { DirEntry, } from '../../../protocol.ts';

/**
 * Internal mutable state of the file tree, shared between
 * the `<file-tree>` container and its helper modules.
 *
 * Does not include UI-only fields (context menu, event dispatch)
 * which live on the `FileTree` class directly.
 */
export type FileTreeState = {
  /**
   * Callback to fetch directory contents.
   */
  fetchDir: ((path: string,) => Promise<readonly DirEntry[]>) | null;
  /**
   * Callback when a directory is expanded for the first time.
   */
  onDirExpanded: ((path: string,) => void) | null;
  /**
   * Cache of preloaded directory children.
   */
  prefetchCache: Map<string, readonly DirEntry[]>;
  /**
   * Tracks directories whose contents have been loaded.
   */
  loadedDirs: Set<string>;
  /**
   * In-flight load promises keyed by directory path.
   */
  loadPromises: Map<string, Promise<void>>;
  /**
   * Current recent file paths (index 0 = most recent).
   */
  recentPaths: readonly string[];
};
