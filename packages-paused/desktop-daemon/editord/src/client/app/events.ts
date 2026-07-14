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
import {
  l as rootLogger,
  tagged,
} from '../log.ts';
import type { ReferenceSelectDetail, } from '../references/references-popup.ts';
import type { ResultSelectDetail, } from '../search/search-overlay.ts';

import type {
  EditorWsClientHandle,
  FileTreeHandle,
  LoadFileFn,
  ReferencesPopupHandle,
  SearchOverlayHandle,
} from './types.ts';

/**
 * Tagged logger for the app events subsystem.
 */
const appLog = tagged({
  tag: 'app-events',
  l: rootLogger,
},);

/**
 * Mutable app state passed by reference from the main module.
 */
export type AppState = {
  /**
   * Path of the currently open file.
   */
  currentFilePath: string | null;
  /**
   * Kind of the currently open file.
   */
  currentFileKind: FileKind;
};

/**
 * Callback surface for current-file state owned by app.ts.
 */
export type CurrentFileStateAccess = {
  /**
   * Reads currently open file path without exposing mutable state.
   */
  readonly getCurrentFilePath: () => string | null;
  /**
   * Updates currently open file path without exposing mutable state.
   */
  readonly setCurrentFilePath: (path: string | null,) => void;
  /**
   * Reads currently open file kind after a load completes.
   */
  readonly getCurrentFileKind: () => FileKind;
};

/**
 * Loads a file and refreshes inlay hints when the file is a text file.
 *
 * @param currentFileState - callback surface for current file state
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
  currentFileState,
  loadFileSafe,
  refreshInlayHints,
  path,
  line,
  character,
}: {
  readonly currentFileState: Pick<CurrentFileStateAccess, 'getCurrentFileKind'>;
  readonly loadFileSafe: LoadFileFn;
  readonly refreshInlayHints: () => void;
  readonly path: string;
  readonly line?: number | undefined;
  readonly character?: number | undefined;
},): Promise<void> {
  await loadFileSafe({
    path,
    line,
    character,
  },);
  if (currentFileState.getCurrentFileKind()
    === 'text')
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
 * @param currentFileState - callback surface for current file state
 *
 * @param recordFileOpen - records file open and updates tree
 *
 * @param loadFileSafe - loads a file from the server
 *
 * @param refreshInlayHints - refreshes inlay hints for the current file
 *
 * @example
 * ```ts
 * wireSelectEvents({ fileTree: fileTree, searchOverlay: searchOverlay, referencesPopup: referencesPopup, currentFileState: currentFileState, recordFileOpen: recordFileOpen, loadFileSafe: loadFileSafe, refreshInlayHints: refreshInlayHints, });
 * ```
 */
export function wireSelectEvents(
  {
    fileTree,
    searchOverlay,
    referencesPopup,
    currentFileState,
    recordFileOpen,
    loadFileSafe,
    refreshInlayHints,
  }: {
    readonly fileTree: FileTreeHandle;
    readonly searchOverlay: SearchOverlayHandle;
    readonly referencesPopup: ReferencesPopupHandle;
    readonly currentFileState: CurrentFileStateAccess;
    readonly recordFileOpen: (path: string,) => void;
    readonly loadFileSafe: LoadFileFn;
    readonly refreshInlayHints: () => void;
  },
): void {
  fileTree.addEventListener(
    'file-select',
    function handleFileSelect(event,) {
      /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- CustomEvent from FileTree */
      /**
       * Custom-event detail destructured to read the selected file path.
       */
      const { path, } = (event as CustomEvent<{ readonly path: string; }>).detail;
      /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
      currentFileState.setCurrentFilePath(path,);
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        currentFileState,
        loadFileSafe,
        refreshInlayHints,
        path,
      },);
    },
  );
  searchOverlay.addEventListener(
    'result-select',
    function handleResultSelect(event,) {
      /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- CustomEvent from SearchOverlay */
      /**
       * Custom-event detail destructured to read the selected file path and line.
       */
      const {
        path,
        line,
      } = (event as CustomEvent<ResultSelectDetail>).detail;
      /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
      currentFileState.setCurrentFilePath(path,);
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        currentFileState,
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
      /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- CustomEvent from ReferencesPopup */
      /**
       * Custom-event detail destructured to read the navigation target.
       */
      const {
        path,
        line,
        character,
      } = (event as CustomEvent<ReferenceSelectDetail>).detail;
      /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
      currentFileState.setCurrentFilePath(path,);
      recordFileOpen(path,);
      void loadFileAndRefreshHints({
        currentFileState,
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
 * @param getCurrentFilePath - reads currently open file path
 *
 * @param loadFileSafe - loads a file from the server
 *
 * @example
 * ```ts
 * wireFileWatching({ ws: ws, fileTree: fileTree, getCurrentFilePath: getCurrentFilePath, loadFileSafe: loadFileSafe, });
 * ```
 */
export function wireFileWatching({
  ws,
  fileTree,
  getCurrentFilePath,
  loadFileSafe,
}: {
  readonly ws: EditorWsClientHandle;
  readonly fileTree: FileTreeHandle;
  readonly getCurrentFilePath: () => string | null;
  readonly loadFileSafe: LoadFileFn;
},): void {
  fileTree.onDirExpanded = function handleDirExpanded(path: string,): void {
    void ws.notify({
      type: 'watchDir',
      path,
    },);
  };
  ws.setFileChangedHandler(function handleFileChanged(
    {
      path,
      changeType,
    }: {
      readonly path: string;
      readonly changeType: FsChangeType;
      readonly isDirectory: boolean;
    },
  ): void {
    appLog.info(`file changed: ${path} (${changeType})`,);
    if (((changeType === 'modified') || (changeType === 'created'))
      && (path === getCurrentFilePath()))
    {
      void loadFileSafe({ path, },);
      if (changeType === 'modified')
        return;
    }
    if ((changeType === 'created') || (changeType === 'deleted')) {
      void fileTree.refreshDir({ path: path.slice(
        0,
        path.lastIndexOf('/',),
      ), },);
    }
  },);
}
