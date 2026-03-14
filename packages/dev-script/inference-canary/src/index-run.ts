/**
 * Core execution block for the inference canary: runs probes, prints report.
 *
 * History persistence is handled by artifact enrichment in the runner pipeline.
 * Degradation detection against historical baselines is the viewer's responsibility.
 */
import { formatMultiModelReport, } from './report.ts';
import { runCanary, type CanaryReport, type RunnerConfig, } from './runner.ts';

import type { ModelConfig, } from './models.ts';
import type { Probe, } from './probes.ts';

/**
 * Runs canary probes for all selected models and prints the report.
 *
 * Results are persisted as enriched artifacts (meta.json + response.txt) during
 * probe execution. No separate history file is written.
 *
 * @param selectedModels - models to test
 *
 * @param probes - probes to run on each model
 *
 * @param recentModelProbePairs - model:probe pairs to skip (tested recently)
 *
 * @param recentlyFailedModels - model labels that had a whole-model failure recently (e.g. 429)
 *
 * @param apiKey - OpenRouter API key
 *
 * @param runsOverride - optional override for the number of consistency runs (already parsed as integer)
 */
export async function runAndReport(
  selectedModels: readonly ModelConfig[],
  probes: readonly Probe[],
  recentModelProbePairs: ReadonlyMap<string, ReadonlySet<string>>,
  recentlyFailedModels: ReadonlySet<string>,
  apiKey: string,
  runsOverride: number | undefined,
): Promise<void> {
  const consistencyRunsOverride: Pick<Partial<RunnerConfig>, 'consistencyRuns'> =
    runsOverride !== undefined ? { consistencyRuns: runsOverride, } : {};

  // Skip models that had a whole-model failure (e.g. 429, auth error) within the last 24 hours.
  // Their failure artifacts are already recorded; retesting would just hit the same error.
  const modelsToRun = selectedModels.filter(function shouldRun(model): boolean {
    if (recentlyFailedModels.has(model.label)) {
      console.log(`[${model.label}] skipping all probes (recent whole-model failure)`);
      return false;
    }
    return true;
  });

  const reports: readonly CanaryReport[] = await Promise.all(
    modelsToRun.map(function runModel(model): Promise<CanaryReport> {
      return runCanary(probes, {
        model: model.openrouterId,
        label: model.label,
        verbosity: model.verbosity,
        apiKey,
        skipProbes: recentModelProbePairs,
        ...consistencyRunsOverride,
      });
    }),
  );

  const reportsWithResults = reports.filter(function hasResults(report): boolean { return report.results.length > 0; });
  const failedReports = reports.filter(function isFailed(report): boolean { return report.failed; });

  // Only skip the report when all probes were cached and nothing actually ran or failed.
  // Probe-level timeouts now produce zero-score results rather than failing the model,
  // so they appear in reportsWithResults and are never silently dropped.
  if (reportsWithResults.length === 0 && failedReports.length === 0) {
    console.log('[canary] all probes skipped due to recent results. Use --retest-all to force re-run.');
    return;
  }

  // reportsWithResults covers timed-out models (they now have zero-score results);
  // failedReports covers whole-model failures (API errors, auth failures, etc.).
  const reportsToDisplay = [...reportsWithResults, ...failedReports];
  console.log('');
  console.log(formatMultiModelReport(reportsToDisplay));
}
