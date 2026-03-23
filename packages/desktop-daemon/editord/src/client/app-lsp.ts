/**
 * LSP feature coordinator for the editord client.
 *
 * Wires content sync, diagnostics, hover, completions, formatting,
 * go-to-definition, references, and inlay hints by delegating to focused modules.
 */

import { wireGotoDefinition, formatDocument, } from './app-lsp-actions.ts';
import { requestCompletions, wireCompletionTrigger, } from './app-lsp-completions.ts';
import { performGotoAtCursor, } from './app-lsp-goto-cursor.ts';
import { wireHover, } from './app-lsp-hover.ts';
import { wireInlayHints, } from './app-lsp-inlay.ts';
import { wireSelectionRange, } from './app-lsp-selection.ts';
import { wireContentSync, wireDiagnostics, } from './app-lsp-sync.ts';
import type { CompletionPopup, } from './completion-popup.ts';
import type { EditorPane, } from './editor-pane.ts';
import type { HoverPopup, } from './hover-popup.ts';
import type { ReferencesPopup, } from './references-popup.ts';
import type { EditorWsClient, } from './ws-client.ts';

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
  loadFileSafe: (opts: { path: string; line?: number | undefined; character?: number | undefined }) => Promise<void>;
}): { formatDocument: () => Promise<void>; requestCompletions: () => void; refreshInlayHints: () => void; gotoDefinitionAtCursor: () => void; expandSelection: () => void; shrinkSelection: () => void } {
  /**
   * Returns the contenteditable container.
   *
   * @returns editor element, or null before connected
   */
  function getEditorElement(): HTMLElement | null { return editorPane.getEditorElement(); }

  wireContentSync({ ws, editorPane, getCurrentFilePath, },);
  wireDiagnostics({ ws, editorPane, getCurrentFilePath, },);
  wireHover({ ws, editorPane, hoverPopup, getEditorElement, completionPopup, referencesPopup, getCurrentFilePath, },);
  wireCompletionTrigger({
    editorPane,
    triggerCompletions: function trigger() {
      void requestCompletions({ ws, completionPopup, getEditorElement, getCurrentFilePath, },);
    },
  },);
  wireGotoDefinition({ ws, editorPane, getEditorElement, getCurrentFilePath, loadFileSafe, },);

  const inlayState = wireInlayHints({ ws, editorPane, getCurrentFilePath, },);
  const { expandSelection, shrinkSelection, } = wireSelectionRange({ ws, editorPane, getCurrentFilePath, },);

  return {
    formatDocument: function format(): Promise<void> {
      return formatDocument({ ws, editorPane, getCurrentFilePath, },);
    },
    requestCompletions: function completions(): void {
      void requestCompletions({ ws, completionPopup, getEditorElement, getCurrentFilePath, },);
    },
    refreshInlayHints: inlayState.refresh,
    expandSelection,
    shrinkSelection,
    gotoDefinitionAtCursor: function gotoDefAtCursor(): void {
      performGotoAtCursor({ ws, getCurrentFilePath, loadFileSafe, hoverPopup, editorPane, referencesPopup, },);
    },
  };
}
