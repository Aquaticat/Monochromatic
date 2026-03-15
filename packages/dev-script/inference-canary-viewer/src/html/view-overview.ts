/**
 * Overview section: all-models scatter chart and summary table.
 *
 * Shows a combined scatter chart with every model's overall score over time,
 * where each point is clickable to open the run detail overlay.
 * Below the chart, a summary table lists each model's latest status.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { renderScatterChart, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, } from '../data/model-icons.ts';
import { SHAPE_LEGEND, } from '../chart/legend.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

import { buildAllModelPoints, buildOverviewLegend, } from './view-overview-builders.ts';

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
 * Resolves a model summary to its status level data attribute value.
 *
 * @param summary - model summary to check
 *
 * @returns "failed", "degraded", or empty string for healthy models
 */
function statusLevel(summary: ModelSummary): string {
  if (summary.failed) return 'failed';
  if (summary.degraded) return 'degraded';
  return '';
}

/**
 * Renders the overview section with a scatter chart of all models and a summary table.
 *
 * @param summaries - per-model summaries sorted by model name
 *
 * @param entries - all history entries (for the combined chart)
 *
 * @returns HTML string
 */
export function renderOverview({ summaries, entries, }: {
  summaries: readonly ModelSummary[];
  entries: readonly ViewerEntry[];
}): string {
  if (summaries.length === 0) {
    return h({ tag: 'p', text: 'No history data available. Run the canary first.', });
  }

  // Combined scatter chart: all models' overall scores
  const chartPoints = buildAllModelPoints(entries);
  const legend = buildOverviewLegend(summaries);
  const chart = renderScatterChart({ points: chartPoints, threshold: 0, thresholdLabel: '', caption: 'All models overall score', hideTable: true, });

  // Summary table — status is shown inline rather than in its own column
  const rows = summaries.map(function buildRow(summary): string {
    const color = vendorColor(summary.model);
    /** Data attribute value for row-level status styling */
    const statusClass = statusLevel(summary);

    const inlineStatus = summary.failed
      ? ` ${h({ tag: 'span', class: 'run-status', attrs: { 'data-level': 'failed', }, text: '(timeout)', })}`
      : (summary.degraded
        ? ` ${h({ tag: 'span', class: 'run-status', attrs: { 'data-level': 'degraded', }, text: '(degraded)', })}`
        : '');

    return h({
      tag: 'tr',
      ...(statusClass !== '' ? { class: 'run-status', attrs: { 'data-level': statusClass, }, } : {}),
      children: [
        h({
          tag: 'td',
          children: [iconDot(summary.model, color), ' ', h({ tag: 'span', text: summary.label, })],
        }),
        h({ tag: 'td', html: summary.latestScore.toFixed(2) + inlineStatus, }),
        h({ tag: 'td', text: summary.latestTimestamp.slice(0, 10), }),
        h({ tag: 'td', text: String(summary.runCount), }),
        h({ tag: 'td', text: summary.threshold.toFixed(2), }),
      ],
    });
  }).join('\n');

  return [
    legend,
    SHAPE_LEGEND,
    chart,
    h({ tag: 'h3', text: 'Summary', }),
    h({
      tag: 'table',
      class: 'overview-table',
      children: [
        h({
          tag: 'thead',
          children: [
            h({
              tag: 'tr',
              children: [
                h({ tag: 'th', attrs: { scope: 'col', }, text: 'Model', }),
                h({ tag: 'th', attrs: { scope: 'col', }, text: 'Score', }),
                h({ tag: 'th', attrs: { scope: 'col', }, text: 'Last run', }),
                h({ tag: 'th', attrs: { scope: 'col', }, text: 'Runs', }),
                h({ tag: 'th', attrs: { scope: 'col', }, text: 'Threshold', }),
              ],
            }),
          ],
        }),
        h({ tag: 'tbody', html: rows, }),
      ],
    }),
  ].join('\n');
}
