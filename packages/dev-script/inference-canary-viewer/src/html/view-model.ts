/**
 * Per-model view: scatter charts showing probe scores over time.
 *
 * Each model gets a nested `<details>` element containing one scatter chart
 * per probe, plus an aggregate chart of overall score.
 *
 * Exceeds 100 lines: overall and per-probe point builders are private helpers
 * specific to this view and share the same entry-filtering patterns.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { renderScatterChart, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';

import type { ScatterPoint, } from '../chart/scatter.ts';
import type { ViewerEntry, } from '../data/viewer-types.ts';

import { hasMultipleProbes, } from '../data/viewer-types.ts';

/**
 * Renders the by-model view: one `<details>` per model, each containing scatter charts.
 * @param options - by-model rendering options
 * @param options.entries - all viewer entries
 * @param options.thresholds - map from model label to computed threshold
 * @returns HTML string
 */
export function renderByModel({ entries, thresholds, }: {
  entries: readonly ViewerEntry[];
  thresholds: ReadonlyMap<string, number>;
}): string {
  /** Unique model labels in the order they first appear */
  const labels = [...new Set(entries.map((entry) => entry.label))];

  if (labels.length === 0) {
    return h({ tag: 'p', text: 'No model data available.', });
  }

  /** Hide Model and Probe columns since we're within a per-model overall context */
  const tableDisplay = { showModel: false, showProbe: false, };

  return labels.map((label) => {
    const modelEntries = entries.filter((entry) => entry.label === label);
    /** OpenRouter model ID from the first entry, used for vendor color/icon */
    const openrouterId = modelEntries[0]?.model ?? '';
    const color = vendorColor(openrouterId);
    const threshold = thresholds.get(label) ?? 0;

    // Overall score chart
    const overallPoints = buildOverallPoints(modelEntries, label, openrouterId, color);
    const overallChart = renderScatterChart({
      points: overallPoints, threshold, thresholdLabel: `threshold: ${threshold.toFixed(2)}`, caption: `${label} overall score`,
      tableDisplay,
    });

    // Per-probe charts
    const probeNames = [...new Set(modelEntries.flatMap((entry) => Object.keys(entry.probeScores)))];
    const probeCharts = probeNames.map((probe) => {
      const probePoints = buildProbePoints(modelEntries, label, openrouterId, probe, color);
      return h({
        tag: 'details',
        class: 'probe-section',
        children: [
          h({ tag: 'summary', text: probe, }),
          renderScatterChart({ points: probePoints, threshold: 0, thresholdLabel: '', caption: `${label} - ${probe}`, tableDisplay: { showModel: false, showProbe: false, }, }),
        ],
      });
    }).join('\n');

    return h({
      tag: 'details',
      class: 'model-section',
      children: [
        h({
          tag: 'summary',
          children: [iconDot(openrouterId, color), ' ', h({ tag: 'span', text: label, })],
        }),
        h({
          tag: 'div',
          class: 'pane',
          children: [
            overallChart,
            h({ tag: 'h3', text: 'Per-probe breakdown', }),
            probeCharts,
          ],
        }),
      ],
    });
  }).join('\n');
}

/**
 * Builds scatter points from overall scores for one model.
 * @param entries - history entries for this model
 * @param label - model display label
 * @param openrouterId - OpenRouter model ID for vendor icon
 * @param color - point color
 * @returns scatter points array
 */
function buildOverallPoints(
  entries: readonly ViewerEntry[],
  label: string,
  openrouterId: string,
  color: string,
): readonly ScatterPoint[] {
  return entries.filter(hasMultipleProbes).map((entry, index) => {
    const runId = `${label}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score: entry.overallScore,
      color,
      icon: vendorIcon(openrouterId),
      title: `${label} ${entry.timestamp.slice(0, 10)}: ${entry.overallScore.toFixed(2)}`,
      failed: entry.failed,
      tableRow: {
        timestamp: entry.timestamp,
        model: label,
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
 * @param label - model display label
 * @param openrouterId - OpenRouter model ID for vendor icon
 * @param probe - probe name
 * @param color - point color
 * @returns scatter points array
 */
function buildProbePoints(
  entries: readonly ViewerEntry[],
  label: string,
  openrouterId: string,
  probe: string,
  color: string,
): readonly ScatterPoint[] {
  return entries
    .filter((entry) => probe in entry.probeScores)
    .map((entry, index) => {
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
        title: `${probe} ${entry.timestamp.slice(0, 10)}: ${score.toFixed(2)}${pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2)})` : ''}`,
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
