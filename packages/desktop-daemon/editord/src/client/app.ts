/**
 * editord client entry point.
 *
 * Creates components, connects WebSocket, wires events, boots.
 */

// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './editor-pane.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './file-tree.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './search-overlay.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './hover-popup.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './completion-popup.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register custom elements
import './references-popup.ts';

import { $ as notNullishOrThrow, } from '@monochromatic-dev/module-es/not-nullish-or-throw';

import type { DirEntry, SearchResult, } from '../protocol.ts';
import { wireKeybindings, } from './app-keybindings.ts';
import { wireLsp, } from './app-lsp.ts';
import { restoreSession, wireSessionPersistence, } from './app-session.ts';
import { createRecentFiles, } from './recent-files.ts';
import type { CompletionPopup, } from './completion-popup.ts';
import type { EditorPane, } from './editor-pane.ts';
import type { FileTree, } from './file-tree.ts';
import type { HoverPopup, } from './hover-popup.ts';
import { getParserForPath, } from './languages.ts';
import { l, tagged, } from './log.ts';
import type { ReferenceSelectDetail, ReferencesPopup, } from './references-popup.ts';
import type { ResultSelectDetail, SearchOverlay, } from './search-overlay.ts';
import { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for the app. */
const appLog = tagged({ tag: 'app', l, },);

/** URL query parameters from the page URL. */
const params = new URLSearchParams(globalThis.location.search,);
/** Auth token passed by editord on startup. */
const token = notNullishOrThrow(params.get('token',),);
/** File path to open, passed as `?file=...` query parameter. */
const filePath = params.get('file',);
/** Port derived from the current page origin. */
const { port, } = globalThis.location;
/** WebSocket client instance. */
const ws = new EditorWsClient({ port, token, },);
/** App container element. */
const appElement = notNullishOrThrow(document.querySelector<HTMLElement>('#app',),);

/** File tree sidebar. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const fileTree = document.createElement('file-tree',) as FileTree;
/** Editor pane. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const editorPane = document.createElement('editor-pane',) as EditorPane;
/** Search overlay. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const searchOverlay = document.createElement('search-overlay',) as SearchOverlay;
/** Hover tooltip popup. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const hoverPopup = document.createElement('hover-popup',) as HoverPopup;
/** Completion dropdown popup. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const completionPopup = document.createElement('completion-popup',) as CompletionPopup;
/** References list popup. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via define
const referencesPopup = document.createElement('references-popup',) as ReferencesPopup;

fileTree.fetchDir = async function fetchDir(path: string,): Promise<DirEntry[]> {
  const r = await ws.request({ type: 'listDir', path, },);
  return 'entries' in r ? r.entries : [];
};
searchOverlay.getRootDir = function getScope(): string { return fileTree.selectedDir !== '' ? fileTree.selectedDir : ws.rootDir; };
searchOverlay.onSearch = async function handleSearch(query: string,): Promise<SearchResult[]> {
  const scope = fileTree.selectedDir !== '' ? fileTree.selectedDir : ws.rootDir;
  const r = await ws.request({ type: 'search', query, scope, },);
  return 'results' in r ? r.results : [];
};

appElement.append(fileTree, editorPane, searchOverlay, hoverPopup, completionPopup, referencesPopup,);

/** Path of the currently open file. */
let currentFilePath = filePath;

/**
 * Returns the current file path.
 *
 * @returns absolute path of the currently open file, or null if none is open
 */
function getCurrentFilePath(): string | null { return currentFilePath; }

/** Tracks recently opened files for recency markers in the file tree. */
const recentFiles = createRecentFiles();

/**
 * Records a file open in the recency tracker, refreshes all markers,
 * and expands ancestor directories to make the file visible in the tree.
 * Scroll anchoring in {@link FileTree.revealFiles} keeps the user's
 * current view stable during expansion.
 *
 * @param path - absolute file path that was opened
 */
function recordFileOpen(path: string,): void {
  recentFiles.push(path,);
  fileTree.updateRecency({ paths: recentFiles.paths, },);
  void fileTree.revealFiles({ paths: [path,], },);
}

/**
 * Loads a file from the server, scrolls to a line, and logs errors.
 *
 * @param path - absolute file path to open
 *
 * @param line - optional 1-based line number to scroll to after loading
 *
 * @param character - optional 0-based character offset within the line
 */
async function loadFileSafe(path: string, line?: number, character?: number,): Promise<void> {
  try {
    const r = await ws.request({ type: 'open', path, },);
    if ('content' in r) {
      editorPane.setParser(getParserForPath({ path, },),);
      editorPane.setText(String(r.content,),);
      document.title = `editord - ${path}`;
      if (line !== undefined) {
        editorPane.scrollToLine({ line, },);
        editorPane.restoreCursor({ line: line - 1, character: character ?? 0, },);
      }
    }
  }
  catch (error) { appLog.error(`failed to load: ${String(error,)}`,); }
}

fileTree.addEventListener('file-select', function handleFileSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from FileTree
  const { path, } = (event as CustomEvent<{ path: string }>).detail;
  currentFilePath = path;
  recordFileOpen(path,);
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path,);
    refreshInlayHints();
  })();
},);
searchOverlay.addEventListener('result-select', function handleResultSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from SearchOverlay
  const { path, line, } = (event as CustomEvent<ResultSelectDetail>).detail;
  currentFilePath = path;
  recordFileOpen(path,);
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path, line,);
    refreshInlayHints();
  })();
},);

