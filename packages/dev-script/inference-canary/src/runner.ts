/**
 * Top-level canary orchestrator: runs all probes for a model and produces a report.
 */
import { writeFailureArtifact, } from './linter-artifacts.ts';
import { mean, } from './math.ts';
import {
  defaultConfig,
  type RunnerConfig,
} from './runner-config.ts';
import { runProbe, } from './runner-probe.ts';
import { fetchServerTimestamp, } from './server-time.ts';

import type { Probe, } from './probes.ts';
// oxlint-disable-next-line no-duplicate-imports -- local type use; re-exported below for consumers
import type {
  CanaryReport,
  ProbeResult,
} from './runner-types.ts';

export type {
  RunnerConfig,
  VerbosityLevel,
} from './runner-config.ts';
export type {
  CanaryReport,
  ProbeResult,
} from './runner-types.ts';

/**
 * Computes per-category mean scores from probe results.
 *
 * @param results - completed probe results
 *
 * @returns mean score per category
 */
function computeCategoryScores(results: readonly ProbeResult[],): Record<string, number> {
  const categories = [...new Set(results.map(function getCategory(result,): string {
    return result.category;
  },),),];
  return Object.fromEntries(
    categories.map(function categoryEntry(category,): [string, number,] {
      const categoryResults = results.filter(function matchCategory(result,): boolean {
        return result.category === category;
      },);
      return [category, mean(categoryResults.map(function getScore(result,): number {
        return result.meanScore;
      },),),];
    },),
  );
}

/**
 * Runs all provided probes and produces a diagnostic report.
 *
 * @param probes - canary probes to execute
 *
 * @param config - runner configuration (merged with defaults)
 *
 * @returns full canary report with degradation assessment
 */
export async function runCanary(
  probes: readonly Probe[],
  config: Partial<RunnerConfig> = {},
): Promise<CanaryReport> {
  const mergedConfig: RunnerConfig = { ...defaultConfig, ...config, };
  const timestamp = await fetchServerTimestamp();

  const probesToRun = probes.filter(
    function notSkipped(probe,): boolean {
      return !mergedConfig.skipProbes?.get(mergedConfig.label,)?.has(probe.name,);
    },
  );

  if (probesToRun.length < probes.length) {
    console.log(
      `[${mergedConfig.label}] skipping ${
        String(probes.length - probesToRun.length,)
      } probe(s) with recent results`,
    );
  }
  console.log(
    `[${mergedConfig.label}] testing with ${String(probesToRun.length,)} probe(s)...`,
  );

  try {
    const results = await Promise.all(
      probesToRun.map(async function runOne(probe,): Promise<ProbeResult> {
        const result = await runProbe(probe, mergedConfig, timestamp,);
        console.log(
          `  [${mergedConfig.label}:${probe.name}] => mean=${
            String(result
              .meanScore
              .toFixed(2,),)
          }`,
        );
        return result;
      },),
    );

    const overallScore = mean(results.map(function getScore(result,): number {
      return result.meanScore;
    },),);

    return {
      model: mergedConfig.model,
      label: mergedConfig.label,
      timestamp,
      results,
      overallScore,
      categoryScores: computeCategoryScores(results,),
      failed: false,
    };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error,);
    console.error(`  [${mergedConfig.label}] FAILED: ${message}`,);

    // Write a failure artifact so the artifact directory records that this run
    // was attempted, even though no probes completed successfully.
    try {
      await writeFailureArtifact({
        model: mergedConfig.model,
        label: mergedConfig.label,
        timestamp,
        failed: true,
        error: message,
        config: {
          verbosity: mergedConfig.verbosity,
          reasoning: mergedConfig.reasoning,
          maxTokens: mergedConfig.maxTokens,
          consistencyRuns: mergedConfig.consistencyRuns,
        },
      },);
    }
    catch (writeError) {
      console.error(`  [${mergedConfig.label}] failed to write failure artifact:`,
        writeError,);
    }

    return {
      model: mergedConfig.model,
      label: mergedConfig.label,
      timestamp,
      results: [],
      overallScore: 0,
      categoryScores: {},
      failed: true,
      error: message,
    };
  }
}
