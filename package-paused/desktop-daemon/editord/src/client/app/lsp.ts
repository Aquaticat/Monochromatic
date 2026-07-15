/**
 * LSP feature coordinator for the editord client.
 *
 * Wires content sync, diagnostics, hover, completions, formatting,
 * go-to-definition, references, and inlay hints by delegating to focused modules.
 */

import {
  formatDocument,
  wireGotoDefinition,
} from './lsp-actions.ts';
import {
  requestCompletions,
  wireCompletionDismiss,
  wireCompletionTrigger,
} from './lsp-completions.ts';
import { performGotoAtCursor, } from './lsp-goto-cursor.ts';
import { wireHover, } from './lsp-hover.ts';
import { wireInlayHints, } from './lsp-inlay.ts';
import {
  initiateRename,
  performRename,
} from './lsp-rename.ts';
import { wireSelectionRange, } from './lsp-selection.ts';
import {
  wireContentSync,
  wireDiagnostics,
} from './lsp-sync.ts';
import type {
  CompletionPopupHandle,
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  HoverPopupHandle,
  LoadFileFn,
  ReferencesPopupHandle,
  RenameInputHandle,
} from './types.ts';

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
 *
 * @example
 * ```ts
 * const lspBindings = wireLsp({ ws, editorPane, hoverPopup, completionPopup, referencesPopup, getCurrentFilePath, loadFileSafe, });
 * ```
 */
export function wireLsp(
  {
    ws,
    editorPane,
    hoverPopup,
    completionPopup,
    referencesPopup,
    renameInput,
    getCurrentFilePath,
    loadFileSafe,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly hoverPopup: HoverPopupHandle;
    readonly completionPopup: CompletionPopupHandle;
    readonly referencesPopup: ReferencesPopupHandle;
    readonly renameInput: RenameInputHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly loadFileSafe: LoadFileFn;
  },
): {
  readonly formatDocument: () => Promise<void>;
  readonly requestCompletions: () => void;
  readonly refreshInlayHints: () => void;
  readonly gotoDefinitionAtCursor: () => void;
  readonly expandSelection: () => void;
  readonly shrinkSelection: () => void;
  readonly renameAtCursor: () => void;
} {
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
  wireCompletionDismiss({
    completionPopup,
    editorPane,
  },);
  wireGotoDefinition({
    ws,
    editorPane,
    getCurrentFilePath,
    loadFileSafe,
  },);

  /**
   * Inlay-hint subsystem state; exposes the manual `refresh` action below.
   */
  const inlayState = wireInlayHints({
    ws,
    editorPane,
    getCurrentFilePath,
  },);
  /**
   * Selection-range commands wired into the returned action surface.
   */
  const {
    expandSelection,
    shrinkSelection,
  } = wireSelectionRange({
    ws,
    editorPane,
    getCurrentFilePath,
  },);

  /**
   * Wires the rename-confirm event from the rename input to perform the
   * actual rename. Captures the cursor position at initiation time so the
   * rename request uses the correct symbol location. Wrapped in a const
   * ref-object so `current` can be reassigned without a function-root let.
   */
  const renamePosition: {
    current: {
      readonly line: number;
      readonly character: number;
    } | null;
  } = { current: null, };

  renameInput.addEventListener(
    'rename-confirm',
    function handleRenameConfirm(event,) {
      /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- custom event detail */
      /**
       * Custom-event detail destructured to capture the user-entered new symbol name.
       */
      const { newName, } = (event as CustomEvent<{ readonly newName: string; }>).detail;
      /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
      /**
       * Cursor position captured at initiation so the rename targets the right symbol.
       */
      const captured = renamePosition.current;
      if (captured !== null) {
        void performRename({
          ws,
          editorPane,
          getCurrentFilePath,
          newName,
          line: captured.line,
          character: captured.character,
        },);
        renamePosition.current = null;
      }
    },
  );

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
    renameAtCursor: function renameAtCursorAction(): void {
      /**
       * Captured before opening the input so the eventual confirm targets the right cursor.
       */
      const pos = editorPane.getCursorPosition();
      if (pos !== null)
        renamePosition.current = pos;
      void initiateRename({
        ws,
        editorPane,
        renameInput,
        getCurrentFilePath,
      },);
    },
  };
}
