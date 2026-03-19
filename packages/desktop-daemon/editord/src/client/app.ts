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
import type { FileTree, } from './file-tree.ts';
import { EditorWsClient, } from './ws-client.ts';

export {};

/** Extracts query parameters from the current page URL. */
const params = new URLSearchParams(window.location.search,);

/** Auth token passed by editord on startup. */
const token = params.get('token',);
if (token === null)
  throw new Error('missing token in URL query string',);

/** File path to open, passed as `?file=...` query parameter. */
const filePath = params.get('file',);

/** Port derived from the current page origin. */
const port = window.location.port;

/** WebSocket client instance. */
const ws = new EditorWsClient(port, token,);

/** App container element. */
const appElement = document.querySelector<HTMLElement>('#app',);
if (appElement === null)
  throw new Error('missing #app element',);

//region File tree setup

/** The file tree sidebar web component instance. */
const fileTree = document.createElement('file-tree',) as unknown as FileTree;

/**
 * Fetches directory contents from the server for the file tree.
 *
 * @param path - absolute directory path to list
 *
 * @returns directory entries
 */
fileTree.fetchDir = async function fetchDir(path: string,): Promise<{ name: string; isDirectory: boolean; }[]> {
  const response = await ws.request({ type: 'listDir', path, },);
  if ('entries' in response)
    return response.entries;

  return [];
};

//endregion File tree setup

//region Editor pane setup

/** The editor pane web component instance. */
const editorPane = document.createElement('editor-pane',);

//endregion Editor pane setup

//region Layout

appElement.append(fileTree, editorPane,);

//endregion Layout

//region File tree events

fileTree.addEventListener('file-select', function handleFileSelect(event,) {
  const { path, } = (event as CustomEvent<{ path: string; }>).detail;
  currentFilePath = path;
  void loadFile(path,);
},);

//endregion File tree events

//region File loading

/**
 * Loads a file from the server and renders it in the editor.
 *
 * @param path - file path to open
 */
async function loadFile(path: string,): Promise<void> {
  const response = await ws.request({ type: 'open', path, },);
  if ('content' in response) {
    editorPane.setText(response.content as string,);
    document.title = `editord - ${path}`;
  }
}

//endregion File loading

//region Save handler

/** Path of the currently open file, or null when no file is open. */
let currentFilePath = filePath;

/**
 * Saves the current editor content to the server.
 */
async function saveCurrentFile(): Promise<void> {
  if (currentFilePath === null)
    return;

  const content = editorPane.getText();
  await ws.request({ type: 'save', path: currentFilePath, content, },);
  console.log(`[editord] saved ${currentFilePath}`,);
}

//endregion Save handler

//region Keyboard shortcuts

document.addEventListener('keydown', function handleKeydown(event,) {
  // Ctrl+S / Cmd+S — save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveCurrentFile();
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
