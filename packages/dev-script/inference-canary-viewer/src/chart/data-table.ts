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
  /** Run ID for linking to the detail overlay (used in grid mode) */
  readonly runId?: string | undefined;
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

  /** When only timestamp + score remain, render as a compact grid instead of a table */
  if (!showModel && !showProbe) {
    return renderDataGrid(rows, caption);
  }

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
 * Renders a compact card grid for timestamp + score data.
 *
 * Used when both Model and Probe columns are hidden, leaving only two
 * data fields per row. Cards display timestamp on top, score below,
 * matching the probe grid layout in run detail overlays.
 * @param rows - data rows to render
 * @param caption - accessible caption
 * @returns HTML string
 *
 * @example
 * ```ts
 * const html = renderDataGrid(rows, 'Claude overall score');
 * // '<div class="data-grid" role="list" aria-label="...">...<\/div>'
 * ```
 */
function renderDataGrid(
  rows: readonly TableRow[],
  caption: string,
): string {
  /** Show fix scores when at least one row has pass-2 data */
  const hasFixScores = rows.some((row) => row.pass2Score !== undefined);

  const cards = rows.map((row) => {
    const timestamp = escapeHtml(row.timestamp);
    const failedSuffix = row.failed ? ' <span class="status--failed">(timeout)</span>' : '';
    const score = row.score.toFixed(2);

    /** Warn when fix data is missing for this row but exists elsewhere */
    const fixSuffix = hasFixScores
      ? row.pass2Score !== undefined
        ? ` (fix: ${row.pass2Score.toFixed(2)})`
        : ' <span class="data-warning">(fix: no data)</span>'
      : '';

    const tag = row.runId !== undefined ? 'button' : 'div';
    const popoverAttr = row.runId !== undefined ? ` popovertarget="run-${escapeHtml(row.runId)}"` : '';

    return `<${tag} class="data-card"${popoverAttr} role="listitem"${row.failed ? ' data-failed' : ''}>
  <span>${timestamp}${failedSuffix}</span>
  <span><strong>${score}</strong>${fixSuffix}</span>
</${tag}>`;
  }).join('\n');

  return `<div class="data-grid" role="list" aria-label="${escapeHtml(caption)}">
  ${cards}
</div>`;
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
