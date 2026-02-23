/**
 * Core execution block for the inference canary: runs probes, saves history, prints report.
 */
import { appendHistory, computeThreshold, readHistory, } from './history.ts';
import { formatMultiModelReport, } from './report.ts';
import { runCanary, } from './runner.ts';

import type { HistoryEntry, HistoryFile, ModelThreshold, } from './history.ts';
import type { ModelConfig, } from './models.ts';
import type { Probe, } from './probes.ts';
import type { CanaryReport, } from './runner.ts';
import type { RunnerConfig, } from './runner-config.ts';

/**
 * Runs canary probes for all selected models, saves results, and prints the report.
 * @param selectedModels - models to test
 * @param probes - probes to run on each model
 * @param recentModelProbePairs - model:probe pairs to skip (tested recently)
 * @param history - current history (for threshold computation)
 * @param apiKey - OpenRouter API key
 * @param runsOverride - optional override for the number of consistency runs (already parsed as integer)
 * @throws if degradation is detected in any model
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

  if (reportsWithResults.length === 0) {
    console.log('[canary] all probes skipped due to recent results. Use --retest-all to force re-run.');
    return;
  }

  const entries: readonly HistoryEntry[] = reportsWithResults.map((report) => ({
    timestamp: report.timestamp,
    model: report.model,
    overallScore: report.overallScore,
    probeScores: Object.fromEntries(report.results.map((result) => [result.name, result.meanScore])),
    failed: report.failed,
  }));
  await appendHistory(entries);

  const updatedHistory = await readHistory();
  const thresholds = new Map<string, ModelThreshold>(
    selectedModels.map((model) => [model.id, computeThreshold(model.id, updatedHistory)]),
  );

  console.log('');
  console.log(formatMultiModelReport(reportsWithResults, thresholds));

  const degraded = reportsWithResults.filter((report) => report.degradationLikely);
  if (degraded.length > 0) {
    throw new Error(`Degradation detected in: ${degraded.map((report) => report.model).join(', ')}`);
  }
}
