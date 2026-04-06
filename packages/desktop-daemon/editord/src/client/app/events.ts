/**
 * Event handler wiring for the editord client.
 *
 * Connects file-select, result-select, reference-select events
 * and file-watching handlers to the app's state management.
 */

import type {
  FileKind,
  FsChangeType,
} from '../../../protocol.ts';
import type { FileTree, } from '../file-tree/file-tree.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import type {
  ReferenceSelectDetail,
  ReferencesPopup,
} from '../references/references-popup.ts';
import type {
  ResultSelectDetail,
  SearchOverlay,
} from '../search/search-overlay.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type { LoadFileFn, } from './types.ts';

/** Tagged logger for the app events subsystem. */
const appLog = tagged({
  tag: 'app-events',
  l: rootLogger,
},);

/** Mutable app state passed by reference from the main module. */
export type AppState = {
  /** Path of the currently open file. */
  currentFilePath: string | null;
  /** Kind of the currently open file. */
  currentFileKind: FileKind;
};

/**
 * Loads a file and refreshes inlay hints when the file is a text file.
 *
 * @param state - mutable app state
 *
 * @param loadFileSafe - loads a file from the server
 *
 * @param refreshInlayHints - refreshes inlay hints for the current file
 *
 * @param path - file path to load
 *
 * @param line - optional line to scroll to
 *
 * @param character - optional character offset within the line
 */
async function loadFileAndRefreshHints({
  state,
  loadFileSafe,
  refreshInlayHints,
  path,
  line,
  character,
}: {
  state: AppState;
  loadFileSafe: LoadFileFn;
  refreshInlayHints: () => void;
  path: string;
  line?: number | undefined;
  character?: number | undefined;
},): Promise<void> {
  await loadFileSafe({
    path,
    line,
    character,
  },);
  if (state.currentFileKind === 'text')
    refreshInlayHints();
}

/**
 * Wires file-select, result-select, and reference-select event handlers.
 *
 * @param fileTree - file tree component
 *
 * @param searchOverlay - search overlay component
 *
 * @param referencesPopup - references popup component
 *
 * @param state - mutable app state
 *
 * @param recordFileOpen - records file open and updates tree
 *
 * @param loadFileSafe - loads a file from the server
 *
 * @param refreshInlayHints - refreshes inlay hints for the current file
 *
 * @example
 * ```ts
 * wireSelectEvents({ fileTree: fileTree, searchOverlay: searchOverlay, referencesPopup: referencesPopup, state: sessionState, recordFileOpen: recordFileOpen, loadFileSafe: loadFileSafe, refreshInlayHints: refreshInlayHints, });
 * ```
 */
export function wireSelectEvents(
  {
    fileTree,
    searchOverlay,
    referencesPopup,
    state,
    recordFileOpen,
    loadFileSafe,
    refreshInlayHints,
  }: {
    fileTree: FileTree;
    searchOverlay: SearchOverlay;
    referencesPopup: ReferencesPopup;
    state: AppState;
    recordFileOpen: (path: string,) => void;
    loadFileSafe: LoadFileFn;
    refreshInlayHints: () => void;
  },
): void {
  fileTree.addEventListener(
    'file-select',
    function handleFileSelect(event,) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from FileTree
      const { path, } = (event as CustomEvent<{ path: string; }>).detail;
      state.currentFilePath = path;
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        state,
        loadFileSafe,
        refreshInlayHints,
        path,
      },);
    },
  );
  searchOverlay.addEventListener(
    'result-select',
    function handleResultSelect(event,) {
      const {
        path,
        line,
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from SearchOverlay
      } = (event as CustomEvent<ResultSelectDetail>).detail;
      state.currentFilePath = path;
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        state,
        loadFileSafe,
        refreshInlayHints,
        path,
        line,
      },);
    },
  );
  referencesPopup.addEventListener(
    'reference-select',
    function handleReferenceSelect(event,) {
      const {
        path,
        line,
        character,
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from ReferencesPopup
      } = (event as CustomEvent<ReferenceSelectDetail>).detail;
      state.currentFilePath = path;
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        state,
        loadFileSafe,
        refreshInlayHints,
        path,
        line,
        character,
      },);
    },
  );
}

/**
 * Wires file-watching event handlers.
 *
 * @param ws - WebSocket client
 *
 * @param fileTree - file tree component
 *
 * @param state - mutable app state
 *
 * @param loadFileSafe - loads a file from the server
 *
 * @example
 * ```ts
 * wireFileWatching({ ws: ws, fileTree: fileTree, state: sessionState, loadFileSafe: loadFileSafe, });
 * ```
 */
export function wireFileWatching({
  ws,
  fileTree,
  state,
  loadFileSafe,
}: {
  ws: EditorWsClient;
  fileTree: FileTree;
  state: AppState;
  loadFileSafe: LoadFileFn;
},): void {
  fileTree.onDirExpanded = function handleDirExpanded(path: string,): void {
    void ws.notify({
      type: 'watchDir',
      path,
    },);
  };
  ws.onFileChanged = function handleFileChanged(
    {
      path,
      changeType,
    }: {
      path: string;
      changeType: FsChangeType;
      isDirectory: boolean;
    },
  ): void {
    appLog.info(`file changed: ${path} (${changeType})`,);
    if ((changeType === 'modified' || changeType === 'created')
      && path === state.currentFilePath)
    {
      void loadFileSafe({ path, },);
      if (changeType === 'modified')
        return;
    }
    if (changeType === 'created' || changeType === 'deleted') {
      void fileTree.refreshDir({ path: path.slice(
        0,
        path.lastIndexOf('/',),
      ), },);
    }
  };
}
