/**
 * Session state wiring for the editord client.
 *
 * Sets up save triggers (beforeunload, scroll, file switch, dir toggle)
 * and restores saved state (open file, cursor, scroll, expanded dirs)
 * on boot. Extracted from app.ts to keep the entry point concise.
 */

import type { EditorPane, } from './editor-pane.ts';
import type { FileTree, } from './file-tree.ts';
import { getCursorPosition, } from './position.ts';
import type { SearchOverlay, } from './search-overlay.ts';
import { createDebouncedSave, restoreSessionState, type SessionState, } from './session-state.ts';
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

/**
 * Restores the previous session state from localStorage and applies it.
 * Opens the saved file, restores expanded directories, cursor, and scroll.
 *
 * @param ws - WebSocket client (provides fsId and rootDir)
 *
 * @param editorPane - editor component to restore cursor and scroll
 *
 * @param fileTree - file tree to restore expansion state
 *
 * @param loadFileSafe - file loading function
 *
 * @param queryFilePath - file path from URL query param (takes precedence)
 *
 * @returns boot file path (or null) and saved recent files list
 */
export async function restoreSession({ ws, editorPane, fileTree, loadFileSafe, queryFilePath, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  fileTree: FileTree;
  loadFileSafe: (path: string, line?: number, character?: number,) => Promise<void>;
  queryFilePath: string | null;
}): Promise<{ filePath: string | null; recentFiles: string[] }> {
  /** Saved session state from a previous visit, if any. */
  const saved = restoreSessionState({ fsId: ws.fsId, rootDir: ws.rootDir, },);

  /**
   * File to open on boot: query param takes precedence (explicit navigation),
   * then saved state (session restore), then nothing.
   */
  const bootFilePath = queryFilePath ?? saved?.filePath ?? null;

  if (bootFilePath !== null) {
    await loadFileSafe(bootFilePath,);
  }

  await fileTree.expandRoot(ws.rootDir,);

  /** Restore expanded directories from saved state after the root has been rendered. */
  if (saved !== null && saved.expandedDirs.length > 0) {
    await fileTree.restoreExpansion({ dirs: saved.expandedDirs, },);
  }

  /** Restore cursor and scroll position after file and tree are loaded. */
  if (saved !== null && bootFilePath !== null && bootFilePath === saved.filePath) {
    editorPane.restoreCursor(saved.cursor,);
    const editorEl = editorPane.getEditorElement();
    if (editorEl !== null) editorEl.scrollTop = saved.scrollTop;
  }

  return { filePath: bootFilePath, recentFiles: saved?.recentFiles ?? [], };
}
