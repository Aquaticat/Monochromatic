/**
 * `<editor-pane>` web component.
 *
 * A contenteditable text editor that represents each line as a `<div>`.
 * Syntax highlighting via the CSS Custom Highlight API.
 * Paste is intercepted to force plain text.
 */

import type { Parser, } from '@lezer/common';
import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

import type {
  Diagnostic,
  InlayHint,
  Range,
  TextEdit,
} from '../../../protocol.ts';
import { clearHighlights, } from '../highlight/highlighter.ts';
import { getPositionFromPoint as posFromPoint, } from '../position-from-point.ts';
import type { EditorPosition, } from '../position.ts';
import { selectAndCopyLine, } from './copy-line.ts';
import {
  getComposedRange,
  getCursorPosition as cursorPos,
  getCursorRect as cursorRect,
  getSelection as getSel,
  restoreCursor as restoreCur,
  setSelection as setSel,
} from './cursor.ts';
import { STYLES, } from './editor-pane.styles.ts';
import {
  indentLines as doIndent,
  unindentLines as doUnindent,
} from './indent.ts';
import {
  deleteLineAt,
  duplicateLineAt,
  swapLineDown,
  swapLineUp,
} from './line-ops.ts';
import { computeDocumentRange, } from './query.ts';
import {
  scheduleDiagnosticHighlights,
  scheduleHighlight,
  scheduleInlayAnnotations,
  scheduleInlayMeasure,
} from './scheduling.ts';
import { applyEditsToText, } from './text-edits.ts';

export type { SelectionCoords, } from './indent.ts';

