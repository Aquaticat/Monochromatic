/**
 * LSP feature coordinator for the editord client.
 *
 * Wires content sync, diagnostics, hover, completions, formatting,
 * go-to-definition, references, and inlay hints by delegating to focused modules.
 */

import { wireGotoDefinition, formatDocument, doGotoDefinition, } from './app-lsp-actions.ts';
import { requestCompletions, wireCompletionTrigger, } from './app-lsp-completions.ts';
import { wireHover, } from './app-lsp-hover.ts';
import { wireInlayHints, } from './app-lsp-inlay.ts';
import type { CompletionPopup, } from './completion-popup.ts';
import type { EditorPane, } from './editor-pane.ts';
import type { HoverPopup, } from './hover-popup.ts';
import { l, tagged, } from './log.ts';
import type { ReferenceLocation, ReferencesPopup, } from './references-popup.ts';
import { showCursorToast, } from './toast.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for LSP coordinator. */
const lspLog = tagged({ tag: 'lsp', l, },);

/** Debounce delay for content sync to LSP servers (milliseconds). */
const CONTENT_SYNC_DEBOUNCE_MS = 500;

/**
 * Wires all LSP features onto the editor components.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param hoverPopup - hover tooltip popup
 *
 * @param completionPopup - completion dropdown popup
 *
 * @param referencesPopup - references list popup
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param loadFileSafe - loads a file, optionally scrolling to a line
 *
 * @returns callbacks for formatting, completions, go-to-definition, and inlay hint refresh
 */
export function wireLsp({ ws, editorPane, hoverPopup, completionPopup, referencesPopup, getCurrentFilePath, loadFileSafe, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  hoverPopup: HoverPopup;
  completionPopup: CompletionPopup;
  referencesPopup: ReferencesPopup;
  getCurrentFilePath: () => string | null;
  loadFileSafe: (path: string, line?: number,) => Promise<void>;
}): { formatDocument: () => Promise<void>; requestCompletions: () => void; refreshInlayHints: () => void; gotoDefinitionAtCursor: () => void } {
  /**
   * Returns the contenteditable container.
   *
   * @returns editor element, or null before connected
   */
  function getEditorElement(): HTMLElement | null { return editorPane.getEditorElement(); }

  wireContentSync({ ws, editorPane, getCurrentFilePath, },);
  wireDiagnostics({ ws, editorPane, getCurrentFilePath, },);
  wireHover({ ws, editorPane, hoverPopup, getEditorElement, referencesPopup, getCurrentFilePath, },);
  wireCompletionTrigger({
    editorPane,
    triggerCompletions: function trigger() {
      void requestCompletions({ ws, completionPopup, getEditorElement, getCurrentFilePath, },);
    },
  },);
  wireGotoDefinition({ ws, editorPane, getEditorElement, getCurrentFilePath, loadFileSafe, },);

  const inlayState = wireInlayHints({ ws, editorPane, getCurrentFilePath, },);

  return {
    formatDocument: function format(): Promise<void> {
      return formatDocument({ ws, editorPane, getCurrentFilePath, },);
    },
    requestCompletions: function completions(): void {
      void requestCompletions({ ws, completionPopup, getEditorElement, getCurrentFilePath, },);
    },
    refreshInlayHints: inlayState.refresh,
    gotoDefinitionAtCursor: function gotoDefAtCursor(): void {
      hoverPopup.hide();
      const pos = editorPane.getCursorPosition();
      const rect = editorPane.getCursorRect();
      if (pos === null || rect === null) {
        lspLog.info('gotoDefinitionAtCursor: could not resolve editor cursor position',);
        return;
      }
      lspLog.info(`gotoDefinitionAtCursor: line=${pos.line} character=${pos.character}`,);
      void (async function navigateOrFindReferences(): Promise<void> {
        const result = await doGotoDefinition({ ws, getCurrentFilePath, loadFileSafe, line: pos.line, character: pos.character, },);
        if (result === 'no-definition') { showCursorToast({ message: 'No definition found', rect, },); return; }
        if (result === 'error') { showCursorToast({ message: 'Go to definition failed', rect, },); return; }
        if (result !== 'already-at-definition') return;
        await showReferences({ ws, referencesPopup, getCurrentFilePath, line: pos.line, character: pos.character, rect, },);
      })();
    },
  };
}

/**
 * Requests references from the server and shows them in the popup.
 * If there is exactly one reference, navigates directly.
 *
 * @param ws - WebSocket client
 *
 * @param referencesPopup - popup to display results in
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param line - 0-based line number of the definition
 *
 * @param character - 0-based character offset
 *
 * @param rect - cursor bounding rect for popup positioning
 */
async function showReferences({ ws, referencesPopup, getCurrentFilePath, line, character, rect, }: {
  ws: EditorWsClient;
  referencesPopup: ReferencesPopup;
  getCurrentFilePath: () => string | null;
  line: number; character: number;
  rect: DOMRect;
}): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null) return;
  try {
    const response = await ws.request({ type: 'findReferences', path, line, character, },);
    if (!('locations' in response)) { showCursorToast({ message: 'No usages found', rect, },); return; }
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'locations' check
    const { locations, } = response as { locations: { path: string; line: number; character: number }[] };
    lspLog.info(`references: ${locations.length} usage(s) found`,);
    if (locations.length === 0) { showCursorToast({ message: 'No usages found', rect, },); return; }

    /** Strip common prefix from paths for display. */
    const rootDir = ws.rootDir;
    const items: ReferenceLocation[] = locations.map(function toItem(loc,) {
      const label = loc.path.startsWith(rootDir,) ? loc.path.slice(rootDir.length + 1,) : loc.path;
      return { path: loc.path, line: loc.line, label, };
    },);

    if (items.length === 1) {
      const only = items[0];
      if (only !== undefined) referencesPopup.dispatchEvent(new CustomEvent('reference-select', {
        detail: { path: only.path, line: only.line + 1, },
        bubbles: true, composed: true,
      },),);
      return;
    }

    referencesPopup.show({ locations: items, x: rect.left, y: rect.top, cursorHeight: rect.height, },);
  }
  catch (error) {
    lspLog.error(`references request failed: ${String(error,)}`,);
    showCursorToast({ message: 'References request failed', rect, },);
  }
}

/** Debounced content sync to the server. */
function wireContentSync({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient; editorPane: EditorPane; getCurrentFilePath: () => string | null;
}): void {
  let timer = 0;
  editorPane.addEventListener('contentchange', function handleContentChange() {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    timer = globalThis.setTimeout(function syncContent() {
      const path = getCurrentFilePath();
      if (path === null) return;
      void ws.notify({ type: 'didChange', path, content: editorPane.getText(), },);
    }, CONTENT_SYNC_DEBOUNCE_MS,) as unknown as number;
  },);
}

/** Receives diagnostic pushes and renders them. */
function wireDiagnostics({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient; editorPane: EditorPane; getCurrentFilePath: () => string | null;
}): void {
  ws.onDiagnostics = function handleDiagnostics(path, diagnostics,): void {
    if (path === getCurrentFilePath()) editorPane.setDiagnostics(diagnostics,);
  };
}
