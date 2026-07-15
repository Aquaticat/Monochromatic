/**
 * Single-model canary report formatting.
 */
import type { CanaryReport, } from './runner-types.ts';

/**
 * Score thresholds for text labels
 */
const GOOD_THRESHOLD = 0.9;

/**
 * Score threshold below which a WARN label is shown
 */
const WARN_THRESHOLD = 0.7;

/**
 * Returns a text indicator based on score value.
 *
 * @param score - numeric score between 0 and 1
 *
 * @returns PASS, WARN, or FAIL
 *
 * @example
 * ```ts
 * scoreLabel(0.95); // "PASS"
 * scoreLabel(0.75); // "WARN"
 * scoreLabel(0.5);  // "FAIL"
 * ```
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
 *
 * @example
 * ```ts
 * const text = formatModelReport(report);
 * console.log(text);
 * ```
 */
export function formatModelReport(report: CanaryReport,): string {
  if (report.failed)
    return `  [FAIL] ${report.label}: ${report.error
      ?? 'unknown error'}`;

  /**
   * PASS/WARN/FAIL label derived from the overall score; shown in the header.
   */
  const scoreStatus = scoreLabel(report.overallScore,);
  /**
   * Indented header line carrying status, model label, and aggregate score.
   */
  const header = `  [${scoreStatus}] ${report.label}: ${report.overallScore
    .toFixed(2,)}`;

  // Align probe name column to the longest name for easier score scanning
  /**
   * Width used to pad probe names so the score column aligns vertically.
   */
  const maxNameLen = report.results
    .length
    > 0
    ? Math.max(...report.results
      .map(function nameLen(result,): number {
      return result.name
        .length;
    },),)
    : 0;

  /**
   * Per-probe results, destructured so the `.map` below is a two-step chain rather than a flagged longer one.
   */
  const {
    results,
  } = report;
  /**
   * One pre-formatted line per probe result; concatenated under the header.
   */
  const probeLines = results.map(function formatResult(result,): string {
    /**
     * Probe name right-padded to `maxNameLen` so the trailing columns line up.
     */
    const paddedName = result.name
      .padEnd(maxNameLen,);
    /**
     * "(timed out)" tag appended when the probe never completed; empty otherwise.
     */
    const timedOutAnnotation = result.timedOut
      === true ? ' (timed out)' : '';
    /**
     * Optional fix-pass score column with signed delta against the initial mean.
     */
    const pass2 = result.pass2Score
      !== undefined
      ? `   fix: ${result.pass2Score
        .toFixed(2,)} (${formatDelta(result.fixDelta
          ?? 0,)})`
      : '';
    return `    ${paddedName}  ${
      result.meanScore
        .toFixed(2,)
    }${timedOutAnnotation}${pass2}`;
  },);

  return [
    header,
    ...probeLines,
  ]
    .join('\n',);
}
