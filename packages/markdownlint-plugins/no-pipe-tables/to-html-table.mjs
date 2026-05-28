// @ts-check

/** @typedef {import('markdownlint').MicromarkToken} MicromarkToken */

/**
 * Cell token types that carry content (header and body cells), in column order
 * within their row.
 */
const CONTENT_CELL_TYPES = ['tableHeader', 'tableData'];

/**
 * Return first direct child of one micromark type, or undefined when absent.
 *
 * @param {{ parent: MicromarkToken, type: string }} input Parent token plus
 *   micromark type to match.
 * @returns {MicromarkToken | undefined} Matching child, if present.
 */
function firstChildOfType({ parent, type }) {
  for (const child of parent.children) {
    if (child.type === type) {
      return child;
    }
  }
  return undefined;
}

/**
 * Collect direct children whose type is one of `types`, preserving order.
 *
 * @param {{ parent: MicromarkToken, types: readonly string[] }} input Parent
 *   token plus accepted micromark types.
 * @returns {MicromarkToken[]} Matching children in document order.
 */
function childrenOfType({ parent, types }) {
  const matches = [];
  for (const child of parent.children) {
    if (types.includes(child.type)) {
      matches.push(child);
    }
  }
  return matches;
}

/**
 * Extract trimmed text of one table cell from its `tableContent` child. The
 * table-only `\\|` escape is resolved to a literal pipe because pipes are not
 * special inside the emitted HTML.
 *
 * @param {MicromarkToken} cell Cell token (`tableHeader`, `tableData`, or
 *   `tableDelimiter`).
 * @returns {string} Cell text ready for an HTML `<th>`/`<td>` body.
 */
function cellText(cell) {
  const content = firstChildOfType({ parent: cell, type: 'tableContent' });
  const raw = content === undefined ? '' : content.text;
  return raw.split('\\|').join('|').trim();
}

/**
 * Map one delimiter cell's text (`:---`, `--:`, `:--:`, `---`) to an HTML cell
 * alignment keyword, or empty string when the column is unaligned.
 *
 * @param {string} delimiterText Delimiter cell content.
 * @returns {'left' | 'right' | 'center' | ''} Alignment keyword.
 */
function alignmentOf(delimiterText) {
  const leadingColon = delimiterText.startsWith(':');
  const trailingColon = delimiterText.endsWith(':');
  if (leadingColon && trailingColon) {
    return 'center';
  }
  if (trailingColon) {
    return 'right';
  }
  if (leadingColon) {
    return 'left';
  }
  return '';
}

/**
 * Render one HTML cell line, attaching `align` only when the column specifies
 * it (GitHub honours the attribute and it avoids inline CSS).
 *
 * @param {{ tag: 'th' | 'td', text: string, align: 'left' | 'right' | 'center' | '' }} input
 *   Element name, cell text, and column alignment.
 * @returns {string} One `<th>`/`<td>` line.
 */
function cellLine({ tag, text, align }) {
  const attribute = align === '' ? '' : ` align="${align}"`;
  return `<${tag}${attribute}>${text}</${tag}>`;
}

/**
 * Read per-column alignment keywords from a table's delimiter row.
 *
 * @param {MicromarkToken | undefined} delimiterRow `tableDelimiterRow` token, if
 *   present.
 * @returns {Array<'left' | 'right' | 'center' | ''>} Alignment per column.
 */
function columnAlignments(delimiterRow) {
  if (delimiterRow === undefined) {
    return [];
  }
  const alignments = [];
  for (const cell of childrenOfType({ parent: delimiterRow, types: ['tableDelimiter'] })) {
    alignments.push(alignmentOf(cellText(cell)));
  }
  return alignments;
}

/**
 * Render one table row's cells as HTML cell lines.
 *
 * @param {{ row: MicromarkToken, tag: 'th' | 'td', alignments: ReadonlyArray<'left' | 'right' | 'center' | ''> }} input
 *   Row token, cell element name, and per-column alignment.
 * @returns {string[]} `<th>`/`<td>` lines, one per cell.
 */
function rowCellLines({ row, tag, alignments }) {
  const lines = [];
  for (const [column, cell] of childrenOfType({ parent: row, types: CONTENT_CELL_TYPES }).entries()) {
    lines.push(cellLine({ tag, text: cellText(cell), align: alignments[column] ?? '' }));
  }
  return lines;
}

/**
 * Convert one micromark pipe-table token into HTML `<table>` lines, one element
 * per line so cell content can later be edited across multiple lines (the whole
 * reason pipe tables are banned). Inline Markdown inside cells is emitted
 * verbatim; GitHub renders it, though strict CommonMark would not.
 *
 * @param {MicromarkToken} table Token of type `table`.
 * @returns {string[]} HTML block lines, no trailing newline.
 */
export default function toHtmlTable(table) {
  const head = firstChildOfType({ parent: table, type: 'tableHead' });
  const body = firstChildOfType({ parent: table, type: 'tableBody' });
  const headerRow = head === undefined ? undefined : firstChildOfType({ parent: head, type: 'tableRow' });
  const delimiterRow = head === undefined
    ? undefined
    : firstChildOfType({ parent: head, type: 'tableDelimiterRow' });
  const alignments = columnAlignments(delimiterRow);

  const lines = ['<table>'];

  if (headerRow !== undefined) {
    lines.push('<thead>', '<tr>', ...rowCellLines({ row: headerRow, tag: 'th', alignments }), '</tr>', '</thead>');
  }

  const bodyRows = body === undefined ? [] : childrenOfType({ parent: body, types: ['tableRow'] });
  if (bodyRows.length > 0) {
    lines.push('<tbody>');
    for (const row of bodyRows) {
      lines.push('<tr>', ...rowCellLines({ row, tag: 'td', alignments }), '</tr>');
    }
    lines.push('</tbody>');
  }

  lines.push('</table>');
  return lines;
}
