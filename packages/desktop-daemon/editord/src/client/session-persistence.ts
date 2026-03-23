/**
 * Session persistence wiring for the editord client.
 *
 * Installs save triggers (beforeunload, scroll, file switch, dir toggle)
 * that persist UI state to localStorage via debounced writes.
 */

import type { EditorPane, } from './editor-pane.ts';
import type { FileTree, } from './file-tree.ts';
import { getCursorPosition, } from './position.ts';
import type { SearchOverlay, } from './search-overlay.ts';
import { createDebouncedSave, type SessionState, } from './session-state.ts';
import type { EditorWsClient, } from './ws-client.ts';

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
 */
export function wireSessionPersistence({ ws, editorPane, fileTree, searchOverlay, getCurrentFilePath, getRecentFiles, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  fileTree: FileTree;
  searchOverlay: SearchOverlay;
  getCurrentFilePath: () => string | null;
  getRecentFiles: () => string[];
}): { saveNow: () => void } {
  /**
   * Captures the current UI state for persistence.
   *
   * @returns snapshot of file path, expanded dirs, cursor, and scroll offset
   */
  function collectState(): SessionState {
    const editorElement = editorPane.getEditorElement();
    const selection = document.getSelection();
    const cursor = editorElement !== null && selection !== null
      ? getCursorPosition({ editor: editorElement, selection, },)
      : null;

    return {
      filePath: getCurrentFilePath(),
      expandedDirs: fileTree.expandedDirs,
      cursor: cursor ?? { line: 0, character: 0, },
      scrollTop: editorElement?.scrollTop ?? 0,
      recentFiles: getRecentFiles(),
    };
  }

  /** Debounced and immediate save functions scoped to this server identity. */
  const { debouncedSave, saveNow, } = createDebouncedSave({
    fsId: ws.fsId,
    rootDir: ws.rootDir,
    getState: collectState,
  },);

  /** Save state synchronously on page unload (tab close, navigation, reload). */
  globalThis.addEventListener('beforeunload', saveNow,);

  /** Save state when the user switches files. */
  fileTree.addEventListener('file-select', debouncedSave,);
  searchOverlay.addEventListener('result-select', debouncedSave,);

  /** Save state when the user scrolls the editor. */
  editorPane.getEditorElement()?.addEventListener('scroll', debouncedSave,);

  /** Save state when a directory is expanded or collapsed. */
  fileTree.addEventListener('toggle', debouncedSave, true,);

  return { saveNow, };
}
