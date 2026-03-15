/**
 * Scatter point builders for the per-model view.
 *
 * Converts viewer entries into scatter points for overall and per-probe charts,
 * using vendor colors and icons derived from the OpenRouter model ID.
 */
import type { ScatterPoint, } from '../chart/scatter.ts';
import { vendorIcon, } from '../data/model-icons.ts';

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
 */
export function buildOverallPoints(
  entries: readonly ViewerEntry[],
  label: string,
  openrouterId: string,
  color: string,
): readonly ScatterPoint[] {
  return entries.filter(hasMultipleProbes,).map(
    function toPoint(entry, index,): ScatterPoint {
      const runId = `${label}-${entry.timestamp}`;
      return {
        runId,
        index,
        timestamp: entry.timestamp,
        score: entry.overallScore,
        color,
        icon: vendorIcon(openrouterId,),
        title: `${label} ${entry.timestamp.slice(0, 10,)}: ${
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
 */
export function buildProbePoints(
  entries: readonly ViewerEntry[],
  label: string,
  openrouterId: string,
  probe: string,
  color: string,
): readonly ScatterPoint[] {
  return entries
    .filter(function hasProbe(entry,): boolean {
      return probe in entry.probeScores;
    },)
    .map(function toPoint(entry, index,): ScatterPoint {
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
        title: `${probe} ${entry.timestamp.slice(0, 10,)}: ${score.toFixed(2,)}${
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
