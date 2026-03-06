/**
 * Per-model view: scatter charts showing probe scores over time.
 *
 * Each model gets a nested `<details>` element containing one scatter chart
 * per probe, plus an aggregate chart of overall score.
 */
import { renderScatterChart, } from '../chart/scatter.ts';
import type { ScatterPoint, } from '../chart/scatter.ts';
import { escapeHtml, } from '../chart/data-table.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';

import type { HistoryEntry, OpenRouterModelId, } from '../data/read-history.ts';
import type { ArtifactPair, } from '../data/read-artifacts.ts';

/**
 * Renders the by-model view: one `<details>` per model, each containing scatter charts.
 * @param entries - all history entries
 * @param modelLabels - map from model ID to display label
 * @param thresholds - map from model ID to computed threshold
 * @param artifacts - available artifact pairs keyed by composite key
 * @returns HTML string
 */
export function renderByModel(
  entries: readonly HistoryEntry[],
  modelLabels: ReadonlyMap<string, string>,
  thresholds: ReadonlyMap<string, number>,
  artifacts: ReadonlyMap<string, ArtifactPair>,
): string {
  /** Unique model IDs in the order they first appear */
  const modelIds = [...new Set(entries.map((entry) => entry.model))];

  if (modelIds.length === 0) {
    return '<p>No model data available.</p>';
  }

  void artifacts;

  /** Hide Model and Probe columns since we're within a per-model overall context */
  const tableDisplay = { showModel: false, showProbe: false, };

  return modelIds.map((modelId) => {
    const label = modelLabels.get(modelId) ?? modelId;
    const color = vendorColor(modelId);
    const threshold = thresholds.get(modelId) ?? 0;
    const modelEntries = entries.filter((entry) => entry.model === modelId);

    // Overall score chart
    const overallPoints = buildOverallPoints(modelEntries, modelId, color);
    const overallChart = renderScatterChart(
      overallPoints, threshold, `threshold: ${threshold.toFixed(2)}`, `${label} overall score`,
      { tableDisplay, },
    );

    // Per-probe charts
    const probeNames = [...new Set(modelEntries.flatMap((entry) => Object.keys(entry.probeScores)))];
    const probeCharts = probeNames.map((probe) => {
      const probePoints = buildProbePoints(modelEntries, modelId, probe, color);
      return `<details class="probe-section">
  <summary class="probe-tab">${escapeHtml(probe)}</summary>
  ${renderScatterChart(probePoints, 0, '', `${label} - ${probe}`, { tableDisplay: { showModel: false, showProbe: false, }, })}
</details>`;
    }).join('\n');

    return `<details class="model-section">
  <summary class="model-tab">${iconDot(modelId, color)} ${escapeHtml(label)}</summary>
  <div class="model-content">
    ${overallChart}
    <h3>Per-probe breakdown</h3>
    ${probeCharts}
  </div>
</details>`;
  }).join('\n');
}

/**
 * Builds scatter points from overall scores for one model.
 * @param entries - history entries for this model
 * @param modelId - model identifier
 * @param color - point color
 * @returns scatter points array
 */
function buildOverallPoints(
  entries: readonly HistoryEntry[],
  modelId: OpenRouterModelId,
  color: string,
): readonly ScatterPoint[] {
  return entries.map((entry, index) => {
    const runId = `${modelId}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score: entry.overallScore,
      color,
      icon: vendorIcon(modelId),
      title: `${modelId} ${entry.timestamp.slice(0, 10)}: ${entry.overallScore.toFixed(2)}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: modelId,
        probe: 'overall',
        score: entry.overallScore,
        failed: entry.failed,
        runId,
      },
    };
  });
}

/**
 * Builds scatter points for a specific probe within one model's history.
 * @param entries - history entries for this model
 * @param modelId - model identifier
 * @param probe - probe name
 * @param color - point color
 * @returns scatter points array
 */
function buildProbePoints(
  entries: readonly HistoryEntry[],
  modelId: OpenRouterModelId,
  probe: string,
  color: string,
): readonly ScatterPoint[] {
  return entries
    .filter((entry) => probe in entry.probeScores)
    .map((entry, index) => {
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
        title: `${probe} ${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
        failed: entry.failed,
        tableRow: {
          timestamp: entry.timestamp,
          model: modelId,
          probe,
          score,
          pass2Score,
          failed: entry.failed,
          runId,
        },
      };
    });
}
