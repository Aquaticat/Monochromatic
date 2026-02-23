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
import { modelOverride, retestAll, runsOverride, useSimple, includeSlow, } from './index-cli.ts';
import { runAndReport, } from './index-run.ts';
import { models, } from './models.ts';
import { codeGenProbes, codeGenProbesAll, simpleProbes, } from './probes.ts';

import type { ModelConfig, } from './models.ts';

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
  if (modelOverride !== undefined) {
    const found = models.find((model) => model.id === modelOverride);
    if (found !== undefined) return [found];
    return [{ id: modelOverride, label: modelOverride, verbosity: 'low', }];
  }
  return models;
}

const selectedModels = selectModels();
const recentModelProbePairs = retestAll ? new Set<string>() : getRecentModelProbePairs(history);

//endregion Model selection

//region Execution

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
