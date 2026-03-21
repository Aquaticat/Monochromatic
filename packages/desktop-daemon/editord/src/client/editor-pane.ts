/**
 * `<editor-pane>` web component.
 *
 * A contenteditable text editor that represents each line as a `<div>`.
 * No virtualization — the entire file is rendered into the DOM.
 * The browser handles undo/redo, cursor movement, selection, and IME natively.
 *
 * Paste events are intercepted to force plain text insertion, preventing
 * rich HTML from corrupting the line-per-div structure.
 *
 * Syntax highlighting is applied via the CSS Custom Highlight API.
 * When a Lezer parser is set via `setParser`, the editor re-highlights
 * after every content change using `requestAnimationFrame` batching.
 */

// oxlint-disable max-lines -- web component with contenteditable, paste handling, and syntax highlighting scheduling; splitting fractures the component

import type { Parser, } from '@lezer/common';
import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';

import type { Diagnostic, InlayHint, TextEdit, } from '../protocol.ts';
import { applyDiagnosticHighlights, clearDiagnosticHighlights, } from './diagnostics-layer.ts';
import { applyHighlights, clearHighlights, } from './highlighter.ts';
import { applyInlayAnnotations, clearInlayAnnotations, } from './inlay-layer.ts';
import { measureInlayOffsets, } from './inlay-measure.ts';
import { STYLES, } from './editor-pane.styles.ts';

/**
 * `<editor-pane>` — contenteditable text editor component.
 *
 * Each line of the file is a child `<div>` of the contenteditable container.
 * The component exposes methods to set and get the full text content,
 * and to configure syntax highlighting via a Lezer parser.
 */
