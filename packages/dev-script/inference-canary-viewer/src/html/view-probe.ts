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

import type { ViewerEntry, } from '../data/viewer-types.ts';

/**
 * Renders the by-probe view: one `<details>` per probe, with all models overlaid
 * and a per-model breakdown nested inside.
 * @param entries - all history entries
 * @param modelLabels - map from model label to display label
 * @returns HTML string
 */
export function renderByProbe(
  entries: readonly ViewerEntry[],
  modelLabels: ReadonlyMap<string, string>,
): string {
  /** All unique probe names across all entries */
  const probeNames = [...new Set(entries.flatMap((entry) => Object.keys(entry.probeScores)))];

  if (probeNames.length === 0) {
    return '<p>No probe data available.</p>';
  }

  return probeNames.map((probe) => {
    const points = buildCrossModelPoints(entries, probe);
    const legend = buildLegend(entries);

    // Per-model breakdown within this probe
    const labels = [...new Set(entries.filter((entry) => probe in entry.probeScores).map((entry) => entry.label))];
    const modelBreakdown = labels.map((label) => {
      const modelEntries = entries.filter((entry) => entry.label === label);
      /** OpenRouter model ID from the first entry for vendor icon/color */
      const openrouterId = modelEntries[0]?.model ?? '';
      const color = vendorColor(openrouterId);
      const modelPoints = buildSingleModelPoints(entries, probe, label, openrouterId, color);
      return `<details class="model-section">
  <summary class="model-tab">${iconDot(openrouterId, color)} ${escapeHtml(label)}</summary>
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
 * @returns scatter points sorted by timestamp
 */
function buildCrossModelPoints(
  entries: readonly ViewerEntry[],
  probe: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter((entry) => probe in entry.probeScores);

  return relevant.map((entry, index) => {
    const score = entry.probeScores[probe] ?? 0;
    const pass2Score = entry.pass2Scores?.[probe];
    const color = vendorColor(entry.model);
    const runId = `${entry.label}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      pass2Score,
      color,
      icon: vendorIcon(entry.model),
      title: `${entry.label} ${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: entry.label,
        probe,
        score,
        pass2Score,
        failed: entry.failed,
        runId,
      },
    };
  });
}

/**
 * Builds scatter points for a single model within one probe.
 * @param entries - all history entries
 * @param probe - probe name
 * @param label - model label to filter on
 * @param openrouterId - OpenRouter model ID for vendor icon
 * @param color - point color
 * @returns scatter points for this model+probe combination
 */
function buildSingleModelPoints(
  entries: readonly ViewerEntry[],
  probe: string,
  label: string,
  openrouterId: string,
  color: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter((entry) => entry.label === label && probe in entry.probeScores);

  return relevant.map((entry, index) => {
    const score = entry.probeScores[probe] ?? 0;
    const pass2Score = entry.pass2Scores?.[probe];
    const runId = `${label}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      pass2Score,
      color,
      icon: vendorIcon(openrouterId),
      title: `${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: label,
        probe,
        score,
        pass2Score,
        failed: entry.failed,
        runId,
      },
    };
  });
}

/**
 * Renders a color legend mapping model colors to labels.
 * @param entries - history entries (to extract unique models)
 * @returns HTML string for the legend
 */
function buildLegend(
  entries: readonly ViewerEntry[],
): string {
  /** Deduplicate by label, keeping first occurrence for model ID */
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!seen.has(entry.label)) {
      seen.set(entry.label, entry.model);
    }
  }

  const items = [...seen.entries()].map(([label, openrouterId]) => {
    const color = vendorColor(openrouterId);
    return `<span class="legend-item">${iconDot(openrouterId, color)} ${escapeHtml(label)}</span>`;
  }).join('\n');

  return `<div class="chart-legend">${items}</div>`;
}
