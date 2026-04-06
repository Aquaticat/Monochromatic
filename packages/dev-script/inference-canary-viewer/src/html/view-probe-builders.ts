/**
 * Scatter point and legend builders for the per-probe view.
 *
 * Converts viewer entries into scatter points for cross-model and
 * single-model probe charts, and generates the color legend.
 */
import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { vendorIcon, } from '../data/model-icons.ts';

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
 *
 * @example
 * ```ts
 * const points = buildCrossModelPoints(entries, 'csv-rfc4180');
 * // [{ runId: 'Sonnet 4.6-csv-rfc4180-2026-...', score: 0.9, ... }]
 * ```
 */
export function buildCrossModelPoints(
  entries: readonly ViewerEntry[],
  probe: string,
): readonly ScatterPoint[] {
  const relevant = entries.filter(function hasProbe(entry,): boolean {
    return probe in entry.probeScores;
  },);

  return relevant.map(function toPoint(
    entry,
    index,
  ): ScatterPoint {
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
      title: `${entry.label} ${
        entry.timestamp.slice(
          0,
          10,
        )
      }: ${score.toFixed(2,)}${
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
 *
 * @example
 * ```ts
 * const points = buildSingleModelPoints(entries, 'csv-rfc4180', 'Sonnet 4.6', 'anthropic/claude-sonnet-4-6', '#D97757');
 * // [{ runId: 'Sonnet 4.6-csv-rfc4180-2026-...', score: 0.9, color: '#D97757', ... }]
 * ```
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

  return relevant.map(function toPoint(
    entry,
    index,
  ): ScatterPoint {
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
      title: `${
        entry.timestamp.slice(
          0,
          10,
        )
      }: ${score.toFixed(2,)}${
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
