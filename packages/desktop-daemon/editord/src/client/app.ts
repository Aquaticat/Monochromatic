/**
 * editord client entry point.
 *
 * Boot sequence:
 * 1. Extract auth token from URL query string
 * 2. Connect WebSocket to editord server
 * 3. Render file tree sidebar and editor pane
 * 4. Open the file specified in the `file` query parameter (or a default)
 * 5. Listen for Ctrl+S to save, file tree clicks to open
 */

// oxlint-disable max-lines -- application entry point wiring file tree, editor, WS client, and keyboard shortcuts

// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register <editor-pane> custom element
import './editor-pane.ts';
// oxlint-disable-next-line import/no-unassigned-import -- side-effect: register <file-tree> custom element
import './file-tree.ts';

import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';

import type { DirEntry, } from '../protocol.ts';
import type { EditorPane, } from './editor-pane.ts';
import type { FileTree, } from './file-tree.ts';
import { getParserForPath, } from './languages.ts';
import { l, tagged, } from './log.ts';
import { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for the app entry point. */
const appLog = tagged({ tag: 'app', l, },);

//region Initialization

/** Extracts query parameters from the current page URL. */
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

//endregion Initialization

//region File tree setup

/** The file tree sidebar web component instance. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via customElements.define; createElement returns HTMLElement
const fileTree = document.createElement('file-tree',) as FileTree;

/**
 * Fetches directory contents from the server for the file tree.
 *
 * @param path - absolute directory path to list
 *
 * @returns directory entries
 */
fileTree.fetchDir = async function fetchDir(path: string,): Promise<DirEntry[]> {
  const response = await ws.request({ type: 'listDir', path, },);
  if ('entries' in response)
    return response.entries;

  return [];
};

//endregion File tree setup

//region Editor pane setup

/** The editor pane web component instance. */
// oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- custom element registered via customElements.define; createElement returns HTMLElement
const editorPane = document.createElement('editor-pane',) as EditorPane;

//endregion Editor pane setup

//region Layout

appElement.append(fileTree, editorPane,);

//endregion Layout

//region File loading

/** Path of the currently open file, or null when no file is open. */
let currentFilePath = filePath;

/**
 * Loads a file from the server and renders it in the editor.
 *
 * @param path - file path to open
 */
async function loadFile(path: string,): Promise<void> {
  const response = await ws.request({ type: 'open', path, },);
  if ('content' in response) {
    editorPane.setParser(getParserForPath({ path, },),);
    editorPane.setText(String(response.content,),);
    document.title = `editord - ${path}`;
  }
}

/**
 * Loads a file and logs errors without propagating them.
 * Suitable for fire-and-forget contexts like event handlers.
 *
 * @param path - file path to open
 */
async function loadFileSafe(path: string,): Promise<void> {
  try {
    await loadFile(path,);
  }
  catch (error) {
    appLog.error(`failed to load file: ${String(error,)}`,);
  }
}

//endregion File loading

//region File tree events

fileTree.addEventListener('file-select', function handleFileSelect(event,) {
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- file-select is always a CustomEvent dispatched by FileTree
  const { path, } = (event as CustomEvent<{ path: string }>).detail;
  currentFilePath = path;
  void loadFileSafe(path,);
},);

//endregion File tree events

//region Save handler

/**
 * Saves the current editor content to the server.
 * Logs errors without propagating them.
 */
async function saveCurrentFile(): Promise<void> {
  if (currentFilePath === null)
    return;

  try {
    const content = editorPane.getText();
    await ws.request({ type: 'save', path: currentFilePath, content, },);
  }
  catch (error) {
    appLog.error(`failed to save file: ${String(error,)}`,);
  }
}

//endregion Save handler

//region Keyboard shortcuts

document.addEventListener('keydown', function handleKeydown(event,) {
  // Ctrl+S / Cmd+S — save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    void saveCurrentFile();
  }
},);

//endregion Keyboard shortcuts

//region Boot

await ws.ready;
if (currentFilePath !== null) {
  await loadFile(currentFilePath,);
}
await fileTree.expandRoot(ws.rootDir,);

//endregion Boot
