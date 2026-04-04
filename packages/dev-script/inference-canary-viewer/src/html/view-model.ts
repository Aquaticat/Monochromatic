/**
 * Per-model view: scatter charts showing probe scores over time.
 *
 * Each model gets a nested `<details>` element containing one scatter chart
 * per probe, plus an aggregate chart of overall score.
 */
import { hHtml as h, } from '@monochromatic-dev/module-hyperscript/ts';

import { renderScatterChart, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, } from '../data/model-icons.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

import {
  buildOverallPoints,
  buildProbePoints,
} from './view-model-points.ts';

/**
 * Renders the by-model view: one `<details>` per model, each containing scatter charts.
 *
 * @param entries - all viewer entries
 *
 * @param thresholds - map from model label to computed threshold
 *
 * @returns HTML string
 */
export function renderByModel({
  entries,
  thresholds,
}: {
  entries: readonly ViewerEntry[];
  thresholds: ReadonlyMap<string, number>;
},): string {
  /** Unique model labels in the order they first appear */
  const labels = [...new Set(entries.map(function getLabel(entry,): string {
    return entry.label;
  },),),];

  if (labels.length === 0) {
    return h({
      tag: 'p',
      text: 'No model data available.',
    },);
  }

  /** Hide Model and Probe columns since we're within a per-model overall context */
  const tableDisplay = {
    showModel: false,
    showProbe: false,
  };

  return labels
    .map(function renderModelSection(label,): string {
      const modelEntries = entries.filter(function matchLabel(entry,): boolean {
        return entry.label === label;
      },);
      /** OpenRouter model ID from the first entry, used for vendor color/icon */
      const openrouterId = modelEntries[0]?.model ?? '';
      const color = vendorColor(openrouterId,);
      const threshold = thresholds.get(label,) ?? 0;

      // Overall score chart
      const overallPoints = buildOverallPoints(
        modelEntries,
        label,
        openrouterId,
        color,
      );
      const overallChart = renderScatterChart({
        points: overallPoints,
        threshold,
        thresholdLabel: `threshold: ${threshold.toFixed(2,)}`,
        caption: `${label} overall score`,
        tableDisplay,
      },);

      // Per-probe charts
      const probeNames = [
        ...new Set(modelEntries.flatMap(function probeKeys(entry,): string[] {
          return Object.keys(entry.probeScores,);
        },),),
      ];
      const probeCharts = probeNames
        .map(function renderProbeChart(probe,): string {
          const probePoints = buildProbePoints(
            modelEntries,
            label,
            openrouterId,
            probe,
            color,
          );
          return h({
            tag: 'details',
            class: 'probe-section',
            children: [
              h({
                tag: 'summary',
                text: probe,
              },),
              renderScatterChart({
                points: probePoints,
                threshold: 0,
                thresholdLabel: '',
                caption: `${label} - ${probe}`,
                tableDisplay: { showModel: false, showProbe: false, },
              },),
            ],
          },);
        },)
        .join('\n',);

      return h({
        tag: 'details',
        class: 'model-section',
        children: [
          h({
            tag: 'summary',
            children: [
              iconDot(openrouterId, color,),
              ' ',
              h({ tag: 'span', text: label, },),
            ],
          },),
          h({
            tag: 'div',
            class: 'pane',
            children: [
              overallChart,
              h({
                tag: 'h3',
                text: 'Per-probe breakdown',
              },),
              probeCharts,
            ],
          },),
        ],
      },);
    },)
    .join('\n',);
}
