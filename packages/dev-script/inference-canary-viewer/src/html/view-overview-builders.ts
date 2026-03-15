/**
 * Scatter point and legend builders for the overview section.
 *
 * Converts all-model entries into combined scatter points and generates
 * the color legend mapping vendor colors to model labels.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { iconDot, vendorIcon, } from '../data/model-icons.ts';

import { hasMultipleProbes, type ViewerEntry, } from '../data/viewer-types.ts';

import type { ModelSummary, } from './view-overview.ts';

/**
 * Builds scatter points for all models' overall scores, ordered by timestamp.
 *
 * @param entries - all history entries
 *
 * @returns scatter points array
 */
export function buildAllModelPoints(
  entries: readonly ViewerEntry[],
): readonly ScatterPoint[] {
  return entries.filter(function hasScore(entry): boolean { return entry.overallScore > 0 && hasMultipleProbes(entry); }).map(function toPoint(entry, index): ScatterPoint {
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
 *
 * @param summaries - model summaries
 *
 * @returns HTML legend string
 */
export function buildOverviewLegend(summaries: readonly ModelSummary[]): string {
  const items = summaries.map(function buildLegendItem(summary) {
    const color = vendorColor(summary.model);
    return h({
      tag: 'span',
      class: 'item',
      children: [iconDot(summary.model, color), ' ', h({ tag: 'span', text: summary.label, })],
    });
  }).join('\n');

  return h({ tag: 'div', class: 'chart-legend', html: items, });
}