export class EditorPane extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** The contenteditable container element. */
  #editor: HTMLDivElement | null = null;

  /** Lezer parser for the current file's language, or null when unsupported. */
  #parser: Parser | null = null;

  /** Pending `requestAnimationFrame` ID for debounced highlight updates. */
  #highlightFrame = 0;

  /** Current diagnostics for the open file. */
  #diagnostics: Diagnostic[] = [];

  /** Current inlay hints for the open file. */
  #inlayHints: InlayHint[] = [];

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders the editor container and attaches event listeners. */
  connectedCallback(): void {
    this.#editor = h({
      tag: 'div',
      class: 'editor',
      attrs: {
        contenteditable: 'true',
        spellcheck: 'false',
      },
    },);

    this.#editor.addEventListener('paste', function handlePaste(event,) {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain',) ?? '';
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text while preserving the browser's native undo stack
      document.execCommand('insertText', false, text,);
    },);

    this.#editor.addEventListener('input', this.#scheduleHighlight.bind(this,),);
    this.#editor.addEventListener('input', this.#dispatchContentChange.bind(this,),);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#editor,
    );
  }

  /**
   * Sets the Lezer parser for syntax highlighting.
   * Triggers an immediate re-highlight if the editor has content.
   * Pass null to disable highlighting (clears existing highlights).
   *
   * @param parser - Lezer parser instance, or null to disable
   */
  setParser(parser: Parser | null,): void {
    this.#parser = parser;
    if (parser === null) {
      clearHighlights();
    }
    else {
      this.#scheduleHighlight();
    }
  }

  /**
   * Sets the editor content from a file's text.
   * Splits on newlines and creates one `<div>` per line.
   * Triggers re-highlighting after the DOM update.
   *
   * @param text - full file content
   */
  setText(text: string,): void {
    if (this.#editor === null)
      return;

    const lineElements = text.split('\n',).map(function createLineDiv(line,) {
      return h({ tag: 'div', text: line === '' ? '\n' : line, },);
    },);

    this.#editor.replaceChildren(...lineElements,);
    this.#scheduleHighlight();
  }

  /**
   * Reads the current editor content as a single string.
   * Joins the text content of each child div with newlines.
   *
   * @returns full text content of the editor
   */
  getText(): string {
    if (this.#editor === null)
      return '';

    return [...this.#editor.children,].map(function readLineText(child,) {
      // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- textContent is typed as `string | null` in DOM; null when node has no text
      const text = child.textContent ?? '';
      return text === '\n' ? '' : text;
    },).join('\n',);
  }

  /**
   * Scrolls the editor to bring the specified line number into view.
   * Line numbers are 1-based. Out-of-range values are clamped.
   *
   * @param line - 1-based line number to scroll to
   */
  scrollToLine({ line, }: { line: number }): void {
    if (this.#editor === null)
      return;

    const index = Math.max(0, Math.min(line - 1, this.#editor.children.length - 1,),);
    const child = this.#editor.children[index];
    if (child !== undefined)
      child.scrollIntoView({ block: 'center', },);
  }

  /**
   * Sets the current diagnostics and renders them as underlines.
   * Replaces any previously displayed diagnostics.
   * Also refreshes inlay annotations since they include diagnostic messages.
   *
   * @param diagnostics - diagnostics from the language server
   */
  setDiagnostics(diagnostics: Diagnostic[],): void {
    this.#diagnostics = diagnostics;
    this.#scheduleDiagnosticHighlights();
    this.#scheduleInlayAnnotations();
  }

  /**
   * Sets the current inlay hints and renders them as line annotations.
   * Replaces any previously displayed hints.
   *
   * @param hints - inlay hints from the language server
   */
  setInlayHints(hints: InlayHint[],): void {
    this.#inlayHints = hints;
    this.#scheduleInlayAnnotations();
  }

  /**
   * Applies text edits from a formatting operation.
   * Sorts edits bottom-to-top so earlier edits don't shift later positions.
   * Replaces the full editor content after applying all edits.
   *
   * @param edits - text edits to apply
   */
  applyTextEdits(edits: TextEdit[],): void {
    if (this.#editor === null || edits.length === 0)
      return;

    const text = this.getText();
    const lines = text.split('\n',);

    /** Sort edits bottom-to-top to preserve offset stability. */
    const sorted = edits.toSorted(function compareEditsReverse(a, b,) {
      const lineDiff = b.range.end.line - a.range.end.line;
      return lineDiff !== 0 ? lineDiff : b.range.end.character - a.range.end.character;
    },);

    for (const edit of sorted) {
      const startLine = edit.range.start.line;
      const endLine = edit.range.end.line;
      const startChar = edit.range.start.character;
      const endChar = edit.range.end.character;

      const before = lines[startLine]?.slice(0, startChar,) ?? '';
      const after = lines[endLine]?.slice(endChar,) ?? '';
      const newLines = (before + edit.newText + after).split('\n',);
      lines.splice(startLine, endLine - startLine + 1, ...newLines,);
    }

    this.setText(lines.join('\n',),);
  }

  /**
   * Returns the underlying contenteditable element for position tracking.
   * Used by the app to compute cursor/mouse positions relative to line divs.
   *
   * @returns the editor container, or null before connected
   */
  getEditorElement(): HTMLDivElement | null {
    return this.#editor;
  }

  /**
   * Dispatches a `contentchange` event when the editor content is modified.
   * Used by the app to trigger debounced content sync to the server.
   */
  #dispatchContentChange(): void {
    this.dispatchEvent(new CustomEvent('contentchange', {
      bubbles: true,
      composed: true,
    },),);
  }

  /**
   * Schedules diagnostic highlight rendering for the next animation frame.
   */
  #scheduleDiagnosticHighlights(): void {
    if (this.#editor === null)
      return;

    const pane = this;
    requestAnimationFrame(function applyScheduledDiagnostics() {
      if (pane.#editor === null)
        return;

      if (pane.#diagnostics.length === 0) {
        clearDiagnosticHighlights();
        return;
      }

      applyDiagnosticHighlights({ editor: pane.#editor, diagnostics: pane.#diagnostics, },);
    },);
  }

  /**
   * Schedules inlay annotation rendering for the next animation frame.
   * Combines current inlay hints and diagnostics into per-line annotations.
   */
  #scheduleInlayAnnotations(): void {
    if (this.#editor === null)
      return;

    const pane = this;
    requestAnimationFrame(function applyScheduledInlayAnnotations() {
      if (pane.#editor === null)
        return;

      if (pane.#inlayHints.length === 0 && pane.#diagnostics.length === 0) {
        clearInlayAnnotations({ editor: pane.#editor, },);
        return;
      }

      applyInlayAnnotations({
        editor: pane.#editor,
        hints: pane.#inlayHints,
        diagnostics: pane.#diagnostics,
      },);

      /** Measure ::before heights after layout to set line number offsets. */
      const editorRef = pane.#editor;
      requestAnimationFrame(function measureAfterLayout() {
        measureInlayOffsets({ editor: editorRef, },);
      },);
    },);
  }

  /**
   * Schedules a highlight update for the next animation frame.
   * Cancels any previously scheduled update to coalesce rapid edits
   * into a single parse-and-highlight pass.
   */
  #scheduleHighlight(): void {
    cancelAnimationFrame(this.#highlightFrame,);
    const pane = this;
    this.#highlightFrame = requestAnimationFrame(function applyScheduledHighlight() {
      if (pane.#editor === null)
        return;

      if (pane.#parser === null) {
        clearHighlights();
        return;
      }

      applyHighlights({ editor: pane.#editor, parser: pane.#parser, },);
    },);
  }
}

customElements.define('editor-pane', EditorPane,);
