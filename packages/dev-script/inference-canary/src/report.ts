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
  /**
   * Parsed Date used as the source for every UTC component below.
   */
  const date = new Date(isoTimestamp,);
  /**
   * Four-digit year string; left unpadded since `getUTCFullYear` is already four digits.
   */
  const year = String(date.getUTCFullYear(),);
  // padStart(2, '0') ensures consistent two-digit month/day/hour/minute/second display
  /**
   * Two-digit month (`01`-`12`); +1 converts from JS's 0-indexed months.
   */
  const month = String(date.getUTCMonth()
    + 1,)
    .padStart(
    2,
    '0',
  );
  /**
   * Two-digit day of month (`01`-`31`).
   */
  const day = String(date.getUTCDate(),)
    .padStart(
    2,
    '0',
  );
  /**
   * Two-digit UTC hour (`00`-`23`).
   */
  const hours = String(date.getUTCHours(),)
    .padStart(
    2,
    '0',
  );
  /**
   * Two-digit UTC minute (`00`-`59`).
   */
  const minutes = String(date.getUTCMinutes(),)
    .padStart(
    2,
    '0',
  );
  /**
   * Two-digit UTC second (`00`-`59`).
   */
  const seconds = String(date.getUTCSeconds(),)
    .padStart(
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
  /**
   * Human-readable header timestamp; defaults to "now" when the first report has none.
   */
  const timestamp = formatTimestamp(reports[0]
    ?.timestamp
    ?? new Date()
    .toISOString(),);
  /**
   * Reports that completed without a whole-model failure; used for the success section and below-target check.
   */
  const successful = reports.filter(function isSuccess(report,): boolean {
    return !report.failed;
  },);
  /**
   * Reports flagged as whole-model failures (e.g. 429); rendered in their own section.
   */
  const failed = reports.filter(function isFailed(report,): boolean {
    return report.failed;
  },);
  /**
   * Successful reports whose overall score did not reach PASS; counted in the summary line.
   */
  const belowTarget = successful.filter(function isBelowTarget(report,): boolean {
    return scoreLabel(report.overallScore,)
      !== 'PASS';
  },);

  /**
   * Final summary sentence shown after the per-model sections; tone depends on failure/below-target counts.
   */
  const summary = failed.length
    > 0
    ? `${String(failed.length,)} model(s) failed, ${String(successful.length,)} passed.`
    : (belowTarget.length
      > 0
      ? `${String(belowTarget.length,)} of ${
        String(successful.length,)
      } model(s) below target score.`
      : 'All models healthy.');

  /**
   * Lines for the "Results" section; empty array short-circuits rendering when no models succeeded.
   */
  const successSection = successful.length
    > 0
    ? [
      '--- Results ---',
      ...successful.map(function fmtSuccess(report,): string {
        return formatModelReport(report,);
      },),
      '',
    ]
    : [];

  /**
   * Lines for the "Failed" section; empty array short-circuits rendering when no models failed.
   */
  const failSection = failed.length
    > 0
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
