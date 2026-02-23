/**
 * Formats a canary report for terminal output.
 *
 * Produces a human-readable summary with per-probe scores,
 * category breakdowns, and a clear pass/fail verdict.
 */
import type { CanaryReport, } from './runner.ts';

//region Score formatting

/** Score thresholds for color-coded terminal output */
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

//region Report formatting

/**
 * Formats a canary report as a multi-line string for terminal display.
 * @param report - completed canary report
 * @returns formatted report text
 */
export function formatReport(report: CanaryReport): string {
  const lines: string[] = [];

  lines.push('=== Inference canary report ===');
  lines.push(`Model: ${report.model}`);
  lines.push(`Time:  ${report.timestamp}`);
  lines.push('');

  lines.push('--- Per-probe results ---');
  report.results.forEach((result) => {
    const label = scoreLabel(result.meanScore);
    const consistency = result.consistent ? 'consistent' : 'INCONSISTENT';
    const pass2 = result.pass2Score !== undefined
      ? ` -> pass2: ${result.pass2Score.toFixed(2)} (delta: ${result.fixDelta !== undefined && result.fixDelta >= 0 ? '+' : ''}${result.fixDelta?.toFixed(2) ?? '?'})`
      : '';
    lines.push(
      `  [${label}] ${result.name} (${result.category}): ${result.meanScore.toFixed(2)} [${consistency}]${pass2}`,
    );
  });
  lines.push('');

  lines.push('--- Category scores ---');
  Object.entries(report.categoryScores).forEach(([category, score]) => {
    lines.push(`  ${category}: ${(score as number).toFixed(2)} [${scoreLabel(score as number)}]`);
  });
  lines.push('');

  lines.push('--- Overall ---');
  lines.push(`  Score: ${report.overallScore.toFixed(2)} [${scoreLabel(report.overallScore)}]`);
  lines.push(`  Degradation likely: ${report.degradationLikely ? 'YES' : 'no'}`);

  if (report.degradationLikely) {
    lines.push('');
    lines.push('  Recommendation: inference quality may be degraded.');
    lines.push('  Consider retrying later or switching models.');

    /** Identify which categories are weakest to give targeted advice */
    const weakCategories = Object.entries(report.categoryScores)
      .filter(([, score]) => (score as number) < WARN_THRESHOLD)
      .map(([category]) => category);

    if (weakCategories.length > 0) {
      lines.push(`  Weakest categories: ${weakCategories.join(', ')}`);
    }

    /** Flag inconsistent probes as especially suspicious */
    const inconsistentProbes = report.results.filter((result) => !result.consistent);
    if (inconsistentProbes.length > 0) {
      lines.push(`  Inconsistent probes: ${inconsistentProbes.map((probe) => probe.name).join(', ')}`);
    }
  }

  return lines.join('\n');
}

//endregion Report formatting
