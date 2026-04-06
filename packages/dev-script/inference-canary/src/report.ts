/**
 * Multi-model canary report formatting.
 */
import {
  formatModelReport,
  scoreLabel,
} from './report-model.ts';

import type { CanaryReport, } from './runner-types.ts';

/**
 * Formats an ISO timestamp as a human-readable UTC string.
 *
 * @param isoTimestamp - ISO 8601 timestamp string
 *
 * @returns formatted string like "2026-02-23 18:12:24 UTC"
 */
function formatTimestamp(isoTimestamp: string,): string {
  const date = new Date(isoTimestamp,);
  const year = String(date.getUTCFullYear(),);
  // padStart(2, '0') ensures consistent two-digit month/day/hour/minute/second display
  const month = String(date.getUTCMonth() + 1,).padStart(
    2,
    '0',
  );
  const day = String(date.getUTCDate(),).padStart(
    2,
    '0',
  );
  const hours = String(date.getUTCHours(),).padStart(
    2,
    '0',
  );
  const minutes = String(date.getUTCMinutes(),).padStart(
    2,
    '0',
  );
  const seconds = String(date.getUTCSeconds(),).padStart(
    2,
    '0',
  );
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Formats a multi-model canary report as a terminal-friendly summary.
 *
 * @param reports - completed reports for each model
 *
 * @returns formatted multi-line report
 *
 * @example
 * ```ts
 * const text = formatMultiModelReport(reports);
 * console.log(text);
 * ```
 */
export function formatMultiModelReport(
  reports: readonly CanaryReport[],
): string {
  const timestamp = formatTimestamp(reports[0]?.timestamp ?? new Date().toISOString(),);
  const successful = reports.filter(function isSuccess(report,): boolean {
    return !report.failed;
  },);
  const failed = reports.filter(function isFailed(report,): boolean {
    return report.failed;
  },);
  const belowTarget = successful.filter(function isBelowTarget(report,): boolean {
    return scoreLabel(report.overallScore,) !== 'PASS';
  },);

  const summary = failed.length > 0
    ? `${String(failed.length,)} model(s) failed, ${String(successful.length,)} passed.`
    : (belowTarget.length > 0
      ? `${String(belowTarget.length,)} of ${
        String(successful.length,)
      } model(s) below target score.`
      : 'All models healthy.');

  const successSection = successful.length > 0
    ? [
      '--- Results ---',
      ...successful.map(function fmtSuccess(report,): string {
        return formatModelReport(report,);
      },),
      '',
    ]
    : [];

  const failSection = failed.length > 0
    ? [
      '--- Failed ---',
      ...failed.map(function fmtFailed(report,): string {
        return formatModelReport(report,);
      },),
      '',
    ]
    : [];

  return [
    '=== Inference canary report ===',
    `Time: ${timestamp}  |  ${String(reports.length,)} model(s) tested`,
    '',
    ...successSection,
    ...failSection,
    summary,
  ]
    .join('\n',);
}
