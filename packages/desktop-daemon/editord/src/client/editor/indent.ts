/**
 * Indent and unindent operations for the contenteditable editor.
 *
 * Operates on line div elements, prepending or removing
 * leading whitespace. Returns adjusted cursor/selection coordinates.
 */

import { INDENT_UNIT, } from './text-resolve.ts';

/** Selection range coordinates for indent adjustment. */
export type SelectionCoords = {
  /** 0-based start line index. */
  startLine: number;
  /** 0-based start character offset. */
  startCharacter: number;
  /** 0-based end line index. */
  endLine: number;
  /** 0-based end character offset. */
  endCharacter: number;
};

/** Result of an indent/unindent operation. */
export type IndentResult = {
  /** Whether a selection range should be restored (vs a single cursor). */
  isSelection: boolean;
  /** Selection coordinates when `isSelection` is true. */
  selection: SelectionCoords;
  /** Cursor coordinates when `isSelection` is false. */
  cursor: {
    line: number;
    character: number;
  };
};

/**
 * Indents lines by prepending {@link INDENT_UNIT}.
 *
 * @param editor - contenteditable container element
 *
 * @param cursorLine - current cursor line index
 *
 * @param cursorCharacter - current cursor character offset
 *
 * @param selection - non-collapsed selection, or null for single cursor
 *
 * @returns adjusted cursor/selection coordinates
 */
export function indentLines({
  editor,
  cursorLine,
  cursorCharacter,
  selection,
}: {
  editor: HTMLDivElement;
  cursorLine: number;
  cursorCharacter: number;
  selection: SelectionCoords | null;
},): IndentResult {
  const startLine = selection !== null ? selection.startLine : cursorLine;
  const endLine = selection !== null ? selection.endLine : cursorLine;

  for (let i = startLine; i <= endLine; i++) {
    const lineDiv = editor.children[i];
    if (lineDiv === undefined)
      continue;
    const text = lineDiv.textContent;
    lineDiv.textContent = text === '\n' ? INDENT_UNIT : INDENT_UNIT + text;
  }

  if (selection !== null) {
    return {
      isSelection: true,
      selection: {
        startLine: selection.startLine,
        startCharacter: selection.startCharacter + INDENT_UNIT.length,
        endLine: selection.endLine,
        endCharacter: selection.endCharacter + INDENT_UNIT.length,
      },
      cursor: {
        line: cursorLine,
        character: cursorCharacter,
      },
    };
  }

  return {
    isSelection: false,
    selection: {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },
    cursor: {
      line: cursorLine,
      character: cursorCharacter + INDENT_UNIT.length,
    },
  };
}

/**
 * Unindents lines by removing up to {@link INDENT_UNIT} leading spaces.
 *
 * @param editor - contenteditable container element
 *
 * @param cursorLine - current cursor line index
 *
 * @param cursorCharacter - current cursor character offset
 *
 * @param selection - non-collapsed selection, or null for single cursor
 *
 * @returns adjusted cursor/selection coordinates
 */
export function unindentLines({
  editor,
  cursorLine,
  cursorCharacter,
  selection,
}: {
  editor: HTMLDivElement;
  cursorLine: number;
  cursorCharacter: number;
  selection: SelectionCoords | null;
},): IndentResult {
  const startLine = selection !== null ? selection.startLine : cursorLine;
  const endLine = selection !== null ? selection.endLine : cursorLine;

  /** Track spaces removed per line for cursor/selection adjustment. */
  const removedPerLine: number[] = [];

  for (let i = startLine; i <= endLine; i++) {
    const lineDiv = editor.children[i];
    if (lineDiv === undefined) {
      removedPerLine.push(0,);
      continue;
    }
    const text = lineDiv.textContent;
    if (text === '\n') {
      removedPerLine.push(0,);
      continue;
    }

    let count = 0;
    if (text.startsWith('  ',))
      count = 2;
    else if (text.startsWith(' ',))
      count = 1;

    if (count > 0) {
      const newText = text.slice(count,);
      lineDiv.textContent = newText === '' ? '\n' : newText;
    }
    removedPerLine.push(count,);
  }

  if (selection !== null) {
    const [startRemoved = 0,] = removedPerLine;
    const endRemoved = removedPerLine.at(-1,) ?? 0;
    return {
      isSelection: true,
      selection: {
        startLine: selection.startLine,
        startCharacter: Math.max(
          0,
          selection.startCharacter - startRemoved,
        ),
        endLine: selection.endLine,
        endCharacter: Math.max(
          0,
          selection.endCharacter - endRemoved,
        ),
      },
      cursor: {
        line: cursorLine,
        character: cursorCharacter,
      },
    };
  }

  const lineRemoved = removedPerLine[0] ?? 0;
  return {
    isSelection: false,
    selection: {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },
    cursor: {
      line: cursorLine,
      character: Math.max(
        0,
        cursorCharacter - lineRemoved,
      ),
    },
  };
}