referencesPopup.addEventListener('reference-select', function handleReferenceSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from ReferencesPopup
  const { path, line, character, } = (event as CustomEvent<ReferenceSelectDetail>).detail;
  currentFilePath = path;
  recordFileOpen(path,);
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path, line, character,);
    refreshInlayHints();
  })();
},);

/** LSP feature callbacks returned from wiring. */
const { formatDocument, requestCompletions, refreshInlayHints, gotoDefinitionAtCursor, } = wireLsp({ ws, editorPane, hoverPopup, completionPopup, referencesPopup, getCurrentFilePath, loadFileSafe, },);

/** Saves the current editor content to the server. */
async function saveCurrentFile(): Promise<void> {
  if (currentFilePath === null) return;
  try { await ws.request({ type: 'save', path: currentFilePath, content: editorPane.getText(), },); }
  catch (error) { appLog.error(`save failed: ${String(error,)}`,); }
}

//region Auto-save -- debounced save on every content change
/** Debounce interval for auto-save, in milliseconds. */
const AUTO_SAVE_DEBOUNCE_MS = 1_000;
{
  let autoSaveTimer = 0;
  editorPane.addEventListener('contentchange', function scheduleAutoSave() {
    clearTimeout(autoSaveTimer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    autoSaveTimer = globalThis.setTimeout(function autoSave() {
      void saveCurrentFile();
    }, AUTO_SAVE_DEBOUNCE_MS,) as unknown as number;
  },);
}
//endregion

wireKeybindings({
  saveCurrentFile: function save() { void saveCurrentFile(); },
  formatDocument: function format() { void formatDocument(); },
  gotoDefinition: gotoDefinitionAtCursor,
  deleteCurrentLine: editorPane.deleteCurrentLine.bind(editorPane,),
  requestCompletions,
  navigateToRecentFile: function navigateToRecent(index: number,) {
    const path = recentFiles.paths[index];
    if (path === undefined) return;
    currentFilePath = path;
    recentFiles.push(path,);
    fileTree.updateRecency({ paths: recentFiles.paths, },);
    void (async function revealLoadAndScroll(): Promise<void> {
      await fileTree.revealFiles({ paths: [path,], },);
      fileTree.scrollToFile({ path, },);
      await loadFileSafe(path,);
      refreshInlayHints();
    })();
  },
  completionPopup,
  referencesPopup,
  hoverPopup,
},);

await ws.ready;

wireSessionPersistence({ ws, editorPane, fileTree, searchOverlay, getCurrentFilePath, getRecentFiles: function getRecentFiles() { return recentFiles.paths; }, },);

/** Restored session state containing boot file path and saved recent files. */
const restored = await restoreSession({ ws, editorPane, fileTree, loadFileSafe, queryFilePath: filePath, },);
currentFilePath = restored.filePath;

//region Seed recent files from saved state and reveal in tree
recentFiles.paths.length = 0;
recentFiles.paths.push(...restored.recentFiles,);
if (currentFilePath !== null) recentFiles.push(currentFilePath,);
await fileTree.revealFiles({ paths: recentFiles.paths, },);
fileTree.updateRecency({ paths: recentFiles.paths, },);
//endregion

if (currentFilePath !== null) refreshInlayHints();
