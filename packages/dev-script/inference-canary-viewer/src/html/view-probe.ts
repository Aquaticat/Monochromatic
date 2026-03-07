/**
 * Per-probe view: compares all models on the same probe.
 *
 * Each probe gets a `<details>` section containing a combined scatter chart
 * where each model's points use its vendor color, plus a per-model breakdown
 * with individual charts.
 *
 * Exceeds 100 lines: cross-model and single-model point builders are private
 * helpers specific to this view and share the same filtering patterns.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { renderScatterChart, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';

import type { ScatterPoint, } from '../chart/scatter.ts';
import type { ViewerEntry, } from '../data/viewer-types.ts';

/**
 * Renders the by-probe view: one `<details>` per probe, with all models overlaid
 * and a per-model breakdown nested inside.
 * @param options - by-probe rendering options
 * @param options.entries - all history entries
 * @returns HTML string
 */
export function renderByProbe({ entries, }: {
  entries: readonly ViewerEntry[];
}): string {
  /** All unique probe names across all entries */
  const probeNames = [...new Set(entries.flatMap((entry) => Object.keys(entry.probeScores)))];

  if (probeNames.length === 0) {
    return h({ tag: 'p', text: 'No probe data available.', });
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
      return h({
        tag: 'details',
        class: 'model-section',
        children: [
          h({
            tag: 'summary',
            children: [iconDot(openrouterId, color), ' ', h({ tag: 'span', text: label, })],
          }),
          renderScatterChart({ points: modelPoints, threshold: 0, thresholdLabel: '', caption: `${probe} - ${label}`, tableDisplay: { showModel: false, showProbe: false, }, }),
        ],
      });
    }).join('\n');

    return h({
      tag: 'details',
      class: 'probe-section',
      children: [
        h({ tag: 'summary', text: probe, }),
        h({
          tag: 'div',
          class: 'pane',
          children: [
            legend,
            renderScatterChart({ points, threshold: 0, thresholdLabel: '', caption: `${probe} - all models`, tableDisplay: { showProbe: false, }, }),
            h({ tag: 'h3', text: 'Per-model breakdown', }),
            modelBreakdown,
          ],
        }),
      ],
    });
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
    return h({
      tag: 'span',
      class: 'item',
      children: [iconDot(openrouterId, color), ' ', h({ tag: 'span', text: label, })],
    });
  }).join('\n');

  return h({ tag: 'div', class: 'chart-legend', html: items, });
}
