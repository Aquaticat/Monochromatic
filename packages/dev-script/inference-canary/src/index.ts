/**
 * CLI entry point for the inference canary.
 *
 * Tests multiple models in parallel by default. Skips models with
 * recent (<24h) results unless --force is passed.
 *
 * Usage:
 *   bun packages/dev-script/inference-canary/src/index.ts [options]
 *
 * Options:
 *   --model <id>     Test a single model instead of all
 *   --runs <n>       Consistency runs per probe (default: 2)
 *   --simple         Run cheap text-only probes instead of code-gen
 *   --slow           Include slow probes (e.g. task-scheduler)
 *   --retest-all     Retest all models even if recent (<24h) results exist
 *
 * Environment (read from .env.local via mise):
 *   INFERENCE_VALIDATION_OPENROUTER_API_KEY -- OpenRouter API key
 */
import { appendHistory, computeThreshold, getRecentModelProbePairs, hasRecentResults, readHistory, } from './history.ts';
import { models, } from './models.ts';
import { codeGenProbes, codeGenProbesAll, simpleProbes, } from './probes.ts';
import { formatMultiModelReport, } from './report.ts';
import { runCanary, } from './runner.ts';

import type { HistoryEntry, ModelThreshold, } from './history.ts';
import type { ModelConfig, } from './models.ts';
import type { CanaryReport, } from './runner.ts';

//region CLI argument parsing

/** Raw CLI arguments after the script path */
const args = process.argv.slice(2);

/**
 * Extracts a named flag value from CLI args.
 * @param flag - flag name including dashes (e.g. "--model")
 * @returns flag value if present, undefined otherwise
 */
function getFlag(flag: string): string | undefined {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1 || flagIndex + 1 >= args.length) return undefined;
  return args[flagIndex + 1];
}

/** Single-model override from --model flag */
const modelOverride = getFlag('--model');

/** Consistency runs override from --runs flag */
const runsOverride = getFlag('--runs');

/** Whether to run simple probes instead of code-gen */
const useSimple = args.includes('--simple');

/** Whether to include slow probes */
const includeSlow = args.includes('--slow');

/** Retest all models even if they have recent (<24h) results */
const retestAll = args.includes('--retest-all');

//endregion CLI argument parsing

//region API key resolution

const apiKey = process.env['INFERENCE_VALIDATION_OPENROUTER_API_KEY'];
if (apiKey === undefined || apiKey === '') {
  throw new Error('INFERENCE_VALIDATION_OPENROUTER_API_KEY not set in environment');
}

//endregion API key resolution

//region Model selection

const history = await readHistory();

/**
 * Determines which models to test based on CLI flags.
 * @returns models to test
 */
function selectModels(): readonly ModelConfig[] {
  // Single-model mode: find it in registry or create ad-hoc config
  if (modelOverride !== undefined) {
    const found = models.find((model) => model.id === modelOverride);
    if (found !== undefined) return [found];
    return [{ id: modelOverride, label: modelOverride, verbosity: 'low', }];
  }

  if (retestAll) return models;

  // Otherwise run all models (probes will be filtered per-model if needed)
  return models;
}

const selectedModels = selectModels();

/**
 * Set of "model:probeName" pairs that were tested recently.
 * Allows per-probe skipping: only skips specific probes, not entire models.
 */
const recentModelProbePairs = retestAll ? new Set<string>() : getRecentModelProbePairs(history);

//endregion Model selection

//region Execution

if (selectedModels.length === 0) {
  // Nothing to do -- no models selected
  console.log('[canary] no models selected for testing.');
} else {
  // eslint-disable-next-line no-nested-ternary -- simple three-way probe tier selection
  const probes = useSimple ? simpleProbes : includeSlow ? codeGenProbesAll : codeGenProbes;

  console.log(`[canary] testing ${String(selectedModels.length)} model(s) in parallel`);
  console.log(`[canary] probes: ${probes.map((probe) => probe.name).join(', ')}`);
  console.log('');

  // Run all models in parallel -- per-probe 5-min timeout is in the runner
  const reports: readonly CanaryReport[] = await Promise.all(
    selectedModels.map((model) =>
      runCanary(probes, {
        model: model.id,
        verbosity: model.verbosity,
        apiKey,
        degradationThreshold: computeThreshold(model.id, history).threshold,
        skipProbes: recentModelProbePairs,
        ...(runsOverride !== undefined ? { consistencyRuns: Number(runsOverride), } : {}),
      })
    ),
  );

  // Only save and report on models that actually ran probes
  const reportsWithResults = reports.filter((report) => report.results.length > 0);

  if (reportsWithResults.length === 0) {
    console.log('[canary] all probes skipped due to recent results. Use --retest-all to force re-run.');
  } else {
    // Save all results to history
    const entries: HistoryEntry[] = reportsWithResults.map((report) => ({
      timestamp: report.timestamp,
      model: report.model,
      overallScore: report.overallScore,
      probeScores: Object.fromEntries(
        report.results.map((result) => [result.name, result.meanScore]),
      ),
      failed: report.failed,
    }));
    await appendHistory(entries);

    // Compute thresholds (now including the new data)
    const updatedHistory = await readHistory();
    const thresholds = new Map<string, ModelThreshold>(
      selectedModels.map((model) => [model.id, computeThreshold(model.id, updatedHistory)]),
    );

    console.log('');
    console.log(formatMultiModelReport(reportsWithResults, thresholds));

    // Exit with error if any model is degraded
    const degraded = reportsWithResults.filter((report) => report.degradationLikely);
    if (degraded.length > 0) {
      throw new Error(`Degradation detected in: ${degraded.map((report) => report.model).join(', ')}`);
    }
  }
}

//endregion Execution
