/**
 * CLI entry point for the inference canary.
 *
 * Usage:
 *   bun packages/dev-script/inference-canary/src/index.ts [options]
 *
 * Options:
 *   --model <id>        Test a single model instead of all
 *   --runs <n>          Consistency runs per probe (default: 2)
 *   --probe <names>     Run only the named probes (comma-separated); bypasses recent-result cache
 *   --simple            Run cheap text-only probes instead of code-gen
 *   --slow              Include slow probes (e.g. task-scheduler)
 *   --retest-all        Retest all models even if recent (<24h) results exist
 *
 * Environment (read from .env.local via mise):
 *   INFERENCE_VALIDATION_OPENROUTER_API_KEY -- OpenRouter API key
 */
import whyIsNodeRunning from 'why-is-node-running';
import { getRecentArtifactPairs, } from './linter-artifacts.ts';
import { modelOverride, retestAll, runsOverride, useSimple, includeSlow, probeFilter, } from './index-cli.ts';
import { runAndReport, } from './index-run.ts';
import { models, type ModelConfig, } from './models.ts';
import { codeGenProbes, codeGenProbesAll, simpleProbes, simulationProbes, } from './probes.ts';

//region Elapsed-time log prefix -- prepends "+Xs" to every console.log/error line so interleaved output is easy to timeline

/** Milliseconds per second for elapsed-time display */
const MS_PER_SECOND = 1000;

/** Width of the elapsed-time column so values align up to 999.9s */
const ELAPSED_PAD_WIDTH = 6;

/** Process start time for computing elapsed seconds in log prefixes */
const PROCESS_START_MS = Date.now();

/**
 * Formats elapsed milliseconds as a right-aligned "+NNs" prefix for log lines.
 * @returns elapsed time string like "+  4.2s"
 */
function elapsedPrefix(): string {
  const elapsed = ((Date.now() - PROCESS_START_MS) / MS_PER_SECOND).toFixed(1);
  // Pad to 6 chars so columns align up to 999.9s
  return `[+${elapsed.padStart(ELAPSED_PAD_WIDTH)}s]`;
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

//region API key resolution -- validates INFERENCE_VALIDATION_OPENROUTER_API_KEY before any network calls

const apiKey = process.env['INFERENCE_VALIDATION_OPENROUTER_API_KEY'];
if (apiKey === undefined || apiKey === '') {
  throw new Error('INFERENCE_VALIDATION_OPENROUTER_API_KEY not set in environment');
}

//endregion API key resolution

//region Model selection -- resolves the set of models to test and which probes to skip from recent artifacts

/**
 * Determines which models to test based on CLI flags.
 * @returns models to test
 */
function selectModels(): readonly ModelConfig[] {
  if (modelOverride !== undefined) {
    const found = models.find((model) => model.openrouterId === modelOverride || model.label === modelOverride);
    if (found !== undefined) return [found];
    if (!modelOverride.includes('/')) {
      throw new Error(`Invalid model ID "${modelOverride}": must be in "provider/name" format`);
    }
    // Type assertion: includes('/') check above satisfies the OpenRouterModelId template literal
    const modelId = modelOverride as `${string}/${string}`;
    return [{ openrouterId: modelId, label: modelId, verbosity: 'low', }];
  }
  return models;
}

const selectedModels = selectModels();
const { probePairs: recentModelProbePairs, failedModels: recentlyFailedModels, } = retestAll
  ? { probePairs: new Map<string, ReadonlySet<string>>(), failedModels: new Set<string>(), }
  : await getRecentArtifactPairs();

//endregion Model selection

//region Execution -- selects probe tier (simple/fast/slow), runs canary, throws on degradation

if (selectedModels.length === 0) {
  console.log('[canary] no models selected for testing.');
} else {
  // eslint-disable-next-line no-nested-ternary -- three-way probe tier selection; simulation runs alongside code-gen by default
  const codeGenSet = includeSlow ? codeGenProbesAll : codeGenProbes;
  const allProbes = useSimple ? simpleProbes : [...codeGenSet, ...simulationProbes];

  // Capture in a local const so TypeScript can narrow the type inside callbacks
  const activeProbeFilter = probeFilter;

  const probes = activeProbeFilter !== undefined
    ? allProbes.filter((probe) => activeProbeFilter.has(probe.name))
    : allProbes;

  if (probes.length === 0) {
    const available = allProbes.map((probe) => probe.name).join(', ');
    throw new Error(`--probe matched no probes. Available: ${available}`);
  }

  // When targeting specific probes, bypass the recent-result cache for those probes so
  // they always re-run regardless of how recently they last executed.
  const effectiveRecentPairs = activeProbeFilter !== undefined
    ? new Map(
      [...recentModelProbePairs.entries()].map(([model, skipped]) => [
        model,
        new Set([...skipped].filter((name) => !activeProbeFilter.has(name))),
      ]),
    )
    : recentModelProbePairs;

  console.log(`[canary] testing ${String(selectedModels.length)} model(s) in parallel`);
  console.log(`[canary] probes: ${probes.map((probe) => probe.name).join(', ')}`);
  console.log('');
  await runAndReport(selectedModels, probes, effectiveRecentPairs, recentlyFailedModels, apiKey, runsOverride);
}

// Intermittently, Bun's fetch connection pool or other async resources prevent the
// event loop from draining after all work completes. This watchdog detects when
// the process should have exited but hasn't, dumps the active handles for diagnosis,
// then force-exits so CI pipelines don't hang indefinitely.
/** Seconds to wait before assuming the process is stuck on leaked async resources */
const WATCHDOG_TIMEOUT_SECONDS = 5;

const watchdog = setTimeout(() => {
  console.error('[canary] process did not exit naturally after all work completed, dumping active handles:');
  whyIsNodeRunning();
  // eslint-disable-next-line unicorn/no-process-exit -- required: fallback for intermittent async resource leaks
  process.exit(0);
}, WATCHDOG_TIMEOUT_SECONDS * MS_PER_SECOND);
watchdog.unref();

//endregion Execution
