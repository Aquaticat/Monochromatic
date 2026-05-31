/**
 * Scatter point builders for the per-model view.
 *
 * Converts viewer entries into scatter points for overall and per-probe charts,
 * using vendor colors and icons derived from the OpenRouter model ID.
 */
import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorIconEntry, } from '../data/model-icons.ts';

import {
  hasMultipleProbes,
  type ViewerEntry,
} from '../data/viewer-types.ts';

/**
 * Builds scatter points from overall scores for one model.
 *
 * @param entries - history entries for this model
 *
 * @param label - model display label
 *
 * @param openrouterId - OpenRouter model ID for vendor icon
 *
 * @param color - point color
 *
 * @returns scatter points array
 *
 * @example
 * ```ts
 * const points = buildOverallPoints({
 *   entries: modelEntries,
 *   label: 'Sonnet 4.6',
 *   openrouterId: 'anthropic/claude-sonnet-4-6',
 *   color: '#D97757',
 * });
 * // [{ runId: 'Sonnet 4.6-2026-...', score: 0.85, color: '#D97757', ... }]
 * ```
 */
export function buildOverallPoints({
  entries,
  label,
  openrouterId,
  color,
}: {
  readonly entries: readonly ViewerEntry[];
  readonly label: string;
  readonly openrouterId: string;
  readonly color: string;
},): readonly ScatterPoint[] {
  return entries
    .filter(function filterMultipleProbes(entry,) {
      return hasMultipleProbes(entry,);
    },)
    .map(
      function toPoint(
        entry,
        index,
      ): ScatterPoint {
        /**
         * Stable id linking the overall point to its run-detail overlay.
         */
        const runId = `${label}-${entry.timestamp}`;
        return {
          runId,
          index,
          timestamp: entry.timestamp,
          score: entry.overallScore,
          color,
          ...vendorIconEntry(openrouterId,),
          title: `${label} ${
            entry.timestamp
              .slice(
              0,
              10,
            )
          }: ${
            entry
              .overallScore
              .toFixed(2,)
          }`,
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
      },
    );
}

/**
 * Builds scatter points for a specific probe within one model's history.
 *
 * @param entries - history entries for this model
 *
 * @param label - model display label
 *
 * @param openrouterId - OpenRouter model ID for vendor icon
 *
 * @param probe - probe name
 *
 * @param color - point color
 *
 * @returns scatter points array
 *
 * @example
 * ```ts
 * const points = buildProbePoints({
 *   entries: modelEntries,
 *   label: 'Sonnet 4.6',
 *   openrouterId: 'anthropic/claude-sonnet-4-6',
 *   probe: 'csv-rfc4180',
 *   color: '#D97757',
 * });
 * // [{ runId: 'Sonnet 4.6-csv-rfc4180-2026-...', score: 0.9, ... }]
 * ```
 */
export function buildProbePoints({
  entries,
  label,
  openrouterId,
  probe,
  color,
}: {
  readonly entries: readonly ViewerEntry[];
  readonly label: string;
  readonly openrouterId: string;
  readonly probe: string;
  readonly color: string;
},): readonly ScatterPoint[] {
  return entries
    .filter(function hasProbe(entry,): boolean {
      return probe in entry
        .probeScores;
    },)
    .map(function toPoint(
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
       * Stable id linking the probe point to its probe-detail overlay.
       */
      const runId = `${label}-${probe}-${entry.timestamp}`;
      return {
        runId,
        index,
        timestamp: entry.timestamp,
        score,
        color,
        ...vendorIconEntry(openrouterId,),
        title: `${probe} ${
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
