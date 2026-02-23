/**
 * Formats canary reports for terminal output.
 *
 * Produces a human-readable summary with per-model scores,
 * per-probe breakdowns, and pass/fail verdicts.
 */
import type { ModelThreshold, } from './history.ts';
import type { CanaryReport, } from './runner.ts';

//region Score formatting

/** Score thresholds for text labels */
const GOOD_THRESHOLD = 0.9;
const WARN_THRESHOLD = 0.7;

/**
 * Returns a text indicator based on score value.
 * @param score - numeric score between 0 and 1
 * @returns text label for the score range
 */
function scoreLabel(score: number): string {
  if (score >= GOOD_THRESHOLD) return 'PASS';
  if (score >= WARN_THRESHOLD) return 'WARN';
  return 'FAIL';
}

//endregion Score formatting

//region Single-model report

/**
 * Formats a single model's canary report.
 * @param report - completed canary report
 * @param threshold - statistical threshold info if available
 * @returns formatted report text
 */
function formatModelReport(report: CanaryReport, threshold?: ModelThreshold): string {
  const lines: string[] = [];

  if (report.failed) {
    lines.push(`  [FAIL] ${report.model}: ${report.error ?? 'unknown error'}`);
    return lines.join('\n');
  }

  const label = scoreLabel(report.overallScore);
  const thresholdInfo = threshold !== undefined && threshold.sampleCount >= 3
    ? ` (threshold: ${threshold.threshold.toFixed(2)}, mean: ${threshold.mean.toFixed(2)}, n=${String(threshold.sampleCount)})`
    : '';
  lines.push(`  [${label}] ${report.model}: ${report.overallScore.toFixed(2)}${thresholdInfo}`);

  report.results.forEach((result) => {
    const pass2 = result.pass2Score !== undefined
      ? ` -> fix: ${result.pass2Score.toFixed(2)} (${result.fixDelta !== undefined && result.fixDelta >= 0 ? '+' : ''}${result.fixDelta?.toFixed(2) ?? '?'})`
      : '';
    lines.push(`    ${result.name}: ${result.meanScore.toFixed(2)}${pass2}`);
  });

  return lines.join('\n');
}

//endregion Single-model report

//region Multi-model report

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
  const lines: string[] = [];
  const timestamp = reports[0]?.timestamp ?? new Date().toISOString();

  lines.push('=== Inference canary report ===');
  lines.push(`Time: ${timestamp}`);
  lines.push(`Models: ${String(reports.length)}`);
  lines.push('');

  // Separate successful from failed
  const successful = reports.filter((report) => !report.failed);
  const failed = reports.filter((report) => report.failed);

  if (successful.length > 0) {
    lines.push('--- Results ---');
    successful.forEach((report) => {
      lines.push(formatModelReport(report, thresholds.get(report.model)));
    });
    lines.push('');
  }

  if (failed.length > 0) {
    lines.push('--- Failed ---');
    failed.forEach((report) => {
      lines.push(formatModelReport(report));
    });
    lines.push('');
  }

  // Summary line
  const degraded = successful.filter((report) => report.degradationLikely);
  if (degraded.length > 0) {
    lines.push(`Degradation detected: ${degraded.map((report) => report.model).join(', ')}`);
  } else if (failed.length === 0) {
    lines.push('All models healthy.');
  } else {
    lines.push(`${String(failed.length)} model(s) failed, ${String(successful.length)} healthy.`);
  }

  return lines.join('\n');
}

//endregion Multi-model report
