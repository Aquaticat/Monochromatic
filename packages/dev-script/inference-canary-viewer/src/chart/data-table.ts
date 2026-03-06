/**
 * Accessible backing `<table>` for each scatter chart.
 *
 * Provides the same data as the visual chart in a machine-readable,
 * screen-reader-navigable format.
 */

/** Single data point for the table */
export type TableRow = {
  readonly timestamp: string;
  readonly model: string;
  readonly probe: string;
  readonly score: number;
  readonly pass2Score?: number | undefined;
  readonly failed: boolean;
};

/**
 * Controls which columns are visible in the data table.
 * Columns default to visible when the option is omitted.
 */
export type TableDisplayOptions = {
  /** Whether to show the Model column (hide when context is per-model) */
  readonly showModel?: boolean;
  /** Whether to show the Probe column (hide when context is per-probe) */
  readonly showProbe?: boolean;
};

/**
 * Renders a `<table>` element containing chart data.
 * Hidden visually but accessible to screen readers and present
 * when CSS fails to load.
 *
 * Status is shown inline: "(timeout)" is appended to the timestamp cell
 * for failed runs instead of occupying its own column.
 * Missing fix scores are shown as "(data error)" when fix scores exist
 * for other rows.
 * @param rows - data rows to render
 * @param caption - table caption describing the chart
 * @param options - column visibility overrides
 * @returns HTML string
 */
export function renderDataTable(
  rows: readonly TableRow[],
  caption: string,
  options: TableDisplayOptions = {},
): string {
  const showModel = options.showModel ?? true;
  const showProbe = options.showProbe ?? true;

  /** Only show the fix score column when at least one row has pass2 data */
  const hasFixScores = rows.some((row) => row.pass2Score !== undefined);

  const headerRow = `<tr>
  <th scope="col">Timestamp</th>
  ${showModel ? '<th scope="col">Model</th>' : ''}
  ${showProbe ? '<th scope="col">Probe</th>' : ''}
  <th scope="col">Score</th>
  ${hasFixScores ? '<th scope="col">Fix score</th>' : ''}
</tr>`;

  const bodyRows = rows.map((row) => {
    /** Append "(timeout)" inline when the run failed */
    const timestampCell = row.failed
      ? `${escapeHtml(row.timestamp)} <span class="status--failed">(timeout)</span>`
      : escapeHtml(row.timestamp);

    /** Show "(data error)" when fix scores exist for some rows but not this one */
    const fixScoreCell = hasFixScores
      ? row.pass2Score !== undefined
        ? row.pass2Score.toFixed(2)
        : '<span class="data-error">(data error)</span>'
      : '';

    return `<tr${row.failed ? ' class="status--failed"' : ''}>
  <td>${timestampCell}</td>
  ${showModel ? `<td>${escapeHtml(row.model)}</td>` : ''}
  ${showProbe ? `<td>${escapeHtml(row.probe)}</td>` : ''}
  <td>${row.score.toFixed(2)}</td>
  ${hasFixScores ? `<td>${fixScoreCell}</td>` : ''}
</tr>`;
  }).join('\n');

  return `<table class="chart-data-table">
  <caption>${escapeHtml(caption)}</caption>
  <thead>${headerRow}</thead>
  <tbody>${bodyRows}</tbody>
</table>`;
}

/**
 * Escapes HTML special characters to prevent injection.
 * @param str - raw string
 * @returns escaped string safe for HTML content
 */
export function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
