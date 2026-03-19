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
import {
  $,
  cssCh,
  cssLh,
  cssNum,
  cssInt,
  cssPercent,
  cssRem,
  cssVar,
  type CssValue,
} from '@monochromatic-dev/module-es/h-css';

export {};

/** Shadow DOM styles for the editor pane. */
const STYLES = [
  $({
    rule: ':host',
    decls: {
      display: 'block',
      flex: '1',
      overflow: 'auto',
    },
  },),
  $({
    rule: '.editor',
    decls: {
      'min-block-size': cssPercent(100,),
      'padding-block': cssVar('editor-padding',),
      'padding-inline': cssVar('editor-padding',),
      outline: 'none',
      'white-space': 'pre-wrap',
      'overflow-wrap': 'break-word',
      'font-family': "'JetBrains Mono', monospace" as CssValue,
      'font-size': cssRem(1,),
      'line-height': cssNum(1.5,),
      'tab-size': cssInt(2,),
      color: cssVar('fg',),
      'caret-color': cssVar('fg',),
      'counter-reset': 'line' as CssValue,
    },
  },),
  $({
    rule: '.editor > div',
    decls: {
      'min-block-size': cssLh(1,),
      'counter-increment': 'line' as CssValue,
      position: 'relative',
      'padding-inline-start': cssCh(6,),
    },
  },),
  $({
    rule: '.editor > div::before',
    decls: {
      content: 'counter(line)' as CssValue,
      position: 'absolute',
      'inset-inline-start': cssInt(0,),
      'inset-block-start': cssInt(0,),
      'inline-size': cssCh(5,),
      'text-align': 'end',
      color: cssVar('gutter-fg',),
      'user-select': 'none',
      'pointer-events': 'none',
    },
  },),
].join('',);

/**
 * `<editor-pane>` — contenteditable text editor component.
 *
 * Each line of the file is a child `<div>` of the contenteditable container.
 * The component exposes methods to set and get the full text content.
 */
class EditorPane extends HTMLElement {
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
      // execCommand preserves the browser's native undo stack
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

    const lines = text.split('\n',);
    const lineElements = lines.map(function createLineDiv(line,) {
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

    const lines: string[] = [];
    for (const child of this.#editor.children) {
      const text = child.textContent ?? '';
      lines.push(text === '\n' ? '' : text,);
    }

    return lines.join('\n',);
  }
}

customElements.define('editor-pane', EditorPane,);
