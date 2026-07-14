/**
 * Session persistence wiring for the editord client.
 *
 * Installs save triggers (beforeunload, scroll, file switch, dir toggle)
 * that persist UI state to localStorage via debounced writes.
 */

import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  FileTreeHandle,
  GetCurrentFilePathFn,
  SearchOverlayHandle,
} from '../app/types.ts';
import { createDebouncedSave, } from './debounce.ts';
import type { SessionState, } from './state.ts';

/**
 * Installs save triggers that persist UI state on meaningful events.
 * Returns a `saveNow` function for synchronous use in `beforeunload`.
 *
 * @param ws - WebSocket client (provides fsId and rootDir)
 *
 * @param editorPane - editor component for scroll and cursor state
 *
 * @param fileTree - file tree component for expanded directories
 *
 * @param searchOverlay - search overlay (save on result selection)
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @param getRecentFiles - returns the recent files list
 *
 * @returns `saveNow` for immediate state persistence
 *
 * @example
 * ```ts
 * const result = wireSessionPersistence({ ws: ws, editorPane: editorPane, fileTree: fileTree, searchOverlay: searchOverlay, getCurrentFilePath: '/home/user/project/src/main.ts', getRecentFiles: [], });
 * ```
 */
export function wireSessionPersistence(
  {
    ws,
    editorPane,
    fileTree,
    searchOverlay,
    getCurrentFilePath,
    getRecentFiles,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly fileTree: FileTreeHandle;
    readonly searchOverlay: SearchOverlayHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly getRecentFiles: () => readonly string[];
  },
): { readonly saveNow: () => void; } {
  /**
   * Captures the current UI state for persistence.
   *
   * @returns snapshot of file path, expanded dirs, cursor, and scroll offset
   */
  function collectState(): SessionState {
    /**
     * Current cursor position; defaulted to `{0, 0}` below when no file is open.
     */
    const cursor = editorPane.getCursorPosition();
    return {
      filePath: getCurrentFilePath(),
      expandedDirs: fileTree.expandedDirs,
      cursor: cursor ?? {
        line: 0,
        character: 0,
      },
      scrollTop: editorPane.editorScrollTop,
      recentFiles: getRecentFiles(),
    };
  }

  /**
   * Debounced and immediate save functions scoped to this server identity.
   */
  const {
    debouncedSave,
    saveNow,
  } = createDebouncedSave({
    fsId: ws.fsId,
    rootDir: ws.rootDir,
    getState: collectState,
  },);

  /**
   * Save state synchronously on page unload (tab close, navigation, reload).
   */
  globalThis.addEventListener(
    'beforeunload',
    saveNow,
  );

  /**
   * Save state when the user switches files.
   */
  fileTree.addEventListener(
    'file-select',
    debouncedSave,
  );
  searchOverlay.addEventListener(
    'result-select',
    debouncedSave,
  );

  /**
   * Save state when the user scrolls the editor.
   */
  editorPane.addScrollListener(debouncedSave,);

  /**
   * Save state when a directory is expanded or collapsed.
   */
  fileTree.addEventListener(
    'toggle',
    debouncedSave,
    true,
  );

  return { saveNow, };
}
