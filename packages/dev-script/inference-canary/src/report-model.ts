/**
 * Single-model canary report formatting.
 */
import type { CanaryReport, } from './runner-types.ts';

/** Score thresholds for text labels */
const GOOD_THRESHOLD = 0.9;

/** Score threshold below which a WARN label is shown */
const WARN_THRESHOLD = 0.7;

/**
 * Returns a text indicator based on score value.
 *
 * @param score - numeric score between 0 and 1
 *
 * @returns PASS, WARN, or FAIL
 */
export function scoreLabel(score: number,): string {
  if (score >= GOOD_THRESHOLD)
    return 'PASS';
  if (score >= WARN_THRESHOLD)
    return 'WARN';
  return 'FAIL';
}

/**
 * Formats a fix delta value with an explicit sign for clarity.
 *
 * @param delta - numeric difference between pass2 and initial score
 *
 * @returns signed string like "+0.05", "-0.03", or "0.00"
 */
function formatDelta(delta: number,): string {
  if (delta > 0)
    return `+${delta.toFixed(2,)}`;
  if (delta < 0)
    return delta.toFixed(2,);
  return '0.00';
}

/**
 * Formats a single model's canary report as indented text lines.
 * Probe names are aligned to the longest name in the result set so scores
 * form a readable column even when probe names differ in length.
 *
 * @param report - completed canary report
 *
 * @returns formatted report text
 */
export function formatModelReport(report: CanaryReport,): string {
  if (report.failed)
    return `  [FAIL] ${report.label}: ${report.error ?? 'unknown error'}`;

  const scoreStatus = scoreLabel(report.overallScore,);
  const header = `  [${scoreStatus}] ${report.label}: ${report.overallScore.toFixed(2,)}`;

  // Align probe name column to the longest name for easier score scanning
  const maxNameLen = report.results.length > 0
    ? Math.max(...report.results.map(function nameLen(result,): number {
      return result.name.length;
    },),)
    : 0;

  const probeLines = report.results.map(function formatResult(result,): string {
    const paddedName = result.name.padEnd(maxNameLen,);
    const timedOutAnnotation = result.timedOut === true ? ' (timed out)' : '';
    const pass2 = result.pass2Score !== undefined
      ? `   fix: ${result.pass2Score.toFixed(2,)} (${formatDelta(result.fixDelta ?? 0,)})`
      : '';
    return `    ${paddedName}  ${
      result.meanScore.toFixed(2,)
    }${timedOutAnnotation}${pass2}`;
  },);

  return [
    header,
    ...probeLines,
  ]
    .join('\n',);
}
