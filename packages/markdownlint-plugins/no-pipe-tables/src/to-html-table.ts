import type { ReadonlyToken, } from './token.ts';

/**
 * Cell token types that carry content (header and body cells), in column order
 * within their row.
 */
const CONTENT_CELL_TYPES = [
  'tableHeader',
  'tableData',
] as const;

/**
 * Column alignment keyword, or empty string when a column is unaligned.
 */
type Alignment = 'left' | 'right' | 'center' | '';

/**
 * Parameters for {@link childrenOfType}.
 */
type ChildrenOfTypeParams = {
  /** Parent token whose direct children are scanned. */
  readonly parent: ReadonlyToken;
  /** Accepted micromark types. */
  readonly types: readonly string[];
};

/**
 * Direct children whose type is one of `types`, in document order. Returns an
 * array (never `undefined`) so callers iterate or index instead of threading a
 * nullish through the type surface; an absent child is simply an empty result.
 *
 * @param parent - token whose direct children are scanned
 *
 * @param types - accepted micromark types
 *
 * @returns matching children in document order
 */
function childrenOfType({
  parent,
  types,
}: ChildrenOfTypeParams,): ReadonlyToken[] {
  /** Children collected so far, in document order. */
  const matches: ReadonlyToken[] = [];
  for (const child of parent.children) {
    if (types.includes(child.type,)) {
      matches.push(child,);
    }
  }
  return matches;
}

/**
 * Trimmed text of one table cell from its `tableContent` child. An empty cell
 * has no `tableContent`, so the loop runs zero times and the fallback is the
 * empty string. The table-only `\|` escape is resolved to a literal pipe because
 * pipes are not special inside the emitted HTML.
 *
 * @param cell - cell token (`tableHeader`, `tableData`, or `tableDelimiter`)
 *
 * @returns cell text ready for an HTML `<th>`/`<td>` body
 */
function cellText(cell: ReadonlyToken,): string {
  for (const content of childrenOfType({
    parent: cell,
    types: ['tableContent',],
  },)) {
    return content.text
      .split(String.raw`\|`,)
      .join('|',)
      .trim();
  }
  return '';
}

/**
 * Map one delimiter cell's text (`:---`, `--:`, `:--:`, `---`) to an HTML cell
 * alignment keyword.
 *
 * @param delimiterText - delimiter cell content
 *
 * @returns alignment keyword, or empty string when the column is unaligned
 */
function alignmentOf(delimiterText: string,): Alignment {
  if (delimiterText.startsWith(':',) && delimiterText.endsWith(':',)) {
    return 'center';
  }
  if (delimiterText.endsWith(':',)) {
    return 'right';
  }
  if (delimiterText.startsWith(':',)) {
    return 'left';
  }
  return '';
}

/**
 * Parameters for {@link cellLine}.
 */
type CellLineParams = {
  /** Element name. */
  readonly tag: 'th' | 'td';
  /** Cell text. */
  readonly text: string;
  /** Column alignment. */
  readonly align: Alignment;
};

/**
 * One HTML cell line, attaching `align` only when the column specifies it
 * (GitHub honours the attribute and it avoids inline CSS).
 *
 * @param tag - element name
 *
 * @param text - cell text
 *
 * @param align - column alignment
 *
 * @returns one `<th>`/`<td>` line
 */
function cellLine({
  tag,
  text,
  align,
}: CellLineParams,): string {
  if (align === '') {
    return `<${tag}>${text}</${tag}>`;
  }
  return `<${tag} align="${align}">${text}</${tag}>`;
}

/**
 * Per-column alignment keywords from a table's delimiter row. The nested loops
 * each iterate a single-occurrence child (`tableHead`, then `tableDelimiterRow`),
 * so absence yields an empty result without any nullish handling.
 *
 * @param table - token of type `table`
 *
 * @returns alignment per column, empty when the table has no header
 */
function columnAlignments(table: ReadonlyToken,): Alignment[] {
  /** Alignment per column, indexed left to right. */
  const alignments: Alignment[] = [];
  for (const head of childrenOfType({
    parent: table,
    types: ['tableHead',],
  },)) {
    for (const delimiterRow of childrenOfType({
      parent: head,
      types: ['tableDelimiterRow',],
    },)) {
      for (const cell of childrenOfType({
        parent: delimiterRow,
        types: ['tableDelimiter',],
      },)) {
        alignments.push(
          alignmentOf(cellText(cell,),),
        );
      }
    }
  }
  return alignments;
}

