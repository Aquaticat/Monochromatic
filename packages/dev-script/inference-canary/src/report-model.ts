/**
 * Single-model canary report formatting.
 */
import type { ModelThreshold, } from './history-types.ts';
import type { CanaryReport, } from './runner-types.ts';

/** Score thresholds for text labels */
const GOOD_THRESHOLD = 0.9;

/** Score threshold below which a WARN label is shown */
const WARN_THRESHOLD = 0.7;

/**
 * Returns a text indicator based on score value.
 * @param score - numeric score between 0 and 1
 * @returns PASS, WARN, or FAIL
 */
export function scoreLabel(score: number): string {
  if (score >= GOOD_THRESHOLD) return 'PASS';
  if (score >= WARN_THRESHOLD) return 'WARN';
  return 'FAIL';
}

/**
 * Formats a single model's canary report as indented text lines.
 * @param report - completed canary report
 * @param threshold - statistical threshold info if available
 * @returns formatted report text
 */
export function formatModelReport(report: CanaryReport, threshold?: ModelThreshold): string {
  if (report.failed) {
    return `  [FAIL] ${report.model}: ${report.error ?? 'unknown error'}`;
  }

  const label = scoreLabel(report.overallScore);
  const thresholdInfo = threshold !== undefined && threshold.sampleCount >= 3
    ? ` (threshold: ${threshold.threshold.toFixed(2)}, mean: ${threshold.mean.toFixed(2)}, n=${String(threshold.sampleCount)})`
    : '';
  const header = `  [${label}] ${report.model}: ${report.overallScore.toFixed(2)}${thresholdInfo}`;

  const probeLines = report.results.map((result) => {
    const pass2 = result.pass2Score !== undefined
      ? ` -> fix: ${result.pass2Score.toFixed(2)} (${result.fixDelta !== undefined && result.fixDelta >= 0 ? '+' : ''}${result.fixDelta?.toFixed(2) ?? '?'})`
      : '';
    return `    ${result.name}: ${result.meanScore.toFixed(2)}${pass2}`;
  });

  return [header, ...probeLines].join('\n');
}
