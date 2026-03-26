/**
 * Session bootstrap for the editord client.
 *
 * Restores session state, applies it to the app, and triggers
 * initial inlay hints. Extracted from app.ts to stay under max-lines.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import type { FileTree, } from '../file-tree/file-tree.ts';
import type { RecentFiles, } from '../recent-files.ts';
import type { SearchOverlay, } from '../search/search-overlay.ts';
import type { EditorWsClient, } from '../ws/client.ts';
import type { AppState, } from './events.ts';

import type { LoadFileFn, } from './types.ts';
import {
  restoreSession,
  wireSessionPersistence,
} from './session.ts';

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
      ws: EditorWsClient;
      editorPane: EditorPane;
      fileTree: FileTree;
      searchOverlay: SearchOverlay;
      state: AppState;
      recentFiles: RecentFiles;
      loadFileSafe: LoadFileFn;
      refreshInlayHints: () => void;
      queryFilePath: string | null;
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
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- currentFileKind is mutated by loadFileSafe which runs during restoreSession above
  if (state.currentFilePath !== null && state.currentFileKind === 'text')
    refreshInlayHints();
}
