/**
 * Overview section: all-models scatter chart and summary table.
 *
 * Shows a combined scatter chart with every model's overall score over time,
 * where each point is clickable to open the run detail overlay.
 * Below the chart, a summary table lists each model's latest status.
 */
import { renderScatterChart, } from '../chart/scatter.ts';
import type { ScatterPoint, } from '../chart/scatter.ts';
import { escapeHtml, } from '../chart/data-table.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';
import { SHAPE_LEGEND, } from '../chart/legend.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

/** Aggregated model summary for the overview table */
export type ModelSummary = {
  readonly model: string;
  readonly label: string;
  readonly latestScore: number;
  readonly latestTimestamp: string;
  readonly runCount: number;
  readonly failed: boolean;
  readonly threshold: number;
  readonly degraded: boolean;
};

/**
 * Renders the overview section with a scatter chart of all models and a summary table.
 * @param summaries - per-model summaries sorted by model name
 * @param entries - all history entries (for the combined chart)
 * @returns HTML string
 */
export function renderOverview(summaries: readonly ModelSummary[], entries: readonly ViewerEntry[]): string {
  if (summaries.length === 0) {
    return '<p>No history data available. Run the canary first.</p>';
  }

  // Combined scatter chart: all models' overall scores
  const chartPoints = buildAllModelPoints(entries, summaries);
  const legend = buildLegend(summaries);
  const chart = renderScatterChart(chartPoints, 0, '', 'All models overall score', { hideTable: true, });

  // Summary table — status is shown inline rather than in its own column
  const rows = summaries.map((summary) => {
    const color = vendorColor(summary.model);
    const statusClass = summary.failed ? 'status--failed' : summary.degraded ? 'status--degraded' : '';
    const inlineStatus = summary.failed
      ? ' <span class="status--failed">(timeout)</span>'
      : summary.degraded
        ? ' <span class="status--degraded">(degraded)</span>'
        : '';

    return `<tr${statusClass !== '' ? ` class="${statusClass}"` : ''}>
  <td>${iconDot(summary.model, color)} ${escapeHtml(summary.label)}</td>
  <td>${summary.latestScore.toFixed(2)}${inlineStatus}</td>
  <td>${escapeHtml(summary.latestTimestamp.slice(0, 10))}</td>
  <td>${String(summary.runCount)}</td>
  <td>${summary.threshold.toFixed(2)}</td>
</tr>`;
  }).join('\n');

  return `${legend}
${SHAPE_LEGEND}
${chart}
<h3>Summary</h3>
<table class="overview-table">
  <thead>
    <tr>
      <th scope="col">Model</th>
      <th scope="col">Score</th>
      <th scope="col">Last run</th>
      <th scope="col">Runs</th>
      <th scope="col">Threshold</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`;
}

/**
 * Builds scatter points for all models' overall scores, ordered by timestamp.
 * @param entries - all history entries
 * @param summaries - model summaries (for labels)
 * @returns scatter points array
 */
function buildAllModelPoints(
  entries: readonly ViewerEntry[],
  summaries: readonly ModelSummary[],
): readonly ScatterPoint[] {
  return entries.filter((entry) => entry.overallScore > 0).map((entry, index) => {
    const color = vendorColor(entry.model);
    const runId = `${entry.label}-${entry.timestamp}`;
    const tableRow = {
      timestamp: entry.timestamp,
      model: entry.label,
      probe: 'overall',
      score: entry.overallScore,
      failed: entry.failed,
    };
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score: entry.overallScore,
      color,
      icon: vendorIcon(entry.model),
      title: `${entry.label} ${entry.timestamp.slice(0, 10)}: ${entry.overallScore.toFixed(2)}`,
      failed: entry.failed,
      tableRow,
    };
  });
}

/**
 * Renders a color legend for the overview chart.
 * @param summaries - model summaries
 * @returns HTML legend string
 */
function buildLegend(summaries: readonly ModelSummary[]): string {
  const items = summaries.map((s) => {
    const color = vendorColor(s.model);
    return `<span class="legend-item">${iconDot(s.model, color)} ${escapeHtml(s.label)}</span>`;
  }).join('\n');

  return `<div class="chart-legend">${items}</div>`;
}
