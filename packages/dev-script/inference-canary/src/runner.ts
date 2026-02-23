/**
 * Top-level canary orchestrator: runs all probes for a model and produces a report.
 */
import { runProbe, } from './runner-probe.ts';
import { defaultConfig, } from './runner-config.ts';

export type { CanaryReport, ProbeResult, } from './runner-types.ts';
export type { RunnerConfig, VerbosityLevel, } from './runner-config.ts';

import type { Probe, } from './probes.ts';
import type { CanaryReport, ProbeResult, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';

/**
 * Computes per-category mean scores from probe results.
 * @param results - completed probe results
 * @returns mean score per category
 */
function computeCategoryScores(results: readonly ProbeResult[]): Record<string, number> {
  const categories = [...new Set(results.map((result) => result.category))];
  return Object.fromEntries(
    categories.map((category) => {
      const categoryResults = results.filter((result) => result.category === category);
      const mean = categoryResults.reduce((sum, result) => sum + result.meanScore, 0) / categoryResults.length;
      return [category, mean];
    }),
  );
}

/**
 * Runs all provided probes and produces a diagnostic report.
 * @param probes - canary probes to execute
 * @param config - runner configuration (merged with defaults)
 * @returns full canary report with degradation assessment
 */
export async function runCanary(
  probes: readonly Probe[],
  config: Partial<RunnerConfig> = {},
): Promise<CanaryReport> {
  const mergedConfig: RunnerConfig = { ...defaultConfig, ...config, };
  // Type assertion: new Date().toISOString() always returns ISO 8601 matching ISOTimestamp
  const timestamp = new Date().toISOString() as `${number}-${string}`;

  const probesToRun = probes.filter(
    (probe) => !mergedConfig.skipProbes?.get(mergedConfig.model)?.has(probe.name),
  );

  if (probesToRun.length < probes.length) {
    console.log(`[${mergedConfig.model}] skipping ${String(probes.length - probesToRun.length)} probe(s) with recent results`);
  }
  console.log(`[${mergedConfig.model}] testing with ${String(probesToRun.length)} probe(s)...`);

  try {
    const results = await Promise.all(
      probesToRun.map(async (probe) => {
        const result = await runProbe(probe, mergedConfig);
        console.log(`  [${mergedConfig.model}:${probe.name}] => mean=${String(result.meanScore.toFixed(2))}`);
        return result;
      }),
    );

    const overallScore = results.reduce((sum, result) => sum + result.meanScore, 0) / results.length;

    return {
      model: mergedConfig.model,
      timestamp,
      results,
      overallScore,
      categoryScores: computeCategoryScores(results),
      degradationLikely: overallScore < mergedConfig.degradationThreshold,
      failed: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  [${mergedConfig.model}] FAILED: ${message}`);
    return {
      model: mergedConfig.model,
      timestamp,
      results: [],
      overallScore: 0,
      categoryScores: {},
      degradationLikely: true,
      failed: true,
      error: message,
    };
  }
}
