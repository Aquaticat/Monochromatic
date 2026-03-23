/**
 * Session restore for the editord client.
 *
 * Restores saved state (open file, cursor, scroll, expanded dirs)
 * on boot. Session persistence wiring lives in session-persistence.ts.
 */

import type { EditorPane, } from './editor-pane.ts';
import type { FileTree, } from './file-tree.ts';
import { restoreSessionState, } from './session-state.ts';
import type { EditorWsClient, } from './ws-client.ts';

export { wireSessionPersistence, } from './session-persistence.ts';

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
  loadFileSafe: (opts: { path: string; line?: number | undefined; character?: number | undefined }) => Promise<void>;
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
    await loadFileSafe({ path: bootFilePath, },);
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
