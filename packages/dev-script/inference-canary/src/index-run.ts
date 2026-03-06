/**
 * Core execution block for the inference canary: runs probes, saves history, prints report.
 */
import { appendHistory, computeThreshold, readHistory, type HistoryEntry, type HistoryFile, type ModelThreshold, } from './history.ts';
import { formatMultiModelReport, } from './report.ts';
import { runCanary, type CanaryReport, type RunnerConfig, } from './runner.ts';

import type { ModelConfig, } from './models.ts';
import type { Probe, } from './probes.ts';

/**
 * Runs canary probes for all selected models, saves results, and prints the report.
 * Degradation is reported via console output but does not cause a non-zero exit;
 * the script failing would mask the distinction between "degradation found" and
 * "canary itself broke".
 * @param selectedModels - models to test
 * @param probes - probes to run on each model
 * @param recentModelProbePairs - model:probe pairs to skip (tested recently)
 * @param history - current history (for threshold computation)
 * @param apiKey - OpenRouter API key
 * @param runsOverride - optional override for the number of consistency runs (already parsed as integer)
 */
export async function runAndReport(
  selectedModels: readonly ModelConfig[],
  probes: readonly Probe[],
  recentModelProbePairs: ReadonlyMap<string, ReadonlySet<string>>,
  history: HistoryFile,
  apiKey: string,
  runsOverride: number | undefined,
): Promise<void> {
  const consistencyRunsOverride: Pick<Partial<RunnerConfig>, 'consistencyRuns'> =
    runsOverride !== undefined ? { consistencyRuns: runsOverride, } : {};

  const reports: readonly CanaryReport[] = await Promise.all(
    selectedModels.map((model) =>
      runCanary(probes, {
        model: model.id,
        verbosity: model.verbosity,
        apiKey,
        degradationThreshold: computeThreshold(model.id, history).threshold,
        skipProbes: recentModelProbePairs,
        ...consistencyRunsOverride,
      }),
    ),
  );

  const reportsWithResults = reports.filter((report) => report.results.length > 0);
  const failedReports = reports.filter((report) => report.failed);

  // Only skip the report when all probes were cached and nothing actually ran or failed.
  // Probe-level timeouts now produce zero-score results rather than failing the model,
  // so they appear in reportsWithResults and are never silently dropped.
  if (reportsWithResults.length === 0 && failedReports.length === 0) {
    console.log('[canary] all probes skipped due to recent results. Use --retest-all to force re-run.');
    return;
  }

  const entries: readonly HistoryEntry[] = reportsWithResults.map((report) => {
    /** Pass-2 scores for probes that had a fix pass, omitting probes without one */
    const pass2Entries = report.results
      .filter((result) => result.pass2Score !== undefined)
      .map((result) => [result.name, result.pass2Score as number] as const);
    return {
      timestamp: report.timestamp,
      model: report.model,
      overallScore: report.overallScore,
      probeScores: Object.fromEntries(report.results.map((result) => [result.name, result.meanScore])),
      ...(pass2Entries.length > 0 ? { pass2Scores: Object.fromEntries(pass2Entries), } : {}),
      failed: report.failed,
    };
  });
  if (entries.length > 0) await appendHistory(entries);

  const updatedHistory = await readHistory();
  const thresholds = new Map<string, ModelThreshold>(
    selectedModels.map((model) => [model.id, computeThreshold(model.id, updatedHistory)]),
  );

  // reportsWithResults covers timed-out models (they now have zero-score results);
  // failedReports covers whole-model failures (API errors, auth failures, etc.).
  const reportsToDisplay = [...reportsWithResults, ...failedReports];
  console.log('');
  console.log(formatMultiModelReport(reportsToDisplay, thresholds));

  const degraded = reportsWithResults.filter((report) => report.degradationLikely);
  if (degraded.length > 0) {
    console.warn(`[canary] Degradation detected in: ${degraded.map((report) => report.model).join(', ')}`);
  }
}
