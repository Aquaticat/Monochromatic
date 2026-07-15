/**
 * Core execution block for the inference canary: runs probes, prints report.
 *
 * History persistence is handled by artifact enrichment in the runner pipeline.
 * Degradation detection against historical baselines is the viewer's responsibility.
 */
import {
  l,
  tagged,
} from './log.ts';
import { formatMultiModelReport, } from './report.ts';
import {
  type CanaryReport,
  runCanary,
  type RunnerConfigOverrides,
} from './runner.ts';

import type { ModelConfig, } from './models.ts';
import type { Probe, } from './probes.ts';

/**
 * Options for {@link runAndReport}.
 *
 * @example
 * ```ts
 * const opts: RunAndReportOptions = {
 *   selectedModels,
 *   probes,
 *   recentModelProbePairs: new Map(),
 *   recentlyFailedModels: new Set(),
 *   apiKey: 'sk-or-v1-...',
 *   runsOverride: undefined,
 * };
 * ```
 */
export type RunAndReportOptions = {
  /**
   * Models to test
   */
  readonly selectedModels: readonly ModelConfig[];
  /**
   * Probes to run on each model
   */
  readonly probes: readonly Probe[];
  /**
   * Model:probe pairs to skip (tested recently)
   */
  readonly recentModelProbePairs: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * Model labels that had a whole-model failure recently (e.g. 429)
   */
  readonly recentlyFailedModels: ReadonlySet<string>;
  /**
   * OpenRouter API key
   */
  readonly apiKey: string;
  /**
   * Override for the number of consistency runs (already parsed as integer), omit to use config default
   */
  readonly runsOverride?: number;
};

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
 *
 * @example
 * ```ts
 * await runAndReport({
 *   selectedModels,
 *   probes,
 *   recentModelProbePairs: recentPairs,
 *   recentlyFailedModels: failedModels,
 *   apiKey,
 *   runsOverride: undefined,
 * });
 * ```
 */
export async function runAndReport({
  selectedModels,
  probes,
  recentModelProbePairs,
  recentlyFailedModels,
  apiKey,
  runsOverride,
}: RunAndReportOptions,): Promise<void> {
  /**
   * Partial config patch carrying the consistency-runs override, or empty when no override is set.
   */
  const consistencyRunsOverride: Pick<RunnerConfigOverrides, 'consistencyRuns'> =
    runsOverride !== undefined ? { consistencyRuns: runsOverride, } : {};

  /**
   * Models that survive the recent-failure filter.
   *
   * Models with a whole-model failure (e.g. 429, auth error) in the last 24 hours
   * are dropped; their failure artifacts are already recorded and a retest would
   * just hit the same error.
   */
  const modelsToRun = selectedModels.filter(function shouldRun(model,): boolean {
    if (recentlyFailedModels.has(model.label,)) {
      /**
       * Model-specific logger for skip messages.
       */
      const rl = tagged({
        tag: model.label,
        l,
      },);
      rl.info('skipping all probes (recent whole-model failure)',);
      return false;
    }
    return true;
  },);

  /**
   * Canary reports for every kept model; promise fan-out so models run concurrently.
   */
  const reports: readonly CanaryReport[] = await Promise.all(
    modelsToRun.map(function runModel(model,): Promise<CanaryReport> {
      return runCanary({
        probes,
        config: {
          model: model.openrouterId,
          label: model.label,
          verbosity: model.verbosity,
          apiKey,
          skipProbes: recentModelProbePairs,
          ...consistencyRunsOverride,
        },
      },);
    },),
  );

  /**
   * Reports that produced at least one probe result, including timed-out probes (score 0).
   */
  const reportsWithResults = reports.filter(function hasResults(report,): boolean {
    return report.results
      .length
      > 0;
  },);
  /**
   * Reports that recorded a whole-model failure such as a 429 or auth error.
   */
  const failedReports = reports.filter(function isFailed(report,): boolean {
    return report.failed;
  },);

  // Only skip the report when all probes were cached and nothing actually ran or failed.
  // Probe-level timeouts now produce zero-score results rather than failing the model,
  // so they appear in reportsWithResults and are never silently dropped.
  if ((reportsWithResults.length
    === 0) && (failedReports.length
      === 0)) {
    l.info(
      'all probes skipped due to recent results. Use --retest-all to force re-run.',
    );
    return;
  }

  /**
   * Union of both report kinds for the final formatted output.
   *
   * `reportsWithResults` covers timed-out models (zero-score results) and
   * `failedReports` covers whole-model failures (API errors, auth failures, etc.).
   */
  const reportsToDisplay = [
    ...reportsWithResults,
    ...failedReports,
  ];
  l.info(formatMultiModelReport(reportsToDisplay,),);
}