/**
 * Parameters for {@link rowCellLines}.
 */
type RowCellLinesParams = {
  /** Row token whose content cells are rendered. */
  readonly row: ReadonlyToken;
  /** Cell element name. */
  readonly tag: 'th' | 'td';
  /** Per-column alignment. */
  readonly alignments: readonly Alignment[];
};

/**
 * One table row's content cells as HTML cell lines.
 *
 * @param row - row token whose content cells are rendered
 *
 * @param tag - cell element name
 *
 * @param alignments - per-column alignment
 *
 * @returns `<th>`/`<td>` lines, one per cell
 */
function rowCellLines({
  row,
  tag,
  alignments,
}: RowCellLinesParams,): string[] {
  /** Content cells of this row, in column order. */
  const cells = childrenOfType({
    parent: row,
    types: CONTENT_CELL_TYPES,
  },);
  /** Rendered cell lines, one per content cell. */
  const lines: string[] = [];
  for (const [column, cell,] of cells.entries()) {
    lines.push(
      cellLine({
        tag,
        text: cellText(cell,),
        align: alignments[column] ?? '',
      },),
    );
  }
  return lines;
}

/**
 * Parameters shared by {@link headerLines} and {@link bodyLines}.
 */
type SectionParams = {
  /** Token of type `table`. */
  readonly table: ReadonlyToken;
  /** Per-column alignment, shared by header and body cells. */
  readonly alignments: readonly Alignment[];
};

/**
 * The `<thead>` block, or an empty array when the table has no header row.
 *
 * @param table - token of type `table`
 *
 * @param alignments - per-column alignment
 *
 * @returns `<thead>` block lines, empty when there is no header
 */
function headerLines({
  table,
  alignments,
}: SectionParams,): string[] {
  /** Header block lines accumulated across the (single) header row. */
  const lines: string[] = [];
  for (const head of childrenOfType({
    parent: table,
    types: ['tableHead',],
  },)) {
    for (const headerRow of childrenOfType({
      parent: head,
      types: ['tableRow',],
    },)) {
      lines.push(
        '<thead>',
        '<tr>',
        ...rowCellLines({
          row: headerRow,
          tag: 'th',
          alignments,
        },),
        '</tr>',
        '</thead>',
      );
    }
  }
  return lines;
}

/**
 * The `<tbody>` block, or an empty array when the table has no body rows. The
 * wrapper tags are added only when at least one row exists.
 *
 * @param table - token of type `table`
 *
 * @param alignments - per-column alignment
 *
 * @returns `<tbody>` block lines, empty when there are no body rows
 */
function bodyLines({
  table,
  alignments,
}: SectionParams,): string[] {
  /** Row lines, before the `<tbody>` wrapper is decided. */
  const rows: string[] = [];
  for (const body of childrenOfType({
    parent: table,
    types: ['tableBody',],
  },)) {
    for (const row of childrenOfType({
      parent: body,
      types: ['tableRow',],
    },)) {
      rows.push(
        '<tr>',
        ...rowCellLines({
          row,
          tag: 'td',
          alignments,
        },),
        '</tr>',
      );
    }
  }
  if (rows.length === 0) {
    return [];
  }
  return [
    '<tbody>',
    ...rows,
    '</tbody>',
  ];
}

/**
 * Convert one micromark pipe-table token into HTML `<table>` lines, one element
 * per line so cell content can later be edited across multiple lines (the whole
 * reason pipe tables are banned). Inline Markdown inside cells is emitted
 * verbatim; GitHub renders it, though strict CommonMark would not.
 *
 * @param table - token of type `table`
 *
 * @returns HTML block lines, no trailing newline
 *
 * @example
 * ```ts
 * toHtmlTable(tableToken); // ['<table>', '<thead>', ...]
 * ```
 */
export default function toHtmlTable(table: ReadonlyToken,): string[] {
  /** Per-column alignment, computed once and shared by both sections. */
  const alignments = columnAlignments(table,);
  return [
    '<table>',
    ...headerLines({
      table,
      alignments,
    },),
    ...bodyLines({
      table,
      alignments,
    },),
    '</table>',
  ];
}
