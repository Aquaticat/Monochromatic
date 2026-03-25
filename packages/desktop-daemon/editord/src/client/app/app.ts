/**
 * editord client entry point.
 *
 * Creates components, connects WebSocket, wires events, boots.
 */

// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../binary-viewer/binary-viewer.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../editor/editor-pane.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../file-tree/file-tree.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../search/search-overlay.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../hover/hover-popup.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../completion/completion-popup.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import '../references/references-popup.ts';

import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { createDebounced, } from '../debounce.ts';
import { AUTO_SAVE_DEBOUNCE_MS, } from '../timing.ts';

import type {
  DirEntry,
  FileKind,
  SearchResult,
} from '../../../protocol.ts';
import type { BinaryViewer, } from '../binary-viewer/binary-viewer.ts';
import type { CompletionPopup, } from '../completion/completion-popup.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import type {
  ContextAction,
  FileTree,
} from '../file-tree/file-tree.ts';
import type { HoverPopup, } from '../hover/hover-popup.ts';
import {
  l,
  tagged,
} from '../log.ts';
import { createRecentFiles, } from '../recent-files.ts';
import type { ReferencesPopup, } from '../references/references-popup.ts';
import type { SearchOverlay, } from '../search/search-overlay.ts';
import { showFixedToast, } from '../toast/toast.ts';
import { EditorWsClient, } from '../ws/client.ts';
import { bootSession, } from './boot.ts';
import { dispatchFsAction, } from './context-actions.ts';
import {
  type AppState,
  wireFileWatching,
  wireSelectEvents,
} from './events.ts';
import { loadFile, } from './file-loader.ts';
import { wireFullscreen, } from './fullscreen.ts';
import { wireKeybindings, } from './keybindings.ts';
import { wireLsp, } from './lsp.ts';

/** Tagged logger for the app. */
const appLog = tagged({
  tag: 'app',
  l,
},);
/** URL query parameters from the page URL. */
const params = new URLSearchParams(globalThis.location.search,);
/** Auth token passed by editord on startup. */
const token = notNullishOrThrow(params.get('token',),);
/** File path to open, passed as `?file=...` query parameter. */
const filePath = params.get('file',);
/** Port derived from the current page origin. */
const { port, } = globalThis.location;
/** WebSocket client instance. */
const ws = new EditorWsClient({
  port,
  token,
},);
/** App container element. */
const appElement = notNullishOrThrow(document.querySelector<HTMLElement>('#app',),);

// oxlint-disable typescript-eslint/no-unsafe-type-assertion -- custom elements registered via define
/** File tree sidebar component. */
const fileTree = document.createElement('file-tree',) as FileTree;
/** Contenteditable text editor component. */
const editorPane = document.createElement('editor-pane',) as EditorPane;
/** Modal search dialog component. */
const searchOverlay = document.createElement('search-overlay',) as SearchOverlay;
/** Hover tooltip component. */
const hoverPopup = document.createElement('hover-popup',) as HoverPopup;
/** Autocomplete popup component. */
const completionPopup = document.createElement('completion-popup',) as CompletionPopup;
/** References popup component. */
const referencesPopup = document.createElement('references-popup',) as ReferencesPopup;
/** Binary/media file viewer component. */
const binaryViewer = document.createElement('binary-viewer',) as BinaryViewer;
// oxlint-enable typescript-eslint/no-unsafe-type-assertion

fileTree.fetchDir = async function fetchDir(path: string,): Promise<DirEntry[]> {
  const r = await ws.request({
    type: 'listDir',
    path,
  },);
  return 'entries' in r ? r.entries : [];
};
fileTree.onContextAction = function handleContextAction(action: ContextAction,): void {
  void (async function dispatch(): Promise<void> {
    try {
      await dispatchFsAction({
        action,
        ws,
      },);
    }
    catch (error) {
      showFixedToast({ message: `Action failed: ${String(error,)}`, },);
    }
  })();
};
searchOverlay.getRootDir = function getScope(): string {
  return fileTree.selectedDir !== '' ? fileTree.selectedDir : ws.rootDir;
};
searchOverlay.onSearch = async function handleSearch(
  query: string,
): Promise<SearchResult[]> {
  const scope = fileTree.selectedDir !== '' ? fileTree.selectedDir : ws.rootDir;
  const r = await ws.request({
    type: 'search',
    query,
    scope,
  },);
  return 'results' in r ? r.results : [];
};

