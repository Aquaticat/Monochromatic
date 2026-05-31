/**
 * CLI entry point for the inference canary.
 *
 * Usage:
 *   bun packages/dev-script/inference-canary/src/canary.ts [options]
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
 *   INFERENCE_VALIDATION_OPENROUTER_API_KEY; OpenRouter API key
 */
// Side-effecting import: writes a record to `_invocation-log.jsonl` at the
// package root before any other code runs. Captures process tree, exe path,
// argv, cwd, and env hash so future "who invoked the canary?" investigations
// can be answered by reading one file. Must stay first.
// oxlint-disable-next-line eslint-plugin-import/no-unassigned-import -- intentional side-effect import; module records provenance at top-level
import './invocation-log.ts';

import whyIsNodeRunning from 'why-is-node-running';
import {
  includeSlow,
  probeFilter,
  retestAll,
  runsOverride,
  useSimple,
} from './index-cli.ts';
import { selectModels, } from './index-models.ts';
import { runAndReport, } from './index-run.ts';
import { getRecentArtifactPairs, } from './linter-artifacts-recent.ts';
import { l, } from './log.ts';
import {
  codeGenProbes,
  codeGenProbesAll,
  simpleProbes,
  simulationProbes,
} from './probes.ts';

//region API key resolution: validates INFERENCE_VALIDATION_OPENROUTER_API_KEY before any network calls

/**
 * OpenRouter API key from environment, required for all inference calls.
 */
const apiKey = process.env
  .INFERENCE_VALIDATION_OPENROUTER_API_KEY;
if ((apiKey === undefined) || (apiKey === ''))
  throw new Error('INFERENCE_VALIDATION_OPENROUTER_API_KEY not set in environment',);

//endregion API key resolution

//region Model selection: resolves the set of models to test and which probes to skip from recent artifacts

/**
 * Models selected for this run based on CLI flags.
 */
const selectedModels = selectModels();
/**
 * Recent probe results and failures used to skip recently-tested pairs.
 */
const {
  probePairs: recentModelProbePairs,
  failedModels: recentlyFailedModels,
} = retestAll
  ? {
    probePairs: new Map<string, ReadonlySet<string>>(),
    failedModels: new Set<string>(),
  }
  : await getRecentArtifactPairs();

//endregion Model selection

//region Execution: selects probe tier (simple/fast/slow), runs canary, throws on degradation

if (selectedModels.length
  === 0)
  l.info('no models selected for testing.',);
else {
  /**
   * Code generation probe set, including slow probes when `--slow` is passed.
   */
  const codeGenSet = includeSlow ? codeGenProbesAll : codeGenProbes;
  /**
   * Combined probe list from selected code-gen tier and simulation probes.
   */
  const allProbes = useSimple ? simpleProbes : [
    ...codeGenSet,
    ...simulationProbes,
  ];

  /**
   * Local copy of probe filter for TypeScript narrowing inside callbacks.
   */
  const activeProbeFilter = probeFilter;
  /**
   * Number of names in the probe filter; zero means no `--probe` was given, so all probes run.
   */
  const filterSize = activeProbeFilter.size;

  /**
   * Probes to run, filtered by `--probe` if specified (empty filter set means run all).
   */
  const probes = filterSize > 0
    ? allProbes.filter(function matchFilter(probe,): boolean {
      return activeProbeFilter.has(probe.name,);
    },)
    : allProbes;

  if (probes.length
    === 0) {
    /**
     * Comma-separated list of all available probe names for the error message.
     */
    const available = allProbes
      .map(function getName(probe,): string {
        return probe.name;
      },)
      .join(', ',);
    throw new Error(`--probe matched no probes. Available: ${available}`,);
  }

  // When targeting specific probes, bypass the recent-result cache for those probes so
  // they always re-run regardless of how recently they last executed.
  /**
   * Recent pairs with targeted probes excluded so they always re-run.
   */
  const effectiveRecentPairs = activeProbeFilter !== undefined
    ? new Map(
      [...recentModelProbePairs.entries(),].map(
        function filterPair([model, skipped,],): [
          string,
          Set<string>,
        ] {
          return [
            model,
            new Set([...skipped,].filter(function keepName(name,): boolean {
              return !activeProbeFilter.has(name,);
            },),),
          ];
        },
      ),
    )
    : recentModelProbePairs;

  l.info(`testing ${String(selectedModels.length,)} model(s) in parallel`,);
  l.info(`probes: ${
    probes
      .map(function getName(probe,): string {
        return probe.name;
      },)
      .join(', ',)
  }`,);
  await runAndReport({
    selectedModels,
    probes,
    recentModelProbePairs: effectiveRecentPairs,
    recentlyFailedModels,
    apiKey,
    ...((runsOverride > 0) ? { runsOverride, } : {}),
  },);
}

// Intermittently, Bun's fetch connection pool or other async resources prevent the
// event loop from draining after all work completes. This watchdog detects when
// the process should have exited but hasn't, dumps the active handles for diagnosis,
// then force-exits so CI pipelines don't hang indefinitely.
/**
 * Seconds to wait before assuming the process is stuck on leaked async resources
 */
const WATCHDOG_TIMEOUT_SECONDS = 5;

/**
 * Milliseconds per second for watchdog timeout computation
 */
const WATCHDOG_MS_PER_SECOND = 1_000;

/**
 * Watchdog timer that force-exits after stale async resources prevent natural shutdown.
 */
const watchdog = setTimeout(
  function watchdogTimeout(): void {
    l.error(
      'process did not exit naturally after all work completed, dumping active handles:',
    );
    whyIsNodeRunning();
    // oxlint-disable-next-line unicorn/no-process-exit -- required: fallback for intermittent async resource leaks
    process.exit(0,);
  },
  WATCHDOG_TIMEOUT_SECONDS * WATCHDOG_MS_PER_SECOND,
);
watchdog.unref();

//endregion Execution
