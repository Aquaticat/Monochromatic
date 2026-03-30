/**
 * DOM helper functions for `EditorPane`.
 *
 * Extracted from the class to keep `editor-pane.ts` under the max-lines limit.
 * Handles editor element creation, text content serialization, and scrolling.
 */

import { $ as h, } from '@monochromatic-dev/module-es/h-dom';

//region Editor element creation

/**
 * Creates the contenteditable editor div with a paste-to-plain-text handler.
 *
 * @returns editor div element ready to be inserted into the shadow DOM
 */
export function createEditorElement(): HTMLDivElement {
  const editor = h({
    tag: 'div',
    class: 'editor',
    attrs: {
      contenteditable: 'true',
      spellcheck: 'false',
    },
  },);
  editor.addEventListener(
    'paste',
    function handlePaste(event,) {
      event.preventDefault();
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text while preserving the browser's native undo stack
      document.execCommand(
        'insertText',
        false,
        event.clipboardData?.getData('text/plain',) ?? '',
      );
    },
  );
  return editor;
}

//endregion Editor element creation

//region Text content

/**
 * Replaces the editor's children with one div per line.
 *
 * @param editor - contenteditable container element
 *
 * @param text - full file content to render
 */
export function setTextContent({
  editor,
  text,
}: {
  editor: HTMLDivElement;
  text: string;
},): void {
  editor.replaceChildren(
    ...text.split('\n',).map(function createLineDiv(line,) {
      return h({
        tag: 'div',
        text: line === '' ? '\n' : line,
      },);
    },),
  );
}

/**
 * Reads the full text content from the editor's line divs.
 *
 * @param editor - contenteditable container element
 *
 * @returns joined text content with newline separators
 */
export function getTextContent({ editor, }: { editor: HTMLDivElement; },): string {
  return [...editor.children,]
    .map(function readLine(child,) {
      // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- defensive: textContent is null for Document/DocumentType nodes per spec
      const t = child.textContent ?? '';
      return t === '\n' ? '' : t;
    },)
    .join('\n',);
}

//endregion Text content

//region Scrolling

/**
 * Scrolls a 1-based line number into the center of the viewport.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 1-based line number to scroll to
 */
export function scrollLineIntoView({
  editor,
  line,
}: {
  editor: HTMLDivElement;
  line: number;
},): void {
  const child = editor.children[
    Math.max(
      0,
      Math.min(
        line - 1,
        editor.children.length - 1,
      ),
    )
  ];
  if (child !== undefined)
    child.scrollIntoView({ block: 'center', },);
}

//endregion Scrolling
