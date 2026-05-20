/**
 * Session bootstrap for the editord client.
 *
 * Restores session state, applies it to the app, and triggers
 * initial inlay hints. Extracted from app.ts to stay under max-lines.
 */

import type { RecentFiles, } from '../recent-files.ts';
import type { AppState, } from './events.ts';

import {
  restoreSession,
  wireSessionPersistence,
} from './session.ts';
import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  FileTreeHandle,
  LoadFileFn,
  SearchOverlayHandle,
} from './types.ts';

/**
 * Performs session restore and initial state setup after WebSocket is ready.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param fileTree - file tree component
 *
 * @param searchOverlay - search overlay component
 *
 * @param state - mutable app state
 *
 * @param recentFiles - recent files tracker
 *
 * @param loadFileSafe - file loading function
 *
 * @param refreshInlayHints - triggers inlay hint refresh
 *
 * @param queryFilePath - file path from URL query parameter
 *
 * @example
 * ```ts
 * await bootSession({ ws: ws, editorPane: editorPane, fileTree: fileTree, searchOverlay: searchOverlay, state: sessionState, recentFiles: recentFiles, loadFileSafe: function handleLoadFileSafe() { l.info("done"); }, refreshInlayHints: refreshInlayHints, queryFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function bootSession(
  {
    ws,
    editorPane,
    fileTree,
    searchOverlay,
    state,
    recentFiles,
    loadFileSafe,
    refreshInlayHints,
    queryFilePath,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly fileTree: FileTreeHandle;
    readonly searchOverlay: SearchOverlayHandle;
    readonly state: AppState;
    readonly recentFiles: RecentFiles;
    readonly loadFileSafe: LoadFileFn;
    readonly refreshInlayHints: () => void;
    readonly queryFilePath: string | null;
  },
): Promise<void> {
  await ws.ready;
  wireSessionPersistence({
    ws,
    editorPane,
    fileTree,
    searchOverlay,
    getCurrentFilePath: function get() {
      return state.currentFilePath;
    },
    getRecentFiles: function get() {
      return recentFiles.paths;
    },
  },);
  /** Session state restored from the server: file path to reopen plus the recent files list. */
  const restored = await restoreSession({
    ws,
    editorPane,
    fileTree,
    loadFileSafe,
    queryFilePath,
  },);
  state.currentFilePath = restored.filePath;
  recentFiles.paths.length = 0;
  recentFiles.paths.push(...restored.recentFiles,);
  if (state.currentFilePath !== null)
    recentFiles.push(state.currentFilePath,);
  await fileTree.revealFiles({ paths: recentFiles.paths, },);
  fileTree.updateRecency({ paths: recentFiles.paths, },);
  if ((state.currentFilePath !== null) && (state.currentFileKind === 'text'))
    refreshInlayHints();
}