/** `<editor-pane>` — contenteditable text editor component. */
export class EditorPane extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;
  /** The contenteditable container element. */
  #editor: HTMLDivElement | null = null;
  /** Lezer parser for the current file's language. */
  #parser: Parser | null = null;
  /** Pending highlight rAF ID. */
  #highlightFrame = 0;
  /** Current diagnostics. */
  #diagnostics: Diagnostic[] = [];
  /** Current inlay hints. */
  #inlayHints: InlayHint[] = [];
  /** Pending resize rAF ID. */
  #resizeMeasureFrame = 0;
  /** Resize observer for re-measurement. */
  #resizeObserver: ResizeObserver | null = null;
  /** Detects all DOM mutations inside the editor and dispatches `contentchange`. */
  #mutationObserver: MutationObserver | null = null;

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
      attrs: { contenteditable: 'true', spellcheck: 'false', },
    },);
    this.#editor.addEventListener(
      'paste',
      function handlePaste(event,) {
      event.preventDefault();
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text while preserving the browser's native undo stack
      document.execCommand('insertText', false,
        event.clipboardData?.getData('text/plain',) ?? '',);
    },
    );
    this.#editor.addEventListener(
      'input',
      this.#scheduleHighlight.bind(this,),
    );
    this.#mutationObserver = new MutationObserver(this.#onMutation.bind(this,),);
    this.#mutationObserver.observe(
      this.#editor,
      { childList: true, characterData: true,
      subtree: true, },
    );
    this.#resizeObserver = new ResizeObserver(this.#scheduleInlayMeasure.bind(this,),);
    this.#resizeObserver.observe(this.#editor,);
    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#editor,
    );
  }

  /** Cleans up observers and pending animation frames. */
  disconnectedCallback(): void {
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    cancelAnimationFrame(this.#highlightFrame,);
    cancelAnimationFrame(this.#resizeMeasureFrame,);
  }

  /**
   * Installs a Lezer parser for syntax highlighting.
   *
   * @param parser - Lezer parser instance, or null to disable
   */
  setParser(parser: Parser | null,): void {
    this.#parser = parser;
    if (parser === null)
      clearHighlights();
    else
      this.#scheduleHighlight();
  }

  /**
   * Replaces the editor content with the given text.
   *
   * @param text - full file content
   */
  setText(text: string,): void {
    if (this.#editor === null)
      return;
    this.#editor.replaceChildren(...text.split('\n',).map(function createLineDiv(line,) {
      return h({
        tag: 'div',
        text: line === '' ? '\n' : line,
      },);
    },),);
    this.#scheduleHighlight();
  }

  /**
   * Reads the full text content of the editor.
   *
   * @returns full text content of the editor
   */
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: textContent is null for Document/DocumentType nodes per spec
  getText(): string {
    if (this.#editor === null)
      return '';
    return [...this.#editor.children,]
      .map(function readLine(child,) {
        const t = child.textContent ?? '';
        return t === '\n' ? '' : t;
      },)
      .join('\n',);
  }

  /**
   * Scrolls the given line into the center of the viewport.
   *
   * @param line - 1-based line number to scroll to
   */
  scrollToLine({ line, }: { line: number; },): void {
    if (this.#editor === null)
      return;
    const child = this
      .#editor
      .children[Math.max(
        0,
        Math.min(line - 1, this.#editor.children.length - 1,),
      )];
    if (child !== undefined)
      child.scrollIntoView({ block: 'center', },);
  }

  /**
   * Replaces the current diagnostics and re-renders highlights and annotations.
   *
   * @param diagnostics - diagnostics from the language server
   */
  setDiagnostics(diagnostics: Diagnostic[],): void {
    if (diagnostics.length === this.#diagnostics.length
      && JSON.stringify(diagnostics,) === JSON.stringify(this.#diagnostics,))
    {
      return;
    }
    this.#diagnostics = diagnostics;
    this.#scheduleDiagnosticHighlights();
    this.#scheduleInlayAnnotations();
  }
  /**
   * Replaces the current inlay hints and re-renders annotations.
   *
   * @param hints - inlay hints from the language server
   */
  setInlayHints(hints: InlayHint[],): void {
    if (hints.length === this.#inlayHints.length
      && JSON.stringify(hints,) === JSON.stringify(this.#inlayHints,))
    {
      return;
    }
    this.#inlayHints = hints;
    this.#scheduleInlayAnnotations();
  }
  /**
   * Applies text edits received from the language server.
   *
   * @param edits - text edits to apply
   */
  applyTextEdits(edits: TextEdit[],): void {
    if (this.#editor === null || edits.length === 0)
      return;
    this.setText(applyEditsToText({
      text: this.getText(),
      edits,
    },),);
  }

  /** Deletes the line at the current cursor position. */
  deleteCurrentLine(): void {
    this.#lineOp(function op(
      e,
      p,
    ) {
      return deleteLineAt({
        editor: e,
        ...p,
      },);
    },);
  }
  /** Duplicates the current line below. */
  duplicateLineDown(): void {
    this.#lineOp(function op(
      e,
      p,
    ) {
      return duplicateLineAt({
        editor: e,
        ...p,
      },);
    },);
  }
  /** Swaps the current line with the next line. */
  swapLineDown(): void {
    this.#lineOp(function op(
      e,
      p,
    ) {
      return swapLineDown({
        editor: e,
        ...p,
      },);
    },);
  }
  /** Swaps the current line with the previous line. */
  swapLineUp(): void {
    this.#lineOp(function op(
      e,
      p,
    ) {
      return swapLineUp({
        editor: e,
        ...p,
      },);
    },);
  }

  /**
   * Selects and copies the current line when no text is selected.
   *
   * @returns true if the line was copied
   */
  selectAndCopyCurrentLine(): boolean {
    if (this.#editor === null)
      return false;
    const range = getComposedRange({ shadow: this.#shadow, },);
    const pos = this.getCursorPosition();
    if (range === null || pos === null)
      return false;
    return selectAndCopyLine({
      editor: this.#editor,
      line: pos.line,
      composedRange: range,
    },);
  }

  /** Indents the current line or selected lines. */
  indentLines(): void {
    this.#indentOp(doIndent,);
  }
  /** Unindents the current line or selected lines. */
  unindentLines(): void {
    this.#indentOp(doUnindent,);
  }

  /**
   * Sets the editor selection to the given coordinates.
   *
   * @param startLine - 0-based start line
   *
   * @param startCharacter - 0-based start character
   *
   * @param endLine - 0-based end line
   *
   * @param endCharacter - 0-based end character
   */
  setSelection(
    {
      startLine,
      startCharacter,
      endLine,
      endCharacter,
    }: {
      startLine: number;
      startCharacter: number;
      endLine: number;
      endCharacter: number
    },
  ): void {
    if (this.#editor === null)
      return;
    setSel({
      editor: this.#editor,
      coords: { startLine, startCharacter, endLine, endCharacter, },
    },);
  }
  /**
   * Reads the current editor selection.
   *
   * @returns selection coordinates, or null
   */
  getSelection(): {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number
  } | null
  {
    if (this.#editor === null)
      return null;
    return getSel({
      editor: this.#editor,
      shadow: this.#shadow,
    },);
  }

  /**
   * Provides direct access to the contenteditable container.
   *
   * @deprecated Use focused accessors (`getPositionFromPoint`, `getDocumentRange`, `scrollTop`, `addScrollListener`) instead.
   *
   * @returns editor container, or null before connected
   */
  getEditorElement(): HTMLDivElement | null {
    return this.#editor;
  }

  /**
   * Resolves a text position from mouse coordinates using geometric hit-testing.
   *
   * @param x - horizontal mouse coordinate (client pixels)
   *
   * @param y - vertical mouse coordinate (client pixels)
   *
   * @returns text position, or null if coordinates are outside text
   */
  getPositionFromPoint({
    x,
    y,
  }: {
    x: number;
    y: number
  },): EditorPosition | null {
    if (this.#editor === null)
      return null;
    return posFromPoint({
      editor: this.#editor,
      x,
      y,
    },);
  }

  /**
   * Returns a Range covering the entire document, suitable for inlay hint requests.
   *
   * @returns document range from (0,0) to end-of-file, or null before connected
   */
  getDocumentRange(): Range | null {
    return this.#editor !== null
      ? computeDocumentRange({ editor: this.#editor, },)
      : null;
  }

  /**
   * Gets the vertical scroll offset of the editor container.
   *
   * @returns scroll offset in pixels, or 0 before connected
   */
  get editorScrollTop(): number {
    return this.#editor?.scrollTop ?? 0;
  }

  /**
   * Sets the vertical scroll offset of the editor container.
   *
   * @param value - scroll offset in pixels
   */
  set editorScrollTop(value: number,) {
    if (this.#editor !== null)
      this.#editor.scrollTop = value;
  }

  /**
   * Attaches a scroll event listener to the editor container.
   *
   * @param listener - event handler function
   */
  addScrollListener(listener: EventListener,): void {
    this.#editor?.addEventListener(
      'scroll',
      listener,
    );
  }

  /**
   * Resolves the current caret position in the editor.
   *
   * @returns 0-based line and character, or null
   */
  getCursorPosition(): EditorPosition | null {
    return this.#editor !== null
      ? cursorPos({
        editor: this.#editor,
        shadow: this.#shadow,
      },)
      : null;
  }
  /**
   * Measures the caret's bounding rectangle for popup positioning.
   *
   * @returns DOMRect of the caret, or null
   */
  getCursorRect(): DOMRect | null {
    return cursorRect({ shadow: this.#shadow, },);
  }

  /**
   * Places the caret at the specified position.
   *
   * @param line - 0-based line index
   *
   * @param character - 0-based character offset
   */
  restoreCursor({
    line,
    character,
  }: {
    line: number;
    character: number
  },): void {
    if (this.#editor === null)
      return;
    restoreCur({
      editor: this.#editor,
      line,
      character,
    },);
  }

  /**
   * Common pattern for line operations that need cursor + rehighlight.
   *
   * @param fn - line operation that receives the editor and cursor, returns new cursor
   */
  #lineOp(
    fn: (editor: HTMLDivElement, pos: {
      line: number;
      character: number
    },) => {
      line: number;
      character: number;
    } | null,
  ): void {
    if (this.#editor === null)
      return;
    const pos = this.getCursorPosition();
    if (pos === null)
      return;
    const result = fn(
      this.#editor,
      pos,
    );
    if (result !== null)
      this.restoreCursor(result,);
    this.#scheduleHighlight();
  }

  /**
   * Common pattern for indent/unindent operations.
   *
   * @param fn - indent function to apply
   */
  #indentOp(fn: typeof doIndent,): void {
    if (this.#editor === null)
      return;
    const pos = this.getCursorPosition();
    if (pos === null)
      return;
    const sel = this.getSelection();
    const nonCollapsed = sel !== null
        && !(sel.startLine === sel.endLine && sel.startCharacter === sel.endCharacter)
      ? sel
      : null;
    const result = fn({
      editor: this.#editor,
      cursorLine: pos.line,
      cursorCharacter: pos.character,
      selection: nonCollapsed,
    },);
    if (result.isSelection)
      this.setSelection(result.selection,);
    else
      this.restoreCursor(result.cursor,);
    this.#scheduleHighlight();
  }

  /** MutationObserver callback — dispatches `contentchange` on any editor DOM mutation. */
  #onMutation(): void {
    this.dispatchEvent(
      new CustomEvent(
        'contentchange',
        { bubbles: true, composed: true, },
      ),
    );
  }

  /** Schedules diagnostic highlights. */
  #scheduleDiagnosticHighlights(): void {
    if (this.#editor !== null) {
      scheduleDiagnosticHighlights({
        editor: this.#editor,
        diagnostics: this
        .#diagnostics,
      },);
    }
  }
  /** Schedules inlay annotations. */
  #scheduleInlayAnnotations(): void {
    if (this.#editor !== null) {
      scheduleInlayAnnotations({
        editor: this.#editor,
        hints: this.#inlayHints,
        diagnostics: this.#diagnostics,
      },);
    }
  }
  /** Schedules inlay re-measurement. */
  #scheduleInlayMeasure(): void {
    if (this.#editor !== null) {
      cancelAnimationFrame(this.#resizeMeasureFrame,);
      this.#resizeMeasureFrame = scheduleInlayMeasure({ editor: this.#editor, },);
    }
  }
  /** Schedules syntax highlighting. */
  #scheduleHighlight(): void {
    cancelAnimationFrame(this.#highlightFrame,);
    if (this.#editor !== null) {
      this.#highlightFrame = scheduleHighlight({
        editor: this.#editor,
        parser: this
        .#parser,
      },);
    }
  }
}

customElements.define(
  'editor-pane',
  EditorPane,
);
