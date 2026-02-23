/**
 * CLI entry point for the inference canary.
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
import { getRecentModelProbePairs, readHistory, } from './history.ts';

//region Elapsed-time log prefix -- prepends "+Xs" to every console.log/error line so interleaved output is easy to timeline

/** Process start time for computing elapsed seconds in log prefixes */
const PROCESS_START_MS = Date.now();

/**
 * Formats elapsed milliseconds as a right-aligned "+NNs" prefix for log lines.
 * @returns elapsed time string like "+  4.2s"
 */
function elapsedPrefix(): string {
  const elapsed = ((Date.now() - PROCESS_START_MS) / 1000).toFixed(1);
  // Pad to 6 chars so columns align up to 999.9s
  return `[+${elapsed.padStart(6)}s]`;
}

// eslint-disable-next-line no-console -- intentional override to inject timestamps
const originalLog = console.log;
// eslint-disable-next-line no-console -- intentional override to inject timestamps
const originalError = console.error;
// eslint-disable-next-line no-console -- intentional override
console.log = (...args: unknown[]): void => originalLog(elapsedPrefix(), ...args);
// eslint-disable-next-line no-console -- intentional override
console.error = (...args: unknown[]): void => originalError(elapsedPrefix(), ...args);

//endregion Elapsed-time log prefix

import { modelOverride, retestAll, runsOverride, useSimple, includeSlow, } from './index-cli.ts';
import { runAndReport, } from './index-run.ts';
import { models, } from './models.ts';
import { codeGenProbes, codeGenProbesAll, simpleProbes, } from './probes.ts';

import type { ModelConfig, } from './models.ts';

//region API key resolution -- validates INFERENCE_VALIDATION_OPENROUTER_API_KEY before any network calls

const apiKey = process.env['INFERENCE_VALIDATION_OPENROUTER_API_KEY'];
if (apiKey === undefined || apiKey === '') {
  throw new Error('INFERENCE_VALIDATION_OPENROUTER_API_KEY not set in environment');
}

//endregion API key resolution

//region Model selection -- resolves the set of models to test and which probes to skip from recent history

const history = await readHistory();

/**
 * Determines which models to test based on CLI flags.
 * @returns models to test
 */
function selectModels(): readonly ModelConfig[] {
  if (modelOverride !== undefined) {
    const found = models.find((model) => model.id === modelOverride);
    if (found !== undefined) return [found];
    if (!modelOverride.includes('/')) {
      throw new Error(`Invalid model ID "${modelOverride}": must be in "provider/name" format`);
    }
    // Type assertion: includes('/') check above satisfies the OpenRouterModelId template literal
    const modelId = modelOverride as `${string}/${string}`;
    return [{ id: modelId, label: modelId, verbosity: 'low', }];
  }
  return models;
}

const selectedModels = selectModels();
const recentModelProbePairs = retestAll
  ? new Map<string, ReadonlySet<string>>()
  : getRecentModelProbePairs(history);

//endregion Model selection

//region Execution -- selects probe tier (simple/fast/slow), runs canary, throws on degradation

if (selectedModels.length === 0) {
  console.log('[canary] no models selected for testing.');
} else {
  // eslint-disable-next-line no-nested-ternary -- simple three-way probe tier selection
  const probes = useSimple ? simpleProbes : includeSlow ? codeGenProbesAll : codeGenProbes;
  console.log(`[canary] testing ${String(selectedModels.length)} model(s) in parallel`);
  console.log(`[canary] probes: ${probes.map((probe) => probe.name).join(', ')}`);
  console.log('');
  await runAndReport(selectedModels, probes, recentModelProbePairs, history, apiKey, runsOverride);
}

//endregion Execution
