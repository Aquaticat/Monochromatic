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

/**
 * Loads a file from the server, scrolls to a line, and logs errors.
 *
 * @param path - absolute file path to open
 *
 * @param line - optional 1-based line number to scroll to after loading
 */
async function loadFileSafe(path: string, line?: number,): Promise<void> {
  try {
    const r = await ws.request({ type: 'open', path, },);
    if ('content' in r) {
      editorPane.setParser(getParserForPath({ path, },),);
      editorPane.setText(String(r.content,),);
      document.title = `editord - ${path}`;
      if (line !== undefined) editorPane.scrollToLine({ line, },);
    }
  }
  catch (error) { appLog.error(`failed to load: ${String(error,)}`,); }
}

fileTree.addEventListener('file-select', function handleFileSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from FileTree
  const { path, } = (event as CustomEvent<{ path: string }>).detail;
  currentFilePath = path;
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path,);
    refreshInlayHints();
  })();
},);
searchOverlay.addEventListener('result-select', function handleResultSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from SearchOverlay
  const { path, line, } = (event as CustomEvent<ResultSelectDetail>).detail;
  currentFilePath = path;
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path, line,);
    refreshInlayHints();
  })();
},);

referencesPopup.addEventListener('reference-select', function handleReferenceSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- CustomEvent from ReferencesPopup
  const { path, line, } = (event as CustomEvent<ReferenceSelectDetail>).detail;
  currentFilePath = path;
  void (async function loadAndRefresh(): Promise<void> {
    await loadFileSafe(path, line,);
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

wireKeybindings({
  saveCurrentFile: function save() { void saveCurrentFile(); },
  formatDocument: function format() { void formatDocument(); },
  gotoDefinition: gotoDefinitionAtCursor,
  requestCompletions,
  completionPopup,
  referencesPopup,
  hoverPopup,
},);

await ws.ready;

wireSessionPersistence({ ws, editorPane, fileTree, searchOverlay, getCurrentFilePath, },);

currentFilePath = await restoreSession({ ws, editorPane, fileTree, loadFileSafe, queryFilePath: filePath, },);
if (currentFilePath !== null) refreshInlayHints();
