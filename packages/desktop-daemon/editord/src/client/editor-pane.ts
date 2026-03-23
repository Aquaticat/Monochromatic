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
import type { EditorPosition, } from './position.ts';
import { applyDiagnosticHighlights, clearDiagnosticHighlights, } from './diagnostics-layer.ts';
import { applyHighlights, clearHighlights, } from './highlighter.ts';
import { applyInlayAnnotations, clearInlayAnnotations, } from './inlay-layer.ts';
import { measureInlayOffsets, } from './inlay-measure.ts';
import { STYLES, } from './editor-pane.styles.ts';

/** Single indent level: two spaces. */
const INDENT_UNIT = '  ';

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

  /** Pending `requestAnimationFrame` ID for debounced resize re-measurement. */
  #resizeMeasureFrame = 0;

  /** Observer for editor resize events; stored for cleanup in disconnectedCallback. */
  #resizeObserver: ResizeObserver | null = null;

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

    /** Re-measure inlay indent positions when the editor resizes (wrapping changes). */
    this.#resizeObserver = new ResizeObserver(this.#scheduleInlayMeasure.bind(this,),);
    this.#resizeObserver.observe(this.#editor,);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#editor,
    );
  }

  /** Cleans up the resize observer and pending animation frames. */
  disconnectedCallback(): void {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    cancelAnimationFrame(this.#highlightFrame,);
    cancelAnimationFrame(this.#resizeMeasureFrame,);
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
   * Deletes the line at the current cursor position.
   * If the file has only one line, it is cleared rather than removed
   * so the editor always has at least one child div.
   * Cursor is placed at the same character offset on the next line
   * (or the new last line if the deleted line was at the end).
   *
   * @example
   * ```ts
   * editorPane.deleteCurrentLine();
   * ```
   */
  deleteCurrentLine(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    const { children, } = this.#editor;
    if (children.length <= 1) {
      /** Single line — clear it instead of removing. */
      const only = children[0];
      if (only !== undefined) only.textContent = '\n';
      this.restoreCursor({ line: 0, character: 0, },);
      this.#dispatchContentChange();
      this.#scheduleHighlight();
      return;
    }

    const lineDiv = children[pos.line];
    if (lineDiv === undefined) return;

    lineDiv.remove();

    /** Place cursor on the line that now occupies the deleted index, or the new last line. */
    const nextLine = Math.min(pos.line, children.length - 1,);
    this.restoreCursor({ line: nextLine, character: pos.character, },);

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Selects and copies the current line when no text is selected.
   * Mirrors JetBrains behavior: Ctrl+C with an empty selection copies
   * the entire line (including a trailing newline) to the clipboard
   * and highlights the line visually.
   *
   * @returns true if the line was copied (selection was collapsed),
   * false if text was already selected (caller should let the browser handle copy)
   *
   * @example
   * ```ts
   * if (editorPane.selectAndCopyCurrentLine()) {
   *   event.preventDefault();
   * }
   * ```
   */
  selectAndCopyCurrentLine(): boolean {
    if (this.#editor === null) return false;

    const composedRange = this.#getComposedRange();
    if (composedRange === null) return false;
    if (!composedRange.collapsed) return false;

    const pos = this.getCursorPosition();
    if (pos === null) return false;

    const lineDiv = this.#editor.children[pos.line];
    if (lineDiv === undefined) return false;

    /** Select the full line visually. */
    const selection = document.getSelection();
    if (selection === null) return false;

    const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
    const firstText = walker.nextNode();
    if (firstText === null) return false;

    let lastText: Node = firstText;
    let next = walker.nextNode();
    while (next !== null) {
      lastText = next;
      next = walker.nextNode();
    }

    const lastLen = lastText.textContent?.length ?? 0;
    selection.setBaseAndExtent(firstText, 0, lastText, lastLen,);

    /** Copy line text with trailing newline, matching VS Code behavior. */
    const raw = lineDiv.textContent ?? '';
    const lineText = raw === '\n' ? '' : raw;
    void navigator.clipboard.writeText(lineText + '\n',);

    return true;
  }

  /**
   * Duplicates the current line below and moves the cursor to the new line
   * at the same character offset.
   *
   * @example
   * ```ts
   * editorPane.duplicateLineDown();
   * ```
   */
  duplicateLineDown(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    const lineDiv = this.#editor.children[pos.line];
    if (lineDiv === undefined) return;

    const clone = lineDiv.cloneNode(true,);
    lineDiv.after(clone,);

    this.restoreCursor({ line: pos.line + 1, character: pos.character, },);

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Swaps the current line with the next line and moves the cursor down.
   * No-op when the cursor is on the last line.
   *
   * @example
   * ```ts
   * editorPane.swapLineDown();
   * ```
   */
  swapLineDown(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    const { children, } = this.#editor;
    if (pos.line >= children.length - 1) return;

    const currentDiv = children[pos.line];
    const nextDiv = children[pos.line + 1];
    if (currentDiv === undefined || nextDiv === undefined) return;

    /** Insert current line after the next line, effectively swapping them. */
    nextDiv.after(currentDiv,);

    this.restoreCursor({ line: pos.line + 1, character: pos.character, },);

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Swaps the current line with the previous line and moves the cursor up.
   * No-op when the cursor is on the first line.
   *
   * @example
   * ```ts
   * editorPane.swapLineUp();
   * ```
   */
  swapLineUp(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    if (pos.line <= 0) return;

    const { children, } = this.#editor;
    const currentDiv = children[pos.line];
    const prevDiv = children[pos.line - 1];
    if (currentDiv === undefined || prevDiv === undefined) return;

    /** Insert current line before the previous line, effectively swapping them. */
    prevDiv.before(currentDiv,);

    this.restoreCursor({ line: pos.line - 1, character: pos.character, },);

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Indents the current line or all lines in the selection by prepending
   * {@link INDENT_UNIT}. Preserves the selection or cursor position
   * adjusted for the added indentation.
   *
   * @example
   * ```ts
   * editorPane.indentLines();
   * ```
   */
  indentLines(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    const sel = this.getSelection();
    /** Non-collapsed selection spans at least one character. */
    const nonCollapsed = sel !== null
      && !(sel.startLine === sel.endLine && sel.startCharacter === sel.endCharacter);

    const startLine = nonCollapsed ? sel.startLine : pos.line;
    const endLine = nonCollapsed ? sel.endLine : pos.line;

    for (let i = startLine; i <= endLine; i++) {
      const lineDiv = this.#editor.children[i];
      if (lineDiv === undefined) continue;
      const text = lineDiv.textContent ?? '';
      lineDiv.textContent = text === '\n' ? INDENT_UNIT : INDENT_UNIT + text;
    }

    /** Restore selection or cursor with offsets shifted by the indent width. */
    if (nonCollapsed) {
      this.setSelection({
        startLine: sel.startLine,
        startCharacter: sel.startCharacter + INDENT_UNIT.length,
        endLine: sel.endLine,
        endCharacter: sel.endCharacter + INDENT_UNIT.length,
      },);
    }
    else {
      this.restoreCursor({ line: pos.line, character: pos.character + INDENT_UNIT.length, },);
    }

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Unindents the current line or all lines in the selection by removing
   * up to {@link INDENT_UNIT} leading spaces. Preserves the selection
   * or cursor position adjusted for the removed indentation.
   *
   * @example
   * ```ts
   * editorPane.unindentLines();
   * ```
   */
  unindentLines(): void {
    if (this.#editor === null) return;

    const pos = this.getCursorPosition();
    if (pos === null) return;

    const sel = this.getSelection();
    /** Non-collapsed selection spans at least one character. */
    const nonCollapsed = sel !== null
      && !(sel.startLine === sel.endLine && sel.startCharacter === sel.endCharacter);

    const startLine = nonCollapsed ? sel.startLine : pos.line;
    const endLine = nonCollapsed ? sel.endLine : pos.line;

    /** Track spaces removed per line for cursor/selection adjustment. */
    const removedPerLine: number[] = [];

    for (let i = startLine; i <= endLine; i++) {
      const lineDiv = this.#editor.children[i];
      if (lineDiv === undefined) { removedPerLine.push(0,); continue; }
      const text = lineDiv.textContent ?? '';
      if (text === '\n') { removedPerLine.push(0,); continue; }

      let count = 0;
      if (text.startsWith('  ',)) count = 2;
      else if (text.startsWith(' ',)) count = 1;

      if (count > 0) {
        const newText = text.slice(count,);
        lineDiv.textContent = newText === '' ? '\n' : newText;
      }
      removedPerLine.push(count,);
    }

    /** Restore selection or cursor with offsets shifted back by removed spaces. */
    if (nonCollapsed) {
      const startRemoved = removedPerLine[0] ?? 0;
      const endRemoved = removedPerLine[removedPerLine.length - 1] ?? 0;
      this.setSelection({
        startLine: sel.startLine,
        startCharacter: Math.max(0, sel.startCharacter - startRemoved,),
        endLine: sel.endLine,
        endCharacter: Math.max(0, sel.endCharacter - endRemoved,),
      },);
    }
    else {
      const lineRemoved = removedPerLine[0] ?? 0;
      this.restoreCursor({ line: pos.line, character: Math.max(0, pos.character - lineRemoved,), },);
    }

    this.#dispatchContentChange();
    this.#scheduleHighlight();
  }

  /**
   * Sets the visual selection to a range defined by start and end positions.
   * Used by expand/shrink selection to apply LSP selection ranges.
   *
   * @param startLine - 0-based start line index
   *
   * @param startCharacter - 0-based start character offset
   *
   * @param endLine - 0-based end line index
   *
   * @param endCharacter - 0-based end character offset
   *
   * @example
   * ```ts
   * editorPane.setSelection({ startLine: 0, startCharacter: 0, endLine: 2, endCharacter: 5 });
   * ```
   */
  setSelection({ startLine, startCharacter, endLine, endCharacter, }: {
    startLine: number; startCharacter: number; endLine: number; endCharacter: number;
  }): void {
    if (this.#editor === null) return;

    const selection = document.getSelection();
    if (selection === null) return;

    /**
     * Resolves a text node and offset within a line div for
     * `setBaseAndExtent`. Walks text nodes to find the one
     * containing the target character offset.
     *
     * @param lineIndex - 0-based line index
     *
     * @param character - 0-based character offset within the line
     *
     * @returns text node and offset, or null if not resolvable
     */
    const resolvePosition = (lineIndex: number, character: number,): { node: Node; offset: number } | null => {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- checked #editor above
      const lineDiv = this.#editor!.children[lineIndex];
      if (lineDiv === undefined) return null;

      const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
      let remaining = character;
      let textNode = walker.nextNode();
      while (textNode !== null) {
        const len = textNode.textContent?.length ?? 0;
        if (remaining <= len) return { node: textNode, offset: remaining, };
        remaining -= len;
        textNode = walker.nextNode();
      }

      /** Offset past end — clamp to last text node's end. */
      const { lastChild, } = lineDiv;
      if (lastChild !== null) return { node: lastChild, offset: lastChild.textContent?.length ?? 0, };
      return null;
    };

    const start = resolvePosition(startLine, startCharacter,);
    const end = resolvePosition(endLine, endCharacter,);
    if (start === null || end === null) return;

    selection.setBaseAndExtent(start.node, start.offset, end.node, end.offset,);
  }

  /**
   * Reads the current visual selection as 0-based line/character coordinates.
   * Returns null if no selection exists or the selection is collapsed.
   *
   * @returns selection coordinates, or null
   */
  getSelection(): { startLine: number; startCharacter: number; endLine: number; endCharacter: number } | null {
    if (this.#editor === null) return null;

    const range = this.#getComposedRange();
    if (range === null) return null;

    /**
     * Resolves a container node and offset to a line/character position.
     *
     * @param container - DOM node from the range boundary
     *
     * @param offset - offset within the container node
     *
     * @returns 0-based line and character, or null
     */
    const resolvePos = (container: Node, offset: number,): { line: number; character: number } | null => {
      let node: Node | null = container;
      let lineDiv: HTMLElement | null = null;
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion -- checked #editor above
      const editor = this.#editor!;
      while (node !== null && node !== editor) {
        if (node.parentNode === editor && node instanceof HTMLElement) {
          lineDiv = node;
          break;
        }
        node = node.parentNode;
      }
      if (lineDiv === null) return null;

      const line = [...editor.children,].indexOf(lineDiv,);
      if (line === -1) return null;

      let character = 0;
      const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
      let textNode = walker.nextNode();
      while (textNode !== null) {
        if (textNode === container) { character += offset; break; }
        character += textNode.textContent?.length ?? 0;
        textNode = walker.nextNode();
      }

      return { line, character, };
    };

    const start = resolvePos(range.startContainer, range.startOffset,);
    const end = resolvePos(range.endContainer, range.endOffset,);
    if (start === null || end === null) return null;

    return { startLine: start.line, startCharacter: start.character, endLine: end.line, endCharacter: end.character, };
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
   * Resolves a composed `StaticRange` from the current selection,
   * crossing the shadow DOM boundary via `getComposedRanges`.
   *
   * @returns the first composed range, or null if unavailable
   */
  #getComposedRange(): StaticRange | null {
    const selection = document.getSelection();
    if (selection === null) return null;
    const ranges = selection.getComposedRanges({ shadowRoots: [this.#shadow,], },);
    return ranges[0] ?? null;
  }

  /**
   * Resolves the current editor cursor position using `getComposedRanges`
   * to cross the shadow DOM boundary.
   *
   * `document.getSelection()` cannot see into shadow roots, so the
   * standalone `getCursorPosition` utility fails for keyboard-triggered
   * actions. This method uses the component's own shadow root reference
   * with `getComposedRanges` to obtain the true caret position.
   *
   * @returns 0-based line and character, or null if no caret is inside the editor
   */
  getCursorPosition(): EditorPosition | null {
    if (this.#editor === null) return null;

    const range = this.#getComposedRange();
    if (range === null) return null;

    let node: Node | null = range.startContainer;

    /** Walk up to find the line div (direct child of editor). */
    let lineDiv: HTMLElement | null = null;
    while (node !== null && node !== this.#editor) {
      if (node.parentNode === this.#editor && node instanceof HTMLElement) {
        lineDiv = node;
        break;
      }
      node = node.parentNode;
    }

    if (lineDiv === null) return null;

    const line = [...this.#editor.children,].indexOf(lineDiv,);
    if (line === -1) return null;

    /** Compute character offset by summing text node lengths before the caret. */
    let character = 0;
    const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
    let textNode = walker.nextNode();
    while (textNode !== null) {
      if (textNode === range.startContainer) {
        character += range.startOffset;
        break;
      }
      character += textNode.textContent?.length ?? 0;
      textNode = walker.nextNode();
    }

    return { line, character, };
  }

  /**
   * Returns the bounding rectangle of the editor cursor using `getComposedRanges`
   * to cross the shadow DOM boundary.
   *
   * @returns DOMRect of the caret, or null if no caret is inside the editor
   */
  getCursorRect(): DOMRect | null {
    if (this.#editor === null) return null;

    const sRange = this.#getComposedRange();
    if (sRange === null) return null;

    const range = document.createRange();
    range.setStart(sRange.startContainer, sRange.startOffset,);
    range.setEnd(sRange.endContainer, sRange.endOffset,);
    return range.getBoundingClientRect();
  }

  /**
   * Places the cursor at the specified line and character position.
   * Uses the per-line-div structure to find the target text node
   * and sets the browser Selection accordingly.
   *
   * @param line - 0-based line index
   *
   * @param character - 0-based character offset within the line
   */
  restoreCursor({ line, character, }: { line: number; character: number }): void {
    if (this.#editor === null) return;

    const lineDiv = this.#editor.children[line];
    if (lineDiv === undefined) return;

    const selection = document.getSelection();
    if (selection === null) return;

    /** Walk text nodes to find the one containing the target offset. */
    const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT,);
    let remaining = character;
    let textNode = walker.nextNode();
    while (textNode !== null) {
      const len = textNode.textContent?.length ?? 0;
      if (remaining <= len) {
        selection.setBaseAndExtent(textNode, remaining, textNode, remaining,);
        return;
      }
      remaining -= len;
      textNode = walker.nextNode();
    }

    /** Offset exceeds line length — place at end of last text node. */
    const { lastChild, } = lineDiv;
    if (lastChild !== null) {
      const lastLen = lastChild.textContent?.length ?? 0;
      selection.setBaseAndExtent(lastChild, lastLen, lastChild, lastLen,);
    }
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
   * Schedules a re-measurement of inlay indent positions for the next animation frame.
   * Called on editor resize to update positions after wrapping changes.
   */
  #scheduleInlayMeasure(): void {
    if (this.#editor === null)
      return;

    cancelAnimationFrame(this.#resizeMeasureFrame,);
    const editorRef = this.#editor;
    this.#resizeMeasureFrame = requestAnimationFrame(function remeasureInlayOffsets() {
      measureInlayOffsets({ editor: editorRef, },);
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
