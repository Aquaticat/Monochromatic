/**
 * Multi-model canary report formatting.
 */
import { formatModelReport, scoreLabel, } from './report-model.ts';

import type { ModelThreshold, } from './history-types.ts';
import type { CanaryReport, } from './runner-types.ts';

/**
 * Formats an ISO timestamp as a human-readable UTC string.
 * @param isoTimestamp - ISO 8601 timestamp string
 * @returns formatted string like "2026-02-23 18:12:24 UTC"
 */
function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const year = String(date.getUTCFullYear());
  // padStart(2, '0') ensures consistent two-digit month/day/hour/minute/second display
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Formats a multi-model canary report as a terminal-friendly summary.
 * @param reports - completed reports for each model
 * @param thresholds - per-model statistical thresholds
 * @returns formatted multi-line report
 */
export function formatMultiModelReport(
  reports: readonly CanaryReport[],
  thresholds: ReadonlyMap<string, ModelThreshold>,
): string {
  const timestamp = formatTimestamp(reports[0]?.timestamp ?? new Date().toISOString());
  const successful = reports.filter((report) => !report.failed);
  const failed = reports.filter((report) => report.failed);
  const degraded = successful.filter((report) => report.degradationLikely);
  // Models above the degradation threshold but below the optimal (PASS) score -- healthy
  // but not ideal. Calling these "healthy" would be misleading.
  const belowTarget = successful.filter((report) => !report.degradationLikely && scoreLabel(report.overallScore) !== 'PASS');

  const summary = degraded.length > 0
    ? `Degradation detected: ${degraded.map((report) => report.model).join(', ')}`
    : failed.length > 0
      ? `${String(failed.length)} model(s) failed, ${String(successful.length)} passed.`
      : belowTarget.length > 0
        ? `No degradation detected. ${String(belowTarget.length)} of ${String(successful.length)} model(s) below target score.`
        : 'All models healthy.';

  const successSection = successful.length > 0
    ? ['--- Results ---', ...successful.map((report) => formatModelReport(report, thresholds.get(report.model))), '']
    : [];

  const failSection = failed.length > 0
    ? ['--- Failed ---', ...failed.map((report) => formatModelReport(report)), '']
    : [];

  return [
    '=== Inference canary report ===',
    `Time: ${timestamp}  |  ${String(reports.length)} model(s) tested`,
    '',
    ...successSection,
    ...failSection,
    summary,
  ].join('\n');
}
