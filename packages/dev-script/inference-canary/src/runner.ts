/**
 * Top-level canary orchestrator: runs all probes for a model and produces a report.
 */
import {
  l,
  tagged,
} from './log.ts';
import { mean, } from './math.ts';
import {
  defaultConfig,
  type RunnerConfig,
} from './runner-config.ts';
import { handleRunFailure, } from './runner-failure.ts';
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
 * Collects all scores from a probe result: initial mean score and fix pass score (when present).
 * Fix pass scores are given equal weight to initial scores in the arithmetic mean.
 *
 * @param result - completed probe result
 *
 * @returns array of 1 or 2 scores
 */
function collectScores(result: ProbeResult,): number[] {
  const scores = [result.meanScore,];
  if (result.pass2Score !== undefined)
    scores.push(result.pass2Score,);
  return scores;
}

/**
 * Computes per-category scores from probe results.
 * Both initial and fix pass scores contribute equally to the arithmetic mean.
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
    categories.map(function categoryEntry(category,): [
      string,
      number,
    ] {
      const categoryResults = results.filter(function matchCategory(result,): boolean {
        return result.category === category;
      },);
      return [
        category,
        mean(categoryResults.flatMap(collectScores,),),
      ];
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
  const mergedConfig: RunnerConfig = {
    ...defaultConfig,
    ...config,
  };
  /** Model-specific logger for progress and result messages. */
  const rl = tagged({
    tag: mergedConfig.label,
    l,
  },);
  const timestamp = await fetchServerTimestamp();

  const probesToRun = probes.filter(
    function notSkipped(probe,): boolean {
      return mergedConfig.skipProbes?.get(mergedConfig.label,)?.has(probe.name,) !== true;
    },
  );

  if (probesToRun.length < probes.length) {
    rl.info(
      `skipping ${
        String(probes.length - probesToRun.length,)
      } probe(s) with recent results`,
    );
  }
  rl.info(
    `testing with ${String(probesToRun.length,)} probe(s)...`,
  );

  try {
    const results = await Promise.all(
      probesToRun.map(async function runOne(probe,): Promise<ProbeResult> {
        const result = await runProbe(
          probe,
          mergedConfig,
          timestamp,
        );
        /** Probe-specific logger for result summary. */
        const pl = tagged({
          tag: probe.name,
          l: rl,
        },);
        pl.info(
          `=> mean=${
            String(result
              .meanScore
              .toFixed(2,),)
          }`,
        );
        return result;
      },),
    );

    const overallScore = mean(results.flatMap(collectScores,),);

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
    return handleRunFailure(
      error,
      mergedConfig,
      timestamp,
    );
  }
}
