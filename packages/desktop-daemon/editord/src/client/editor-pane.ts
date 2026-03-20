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

import { applyHighlights, clearHighlights, } from './highlighter.ts';
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
