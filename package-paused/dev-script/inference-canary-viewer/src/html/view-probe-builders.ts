/**
 * Scatter point and legend builders for the per-probe view.
 *
 * Converts viewer entries into scatter points for cross-model and
 * single-model probe charts, and generates the color legend.
 */
import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorColor, } from '../data/model-colors.ts';
import { vendorIconEntry, } from '../data/model-icons.ts';

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
 * const points = buildCrossModelPoints({ entries, probe: 'csv-rfc4180', });
 * // [{ runId: 'Sonnet 4.6-csv-rfc4180-2026-...', score: 0.9, ... }]
 * ```
 */
export function buildCrossModelPoints({
  entries,
  probe,
}: {
  readonly entries: readonly ViewerEntry[];
  readonly probe: string;
},): readonly ScatterPoint[] {
  /**
   * Entries that recorded a score for the requested probe.
   */
  const relevant = entries.filter(function hasProbe(entry,): boolean {
    return probe in entry
      .probeScores;
  },);

  return relevant.map(function toPoint(
    entry,
    index,
  ): ScatterPoint {
    /**
     * Probe-specific initial-pass score with zero fallback.
     */
    const score = entry.probeScores[probe]
      ?? 0;
    /**
     * Probe-specific fix-pass score; undefined when no fix was attempted.
     */
    const pass2Score = entry.pass2Scores?.[probe];
    /**
     * Vendor-derived accent color for the point's button.
     */
    const color = vendorColor(entry.model,);
    /**
     * Stable id linking the point to its probe-detail overlay.
     */
    const runId = `${entry.label}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      color,
      ...vendorIconEntry(entry.model,),
      title: `${entry.label} ${
        entry.timestamp
          .slice(
          0,
          10,
        )
      }: ${score.toFixed(2,)}${
        pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2,)})` : ''
      }`,
      failed: entry.failed,
      ...(pass2Score !== undefined ? { pass2Score, } : {}),
      tableRow: {
        timestamp: entry.timestamp,
        model: entry.label,
        probe,
        score,
        failed: entry.failed,
        runId,
        ...(pass2Score !== undefined ? { pass2Score, } : {}),
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
 * const points = buildSingleModelPoints({
 *   entries,
 *   probe: 'csv-rfc4180',
 *   label: 'Sonnet 4.6',
 *   openrouterId: 'anthropic/claude-sonnet-4-6',
 *   color: '#D97757',
 * });
 * // [{ runId: 'Sonnet 4.6-csv-rfc4180-2026-...', score: 0.9, color: '#D97757', ... }]
 * ```
 */
export function buildSingleModelPoints({
  entries,
  probe,
  label,
  openrouterId,
  color,
}: {
  readonly entries: readonly ViewerEntry[];
  readonly probe: string;
  readonly label: string;
  readonly openrouterId: string;
  readonly color: string;
},): readonly ScatterPoint[] {
  /**
   * Entries scoring the requested probe for this specific model label.
   */
  const relevant = entries.filter(function matchLabelAndProbe(entry,): boolean {
    return (entry.label
      === label) && (probe in entry
        .probeScores);
  },);

  return relevant.map(function toPoint(
    entry,
    index,
  ): ScatterPoint {
    /**
     * Probe-specific initial-pass score with zero fallback.
     */
    const score = entry.probeScores[probe]
      ?? 0;
    /**
     * Probe-specific fix-pass score; undefined when no fix was attempted.
     */
    const pass2Score = entry.pass2Scores?.[probe];
    /**
     * Stable id linking the point to its probe-detail overlay.
     */
    const runId = `${label}-${probe}-${entry.timestamp}`;
    return {
      runId,
      index,
      timestamp: entry.timestamp,
      score,
      color,
      ...vendorIconEntry(openrouterId,),
      title: `${
        entry.timestamp
          .slice(
          0,
          10,
        )
      }: ${score.toFixed(2,)}${
        pass2Score !== undefined ? ` (fix: ${pass2Score.toFixed(2,)})` : ''
      }`,
      failed: entry.failed,
      ...(pass2Score !== undefined ? { pass2Score, } : {}),
      tableRow: {
        timestamp: entry.timestamp,
        model: label,
        probe,
        score,
        failed: entry.failed,
        runId,
        ...(pass2Score !== undefined ? { pass2Score, } : {}),
      },
    };
  },);
}