appElement.append(
  fileTree,
  editorPane,
  binaryViewer,
  searchOverlay,
  hoverPopup,
  completionPopup,
  referencesPopup,
);
wireFullscreen({ appElement, },);

/** Mutable app state shared with event handlers. */
const state: AppState = {
  currentFilePath: filePath,
  currentFileKind: 'text',
};

/** Tracks recently opened files for recency markers in the file tree. */
const recentFiles = createRecentFiles();

/**
 * Records a file open in the recency tracker and reveals the file in the tree.
 *
 * @param path - absolute file path that was opened
 */
function recordFileOpen(path: string,): void {
  recentFiles.push(path,);
  fileTree.updateRecency({ paths: recentFiles.paths, },);
  void fileTree.revealFiles({ paths: [path,], },);
}

/** Loads a file and updates the current file state. */
async function loadFileSafe(
  {
    path,
    line,
    character,
  }: {
    path: string;
    line?: number | undefined;
    character?: number | undefined
  },
): Promise<void> {
  const kind = await loadFile({
    ws,
    editorPane,
    binaryViewer,
    token,
    path,
    line,
    character,
  },);
  if (kind !== null)
    state.currentFileKind = kind;
}

/** LSP feature callbacks returned from wiring. */
const {
  formatDocument,
  requestCompletions,
  refreshInlayHints,
  gotoDefinitionAtCursor,
  expandSelection,
  shrinkSelection,
} = wireLsp({
    ws,
    editorPane,
    hoverPopup,
    completionPopup,
    referencesPopup,
    getCurrentFilePath: function get() {
      return state.currentFilePath;
    },
    loadFileSafe,
  },);

wireSelectEvents({
  fileTree,
  searchOverlay,
  referencesPopup,
  state,
  recordFileOpen,
  loadFileSafe,
  refreshInlayHints,
},);

/** Saves the current editor content to the server. Skips non-text files. */
async function saveCurrentFile(): Promise<void> {
  if (state.currentFilePath === null || state.currentFileKind !== 'text')
    return;
  try {
    await ws.request({
      type: 'save',
      path: state.currentFilePath,
      content: editorPane
      .getText(),
    },);
  }
  catch (error) {
    appLog.error(`save failed: ${String(error,)}`,);
  }
}

editorPane.addEventListener(
  'contentchange',
  createDebounced({ fn: function autoSave() {
  void saveCurrentFile();
}, delayMs: AUTO_SAVE_DEBOUNCE_MS, },),
);

wireKeybindings({
  saveCurrentFile: function save() {
    void saveCurrentFile();
  },
  formatDocument: function format() {
    void formatDocument();
  },
  gotoDefinition: gotoDefinitionAtCursor,
  deleteCurrentLine: editorPane.deleteCurrentLine.bind(editorPane,),
  selectAndCopyCurrentLine: editorPane.selectAndCopyCurrentLine.bind(editorPane,),
  indentLines: editorPane.indentLines.bind(editorPane,),
  unindentLines: editorPane.unindentLines.bind(editorPane,),
  duplicateLineDown: editorPane.duplicateLineDown.bind(editorPane,),
  swapLineDown: editorPane.swapLineDown.bind(editorPane,),
  swapLineUp: editorPane.swapLineUp.bind(editorPane,),
  openTerminalAtCurrentFile: function openTerminal() {
    const dir = state.currentFilePath !== null
      ? state.currentFilePath.slice(
        0,
        state.currentFilePath.lastIndexOf('/',),
      )
      : ws.rootDir;
    void ws.request({
      type: 'openInTerminal',
      path: dir,
    },);
  },
  requestCompletions,
  expandSelection,
  shrinkSelection,
  navigateToRecentFile: function navigateToRecent(index: number,) {
    const path = recentFiles.paths[index];
    if (path === undefined)
      return;
    state.currentFilePath = path;
    recentFiles.push(path,);
    fileTree.updateRecency({ paths: recentFiles.paths, },);
    void (async function revealLoadAndScroll(): Promise<void> {
      await fileTree.revealFiles({ paths: [path,], },);
      fileTree.scrollToFile({ path, },);
      await loadFileSafe({ path, },);
      if (state.currentFileKind === 'text')
        refreshInlayHints();
    })();
  },
  completionPopup,
  referencesPopup,
  hoverPopup,
},);

wireFileWatching({
  ws,
  fileTree,
  state,
  loadFileSafe,
},);

await bootSession({
  ws,
  editorPane,
  fileTree,
  searchOverlay,
  state,
  recentFiles,
  loadFileSafe,
  refreshInlayHints,
  queryFilePath: filePath,
},);
