import type { ReadonlyDeep, } from 'type-fest';
import type {
  AlignType,
  Table,
  TableCell,
  TableRow,
} from 'mdast';

import { htmlTableCellText, } from './html-table-cell-text.ts';
import { sliceOf, } from './node-source.ts';

/**
 * Parameters for cell and row rendering, threading the original source so cell
 * content is recovered from its exact written form (preserving inline Markdown
 * markers like `**x**` literally, which `mdast-util-to-string` would strip).
 */
type CellContext = {
  /**
   * Original source the table was parsed from.
   */
  readonly source: string;
};

/**
 * Raw Markdown content of one table cell, with the surrounding pipe delimiters
 * and padding removed. mdast stores no verbatim cell text, so the content is
 * sliced from source between the cell's offsets; the leading `|` (every cell)
 * and a trailing `|` (only the row's last cell) are stripped, and
 * {@link htmlTableCellText} trims the remaining padding.
 *
 * @param cell - `tableCell` node
 *
 * @param source - original source the table was parsed from
 *
 * @returns raw cell content between its pipe delimiters
 */
function cellRawContent({
  cell,
  source,
}: ReadonlyDeep<CellContext & {
  readonly cell: TableCell;
}>,): string {
  /**
   * Cell source including its leading pipe and any padding.
   */
  const raw = sliceOf({
    node: cell,
    source,
  },);
  /**
   * Cell source after dropping the always-present leading pipe.
   */
  const withoutLeading = raw.startsWith('|',)
    ? raw.slice(1,)
    : raw;
  return withoutLeading.endsWith('|',)
    ? withoutLeading.slice(
      0,
      -1,
    )
    : withoutLeading;
}

/**
 * Column alignment keyword as an HTML attribute value, or empty string for an
 * unaligned column.
 *
 * @param align - mdast alignment for the column
 *
 * @returns alignment keyword, or empty string when unaligned
 */
function alignmentOf(align: AlignType,): string {
  return (align === null) || (align === undefined)
    ? ''
    : align;
}

/**
 * Parameters for {@link rowCellLines}.
 */
type RowCellLinesParams = CellContext & {
  /**
   * Row whose cells are rendered.
   */
  readonly row: TableRow;
  /**
   * Cell element name.
   */
  readonly tag: 'th' | 'td';
  /**
   * Per-column alignment.
   */
  readonly aligns: readonly AlignType[];
};

/**
 * One row's cells as HTML cell lines, attaching `align` only when the column
 * specifies it (GitHub honours the attribute and it avoids inline CSS).
 *
 * @param row - row whose cells are rendered
 *
 * @param tag - cell element name
 *
 * @param aligns - per-column alignment
 *
 * @param source - original source the table was parsed from
 *
 * @returns `<th>`/`<td>` lines, one per cell
 */
function rowCellLines({
  row,
  tag,
  aligns,
  source,
}: ReadonlyDeep<RowCellLinesParams>,): readonly string[] {
  return row.children
    .map(function cellLine(
      cell: ReadonlyDeep<TableCell>,
      column: number,
    ): string {
    /**
     * Escaped HTML text for this cell.
     */
    const text = htmlTableCellText(cellRawContent({
      cell,
      source,
    },),);
    /**
     * Alignment attribute value for this column.
     */
    const align = alignmentOf(aligns[column] ?? null,);
    return align === ''
      ? `<${tag}>${text}</${tag}>`
      : `<${tag} align="${align}">${text}</${tag}>`;
  },);
}

/**
 * Parameters for {@link toHtmlTable}.
 */
export type ToHtmlTableParams = CellContext & {
  /**
   * `table` node to render.
   */
  readonly table: Table;
};

/**
 * Convert one mdast `table` node into HTML `<table>` lines, one element per
 * line so cell content can later be edited across multiple lines (the whole
 * reason pipe tables are banned). The first row becomes `<thead>`; remaining
 * rows become `<tbody>`. Cell text is escaped for raw HTML text context;
 * inline Markdown markers that are not HTML-sensitive stay literal.
 *
 * @param table - `table` node to render
 *
 * @param source - original source the table was parsed from
 *
 * @returns HTML block lines, no trailing newline
 *
 * @example
 * ```ts
 * toHtmlTable({ table, source }); // ['<table>', '<thead>', ...]
 * ```
 */
export function toHtmlTable({
  table,
  source,
}: ReadonlyDeep<ToHtmlTableParams>,): readonly string[] {
  /**
   * Per-column alignment, shared by header and body cells.
   */
  const aligns: readonly AlignType[] = table.align ?? [];
  /**
   * Header row (the first row), if any.
   */
  const [headerRow, ...bodyRows] = table.children;
  /**
   * `<thead>` block lines, empty when the table has no rows.
   */
  const headLines = headerRow === undefined
    ? []
    : [
      '<thead>',
      '<tr>',
      ...rowCellLines({
        row: headerRow,
        tag: 'th',
        aligns,
        source,
      },),
      '</tr>',
      '</thead>',
    ];
  /**
   * `<tbody>` block lines, empty when the table has no body rows.
   */
  const bodyLines = bodyRows.length === 0
    ? []
    : [
      '<tbody>',
      ...bodyRows.flatMap(function bodyRowLines(row: ReadonlyDeep<TableRow>,): readonly string[] {
        return [
          '<tr>',
          ...rowCellLines({
            row,
            tag: 'td',
            aligns,
            source,
          },),
          '</tr>',
        ];
      },),
      '</tbody>',
    ];
  return [
    '<table>',
    ...headLines,
    ...bodyLines,
    '</table>',
  ];
}
