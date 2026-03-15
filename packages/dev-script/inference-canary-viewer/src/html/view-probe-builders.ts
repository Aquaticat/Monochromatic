/**
 * Scatter point and legend builders for the per-probe view.
 *
 * Converts viewer entries into scatter points for cross-model and
 * single-model probe charts, and generates the color legend.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import {
  iconDot,
  vendorIcon,
} from '../data/model-icons.ts';

import type { ViewerEntry, } from '../data/viewer-types.ts';

/**
 * Builds scatter points for one probe across all models.
 *
 * Points are interleaved by timestamp order so the X axis represents
 * chronological run index across all models.
 *
 * @param entries - all history entries
 *
 * @param probe - probe name to filter on
 *
 * @returns scatter points sorted by timestamp
 */
export function buildCrossModelPoints(
  entries: readonly ViewerEntry[],
  probe: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter(function hasProbe(entry,): boolean {
    return probe in entry.probeScores;
  },);

  return relevant.map(function toPoint(entry, index,): ScatterPoint {
    const score = entry.probeScores[probe] ?? 0;
    const pass2Score = entry.pass2Scores?.[probe];
    const color = vendorColor(entry.model,);
    const runId = `${entry.label}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      pass2Score,
      color,
      icon: vendorIcon(entry.model,),
      title: `${entry.label} ${entry.timestamp.slice(0, 10,)}: ${score.toFixed(2,)}${
        pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2,)})` : ''
      }`,
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
  },);
}

/**
 * Builds scatter points for a single model within one probe.
 *
 * @param entries - all history entries
 *
 * @param probe - probe name
 *
 * @param label - model label to filter on
 *
 * @param openrouterId - OpenRouter model ID for vendor icon
 *
 * @param color - point color
 *
 * @returns scatter points for this model+probe combination
 */
export function buildSingleModelPoints(
  entries: readonly ViewerEntry[],
  probe: string,
  label: string,
  openrouterId: string,
  color: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter(function matchLabelAndProbe(entry,): boolean {
    return entry.label === label && probe in entry.probeScores;
  },);

  return relevant.map(function toPoint(entry, index,): ScatterPoint {
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
      icon: vendorIcon(openrouterId,),
      title: `${entry.timestamp.slice(0, 10,)}: ${score.toFixed(2,)}${
        pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2,)})` : ''
      }`,
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
  },);
}

/**
 * Renders a color legend mapping model colors to labels.
 *
 * @param entries - history entries (to extract unique models)
 *
 * @returns HTML string for the legend
 */
export function buildProbeLegend(
  entries: readonly ViewerEntry[],
): string {
  /** Deduplicate by label, keeping first occurrence for model ID */
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!seen.has(entry.label,))
      seen.set(entry.label, entry.model,);
  }

  const items = [...seen.entries(),]
    .map(function buildItem([label, openrouterId,],): string {
      const color = vendorColor(openrouterId,);
      return h({
        tag: 'span',
        class: 'item',
        children: [iconDot(openrouterId, color,), ' ',
          h({ tag: 'span', text: label, },),],
      },);
    },)
    .join('\n',);

  return h({ tag: 'div', class: 'chart-legend', html: items, },);
}
