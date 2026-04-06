/**
 * `<editor-pane>` web component.
 *
 * A contenteditable text editor that represents each line as a `<div>`.
 * Syntax highlighting via the CSS Custom Highlight API.
 * Paste is intercepted to force plain text.
 */

import type { Parser, } from '@lezer/common';
import { hDom as h, } from '@monochromatic-dev/module-hyperscript/ts';

import type {
  Diagnostic,
  InlayHint,
  Range,
  TextEdit,
} from '../../../protocol.ts';
import { clearHighlights, } from '../highlight/highlighter.ts';
import { getPositionFromPoint, } from '../position-from-point.ts';
import type { EditorPosition, } from '../position.ts';
import {
  getCursorPosition,
  getCursorRect,
  getSelection,
  restoreCursor,
  setSelection,
} from './cursor.ts';
import {
  createEditorElement,
  getTextContent,
  scrollLineIntoView,
  setTextContent,
} from './editor-pane-dom.ts';
import { STYLES, } from './editor-pane.styles.ts';
import type { SelectionCoords, } from './indent.ts';
import {
  computeDocumentRange,
  diagnosticsEqual,
  hintsEqual,
} from './query.ts';
import {
  scheduleDiagnosticHighlights,
  scheduleHighlight,
  scheduleInlayAnnotations,
  scheduleInlayMeasure,
} from './scheduling.ts';
import { applyEditsToText, } from './text-edits.ts';

/** `<editor-pane>` — contenteditable text editor component. */
export class EditorPane extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  readonly #shadow: ShadowRoot;
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

  //region Lifecycle

  /** Renders the editor container and attaches event listeners. */
  connectedCallback(): void {
    this.#editor = createEditorElement();
    this.#editor.addEventListener(
      'input',
      this.#scheduleHighlight.bind(this,),
    );
    this.#mutationObserver = new MutationObserver(this.#onMutation.bind(this,),);
    this.#mutationObserver.observe(
      this.#editor,
      {
        childList: true,
        characterData: true,
        subtree: true,
      },
    );
    this.#resizeObserver = new ResizeObserver(this.#scheduleInlayMeasure.bind(this,),);
    this.#resizeObserver.observe(this.#editor,);
    this.#shadow.replaceChildren(
      h({
        tag: 'style',
        text: STYLES,
      },),
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

  //endregion Lifecycle

  //region Content

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
    setTextContent({
      editor: this.#editor,
      text,
    },);
    this.#scheduleHighlight();
  }

  /**
   * Reads the full text content of the editor.
   *
   * @returns full text content of the editor
   */
  getText(): string {
    if (this.#editor === null)
      return '';
    return getTextContent({ editor: this.#editor, },);
  }

  /**
   * Scrolls the given line into the center of the viewport.
   *
   * @param line - 1-based line number to scroll to
   */
  scrollToLine({ line, }: { line: number; },): void {
    if (this.#editor === null)
      return;
    scrollLineIntoView({
      editor: this.#editor,
      line,
    },);
  }

  //endregion Content

  //region Diagnostics and hints

  /**
   * Replaces the current diagnostics and re-renders highlights and annotations.
   *
   * @param diagnostics - diagnostics from the language server
   */
  setDiagnostics(diagnostics: Diagnostic[],): void {
    if (diagnosticsEqual(
      diagnostics,
      this.#diagnostics,
    )) {
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
    if (hintsEqual(
      hints,
      this.#inlayHints,
    )) {
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

  //endregion Diagnostics and hints

  //region Selection and cursor

  /**
   * Sets the editor selection to the given coordinates.
   *
   * @param coords - selection start and end positions
   */
  setSelection(coords: SelectionCoords,): void {
    if (this.#editor === null)
      return;
    setSelection({
      editor: this.#editor,
      coords,
    },);
  }

  /**
   * Reads the current editor selection.
   *
   * @returns selection coordinates, or null
   */
  getSelection(): SelectionCoords | null {
    if (this.#editor === null)
      return null;
    return getSelection({
      editor: this.#editor,
      shadow: this.#shadow,
    },);
  }

  /**
   * Resolves the current caret position in the editor.
   *
   * @returns 0-based line and character, or null
   */
  getCursorPosition(): EditorPosition | null {
    return this.#editor !== null
      ? getCursorPosition({
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
    return getCursorRect({ shadow: this.#shadow, },);
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
    character: number;
  },): void {
    if (this.#editor === null)
      return;
    restoreCursor({
      editor: this.#editor,
      line,
      character,
    },);
  }

  //endregion Selection and cursor

  //region Element access

  /**
   * Provides direct access to the contenteditable container.
   * Used by command helpers in `editor-pane-commands.ts`.
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
    y: number;
  },): EditorPosition | null {
    if (this.#editor === null)
      return null;
    return getPositionFromPoint({
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

  //endregion Element access

  //region Public scheduling

  /**
   * Triggers deferred syntax highlighting.
   * Exposed for use by extracted command helpers.
   */
  requestHighlight(): void {
    this.#scheduleHighlight();
  }

  //endregion Public scheduling

  //region Internal

  /** MutationObserver callback — dispatches `contentchange` on any editor DOM mutation. */
  #onMutation(): void {
    this.dispatchEvent(
      new CustomEvent(
        'contentchange',
        {
          bubbles: true,
          composed: true,
        },
      ),
    );
  }

  /** Schedules diagnostic highlights. */
  #scheduleDiagnosticHighlights(): void {
    if (this.#editor !== null) {
      scheduleDiagnosticHighlights({
        editor: this.#editor,
        diagnostics: this.#diagnostics,
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
        parser: this.#parser,
      },);
    }
  }

  //endregion Internal
}

customElements.define(
  'editor-pane',
  EditorPane,
);
