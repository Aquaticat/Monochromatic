/**
 * `<editor-pane>` web component.
 *
 * A contenteditable text editor that represents each line as a `<div>`.
 * No virtualization — the entire file is rendered into the DOM.
 * The browser handles undo/redo, cursor movement, selection, and IME natively.
 *
 * Paste events are intercepted to force plain text insertion, preventing
 * rich HTML from corrupting the line-per-div structure.
 */

import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';

import { STYLES, } from './editor-pane.styles.ts';

/**
 * `<editor-pane>` — contenteditable text editor component.
 *
 * Each line of the file is a child `<div>` of the contenteditable container.
 * The component exposes methods to set and get the full text content.
 */
export class EditorPane extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** The contenteditable container element. */
  #editor: HTMLDivElement | null = null;

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

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#editor,
    );
  }

  /**
   * Sets the editor content from a file's text.
   * Splits on newlines and creates one `<div>` per line.
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
}

customElements.define('editor-pane', EditorPane,);
