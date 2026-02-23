/**
 * Multi-model canary report formatting.
 */
import { formatModelReport, } from './report-model.ts';

import type { ModelThreshold, } from './history-types.ts';
import type { CanaryReport, } from './runner-types.ts';

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
  const timestamp = reports[0]?.timestamp ?? new Date().toISOString();
  const successful = reports.filter((report) => !report.failed);
  const failed = reports.filter((report) => report.failed);
  const degraded = successful.filter((report) => report.degradationLikely);

  const summary = degraded.length > 0
    ? `Degradation detected: ${degraded.map((report) => report.model).join(', ')}`
    : failed.length === 0
      ? 'All models healthy.'
      : `${String(failed.length)} model(s) failed, ${String(successful.length)} healthy.`;

  const successSection = successful.length > 0
    ? ['--- Results ---', ...successful.map((report) => formatModelReport(report, thresholds.get(report.model))), '']
    : [];

  const failSection = failed.length > 0
    ? ['--- Failed ---', ...failed.map((report) => formatModelReport(report)), '']
    : [];

  return [
    '=== Inference canary report ===',
    `Time: ${timestamp}`,
    `Models: ${String(reports.length)}`,
    '',
    ...successSection,
    ...failSection,
    summary,
  ].join('\n');
}
