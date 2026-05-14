/**
 * Auto-indent logic for Enter key in the contenteditable editor.
 *
 * Listens for `insertParagraph` input events (browser-native Enter)
 * and inserts leading whitespace on the new line to match the
 * previous line's indentation. Increases indent by one level
 * when the previous line ends with an opening bracket.
 */

import { getCursorPosition, } from './cursor.ts';
import { INDENT_UNIT, } from './text-resolve.ts';

/** Characters that trigger an extra indent level on the next line. */
const OPENING_BRACKETS = new Set([
  '{',
  '(',
  '[',
],);

/**
 * Computes the indentation string for a newly created line.
 *
 * Matches the previous line's leading whitespace, then adds
 * one {@link INDENT_UNIT} if the line (trimmed end) ends
 * with an opening bracket.
 *
 * @param lineText - text content of the previous line
 * (already split by the browser at the cursor position)
 *
 * @returns whitespace string to prepend to the new line
 *
 * @example
 * ```ts
 * const indent = computeIndent({ lineText: '  if (true) {', });
 * // indent === '    '
 * ```
 */
export function computeIndent({ lineText, }: { lineText: string; },): string {
  /** Regex match capturing the leading spaces; null only when the regex itself fails. */
  const match = /^( *)/.exec(lineText,);
  /** Whitespace at the start of the previous line; carried over to align the new line. */
  const baseIndent = match?.[1] ?? '';
  /** Line text with trailing whitespace stripped; needed to inspect the meaningful last char. */
  const trimmed = lineText.trimEnd();
  /** Final non-whitespace char of the previous line; decides whether to add a deeper indent. */
  const lastChar = trimmed.at(-1,) ?? '';
  if (OPENING_BRACKETS.has(lastChar,))
    return baseIndent + INDENT_UNIT;
  return baseIndent;
}

/**
 * Creates an `input` event listener that auto-indents after Enter.
 *
 * When the browser fires an `insertParagraph` input event
 * (native Enter in contenteditable), the handler reads the
 * previous line's text, computes the correct indentation,
 * and inserts it at the cursor via `execCommand('insertText')`.
 *
 * @param editor - contenteditable container element
 *
 * @param shadow - shadow root for composed selection resolution
 *
 * @returns event listener to attach to the editor's `input` event
 *
 * @example
 * ```ts
 * editor.addEventListener('input', createAutoIndentHandler({ editor, shadow, }));
 * ```
 */
export function createAutoIndentHandler({
  editor,
  shadow,
}: {
  editor: HTMLDivElement;
  shadow: ShadowRoot;
},): EventListener {
  return function handleAutoIndent(event: Event,): void {
    if (!(event instanceof InputEvent))
      return;
    if (event.inputType !== 'insertParagraph')
      return;

    /** Resolve cursor position inside the shadow DOM. */
    const pos = getCursorPosition({
      editor,
      shadow,
    },);
    if (pos === null || pos.line === 0)
      return;

    /** Previous line div contains the text that was before the cursor. */
    const prevDiv = editor.children[pos.line - 1];
    if (prevDiv === undefined)
      return;

    /** Raw text content of the previous line div; empty string when missing. */
    const prevText = prevDiv.textContent ?? '';
    /** Empty lines store `'\n'` as a height-preserving marker. */
    const lineText = prevText === '\n' ? '' : prevText;
    /** Whitespace string to prepend so the new line aligns with (or under) the previous line. */
    const indent = computeIndent({ lineText, },);

    if (indent !== '') {
      // Undo grouping: the W3C execCommand spec defers undo/redo definition entirely,
      // and Blink's Editor.cpp suggests separate execCommand calls create separate undo
      // entries (each CompositeEditCommand registers its own UndoStep). Despite this,
      // Chromium empirically groups the native insertParagraph and this execCommand
      // into a single undo entry: one Ctrl+Z undoes both. The grouping mechanism
      // is undocumented; it may be TypingCommand consolidation or user-gesture scoping.
      // oxlint-disable-next-line typescript-eslint/no-deprecated -- execCommand is the only way to insert text while preserving the browser's native undo stack
      document.execCommand(
        'insertText',
        false,
        indent,
      );
    }
  };
}
