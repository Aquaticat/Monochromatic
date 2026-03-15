/**
 * Per-probe view: compares all models on the same probe.
 *
 * Each probe gets a `<details>` section containing a combined scatter chart
 * where each model's points use its vendor color, plus a per-model breakdown
 * with individual charts.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import { renderScatterChart, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, } from '../data/model-icons.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

import { buildCrossModelPoints, buildSingleModelPoints, buildProbeLegend, } from './view-probe-builders.ts';

/**
 * Renders the by-probe view: one `<details>` per probe, with all models overlaid
 * and a per-model breakdown nested inside.
 *
 *
 * @param entries - all history entries
 *
 * @returns HTML string
 */
export function renderByProbe({ entries, }: {
  entries: readonly ViewerEntry[];
}): string {
  /** All unique probe names across all entries */
  const probeNames = [...new Set(entries.flatMap(function probeKeys(entry): string[] { return Object.keys(entry.probeScores); }))];

  if (probeNames.length === 0) {
    return h({ tag: 'p', text: 'No probe data available.', });
  }

  return probeNames.map(function renderProbeSection(probe): string {
    const points = buildCrossModelPoints(entries, probe);
    const legend = buildProbeLegend(entries);

    // Per-model breakdown within this probe
    const labels = [...new Set(entries.filter(function hasProbe(entry): boolean { return probe in entry.probeScores; }).map(function getLabel(entry): string { return entry.label; }))];
    const modelBreakdown = labels.map(function renderModelSection(label): string {
      const modelEntries = entries.filter(function matchLabel(entry): boolean { return entry.label === label; });
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
