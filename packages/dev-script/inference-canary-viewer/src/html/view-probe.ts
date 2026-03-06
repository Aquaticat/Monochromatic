/**
 * Per-probe view: compares all models on the same probe.
 *
 * Each probe gets a `<details>` section containing a combined scatter chart
 * where each model's points use its vendor color, plus a per-model breakdown
 * with individual charts.
 */
import { renderScatterChart, } from '../chart/scatter.ts';
import type { ScatterPoint, } from '../chart/scatter.ts';
import { escapeHtml, } from '../chart/data-table.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';

import type { HistoryEntry, } from '../data/read-history.ts';

/**
 * Renders the by-probe view: one `<details>` per probe, with all models overlaid
 * and a per-model breakdown nested inside.
 * @param entries - all history entries
 * @param modelLabels - map from model ID to display label
 * @returns HTML string
 */
export function renderByProbe(
  entries: readonly HistoryEntry[],
  modelLabels: ReadonlyMap<string, string>,
): string {
  /** All unique probe names across all entries */
  const probeNames = [...new Set(entries.flatMap((entry) => Object.keys(entry.probeScores)))];

  if (probeNames.length === 0) {
    return '<p>No probe data available.</p>';
  }

  return probeNames.map((probe) => {
    const points = buildCrossModelPoints(entries, probe, modelLabels);
    const legend = buildLegend(entries, modelLabels);

    // Per-model breakdown within this probe
    const modelIds = [...new Set(entries.filter((entry) => probe in entry.probeScores).map((entry) => entry.model))];
    const modelBreakdown = modelIds.map((modelId) => {
      const label = modelLabels.get(modelId) ?? modelId;
      const color = vendorColor(modelId);
      const modelPoints = buildSingleModelPoints(entries, probe, modelId, color);
      return `<details class="model-section">
  <summary class="model-tab">${iconDot(modelId, color)} ${escapeHtml(label)}</summary>
  ${renderScatterChart(modelPoints, 0, '', `${probe} - ${label}`, { tableDisplay: { showModel: false, showProbe: false, }, })}
</details>`;
    }).join('\n');

    return `<details class="probe-section">
  <summary class="probe-tab">${escapeHtml(probe)}</summary>
  <div class="probe-content">
    ${legend}
    ${renderScatterChart(points, 0, '', `${probe} - all models`, { tableDisplay: { showProbe: false, }, })}
    <h3>Per-model breakdown</h3>
    ${modelBreakdown}
  </div>
</details>`;
  }).join('\n');
}

/**
 * Builds scatter points for one probe across all models.
 *
 * Points are interleaved by timestamp order so the X axis represents
 * chronological run index across all models.
 * @param entries - all history entries
 * @param probe - probe name to filter on
 * @param modelLabels - display labels per model
 * @returns scatter points sorted by timestamp
 */
function buildCrossModelPoints(
  entries: readonly HistoryEntry[],
  probe: string,
  modelLabels: ReadonlyMap<string, string>,
): readonly ScatterPoint[] {
  const relevant = entries.filter((entry) => probe in entry.probeScores);

  return relevant.map((entry, index) => {
    const score = entry.probeScores[probe] ?? 0;
    const pass2Score = entry.pass2Scores?.[probe];
    const label = modelLabels.get(entry.model) ?? entry.model;
    const color = vendorColor(entry.model);
    const runId = `${entry.model}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      pass2Score,
      color,
      icon: vendorIcon(entry.model),
      title: `${label} ${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: entry.model,
        probe,
        score,
        pass2Score,
        failed: entry.failed,
      },
    };
  });
}

/**
 * Builds scatter points for a single model within one probe.
 * @param entries - all history entries
 * @param probe - probe name
 * @param modelId - model to filter on
 * @param color - point color
 * @returns scatter points for this model+probe combination
 */
function buildSingleModelPoints(
  entries: readonly HistoryEntry[],
  probe: string,
  modelId: string,
  color: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter((entry) => entry.model === modelId && probe in entry.probeScores);

  return relevant.map((entry, index) => {
    const score = entry.probeScores[probe] ?? 0;
    const pass2Score = entry.pass2Scores?.[probe];
    const runId = `${modelId}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      pass2Score,
      color,
      icon: vendorIcon(modelId),
      title: `${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: modelId,
        probe,
        score,
        pass2Score,
        failed: entry.failed,
      },
    };
  });
}

/**
 * Renders a color legend mapping model colors to labels.
 * @param entries - history entries (to extract unique models)
 * @param modelLabels - display labels per model
 * @returns HTML string for the legend
 */
function buildLegend(
  entries: readonly HistoryEntry[],
  modelLabels: ReadonlyMap<string, string>,
): string {
  const modelIds = [...new Set(entries.map((entry) => entry.model))];
  const items = modelIds.map((modelId) => {
    const label = modelLabels.get(modelId) ?? modelId;
    const color = vendorColor(modelId);
    return `<span class="legend-item">${iconDot(modelId, color)} ${escapeHtml(label)}</span>`;
  }).join('\n');

  return `<div class="chart-legend">${items}</div>`;
}
