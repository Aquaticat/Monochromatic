/**
 * LSP feature coordinator for the editord client.
 *
 * Wires content sync, diagnostics, hover, completions, formatting,
 * go-to-definition, references, and inlay hints by delegating to focused modules.
 */

import type { CompletionPopup, } from '../completion/completion-popup.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import type { HoverPopup, } from '../hover/hover-popup.ts';
import type { ReferencesPopup, } from '../references/references-popup.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type {
  GetCurrentFilePathFn,
  LoadFileFn,
} from './types.ts';
import {
  formatDocument,
  wireGotoDefinition,
} from './lsp-actions.ts';
import {
  requestCompletions,
  wireCompletionTrigger,
} from './lsp-completions.ts';
import { performGotoAtCursor, } from './lsp-goto-cursor.ts';
import { wireHover, } from './lsp-hover.ts';
import { wireInlayHints, } from './lsp-inlay.ts';
import { wireSelectionRange, } from './lsp-selection.ts';
import {
  wireContentSync,
  wireDiagnostics,
} from './lsp-sync.ts';

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
export function wireLsp(
  {
    ws,
    editorPane,
    hoverPopup,
    completionPopup,
    referencesPopup,
    getCurrentFilePath,
    loadFileSafe,
  }: {
      ws: EditorWsClient;
      editorPane: EditorPane;
      hoverPopup: HoverPopup;
      completionPopup: CompletionPopup;
      referencesPopup: ReferencesPopup;
      getCurrentFilePath: GetCurrentFilePathFn;
      loadFileSafe: LoadFileFn;
    },
): {
  formatDocument: () => Promise<void>;
  requestCompletions: () => void;
  refreshInlayHints: () => void;
  gotoDefinitionAtCursor: () => void;
  expandSelection: () => void;
  shrinkSelection: () => void
}
{
  wireContentSync({
    ws,
    editorPane,
    getCurrentFilePath,
  },);
  wireDiagnostics({
    ws,
    editorPane,
    getCurrentFilePath,
  },);
  wireHover({
    ws,
    editorPane,
    hoverPopup,
    completionPopup,
    referencesPopup,
    getCurrentFilePath,
  },);
  wireCompletionTrigger({
    editorPane,
    triggerCompletions: function trigger() {
      void requestCompletions({
        ws,
        completionPopup,
        editorPane,
        getCurrentFilePath,
      },);
    },
  },);
  wireGotoDefinition({
    ws,
    editorPane,
    getCurrentFilePath,
    loadFileSafe,
  },);

  const inlayState = wireInlayHints({
    ws,
    editorPane,
    getCurrentFilePath,
  },);
  const {
    expandSelection,
    shrinkSelection,
  } = wireSelectionRange({
    ws,
    editorPane,
    getCurrentFilePath,
  },);

  return {
    formatDocument: function format(): Promise<void> {
      return formatDocument({
        ws,
        editorPane,
        getCurrentFilePath,
      },);
    },
    requestCompletions: function completions(): void {
      void requestCompletions({
        ws,
        completionPopup,
        editorPane,
        getCurrentFilePath,
      },);
    },
    refreshInlayHints: inlayState.refresh,
    expandSelection,
    shrinkSelection,
    gotoDefinitionAtCursor: function gotoDefAtCursor(): void {
      performGotoAtCursor({
        ws,
        getCurrentFilePath,
        loadFileSafe,
        hoverPopup,
        editorPane,
        referencesPopup,
      },);
    },
  };
}
