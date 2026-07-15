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
  type RunnerConfigOverrides,
} from './runner-config.ts';
import { handleRunFailure, } from './runner-failure.ts';
import { runProbe, } from './runner-probe.ts';
import { fetchServerTimestamp, } from './server-time.ts';

import type { Probe, } from './probes.ts';
import type {
  CanaryReport,
  ProbeResult,
} from './runner-types.ts';

export type {
  RunnerConfig,
  RunnerConfigOverrides,
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
  /**
   * Scores contributed by this probe: mean of initial runs plus optional fix-pass score.
   */
  const scores = [
    result.meanScore,
  ];
  if (result.pass2Score
    !== undefined)
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
  /**
   * Distinct probe categories observed in the results; one map entry is emitted per category.
   */
  const categories = [...new Set(results.map(function getCategory(result,): string {
    return result.category;
  },),),];
  return Object.fromEntries(
    categories.map(function categoryEntry(category,): [
      string,
      number,
    ] {
      /**
       * Probe results scoped to one category; their scores are averaged for that bucket.
       */
      const categoryResults = results.filter(function matchCategory(result,): boolean {
        return result.category
          === category;
      },);
      return [
        category,
        mean(categoryResults.flatMap(function extractScores(result,): number[] {
          return collectScores(result,);
        },),),
      ];
    },),
  );
}

/**
 * Options for {@link runCanary}.
 *
 * @example
 * ```ts
 * const opts: RunCanaryOptions = {
 *   probes: codeGenProbes,
 *   config: { model: 'opus', label: 'Opus 4.6', apiKey },
 * };
 * ```
 */
type RunCanaryOptions = {
  /**
   * Canary probes to execute
   */
  readonly probes: readonly Probe[];
  /**
   * Runner configuration overrides (merged with defaults)
   */
  readonly config?: RunnerConfigOverrides;
};

/**
 * Runs all provided probes and produces a diagnostic report.
 *
 * @param probes - canary probes to execute
 *
 * @param config - runner configuration (merged with defaults)
 *
 * @returns full canary report with degradation assessment
 *
 * @example
 * ```ts
 * const report = await runCanary({ probes, config: { model: 'opus', label: 'Opus 4.6', apiKey } });
 * report.overallScore; // aggregate score across all probes
 * ```
 */
export async function runCanary({
  probes,
  config = {},
}: RunCanaryOptions,): Promise<CanaryReport> {
  /**
   * Full config with user overrides merged onto {@link defaultConfig}; used everywhere below.
   */
  const mergedConfig: RunnerConfig = {
    ...defaultConfig,
    ...config,
  };
  /**
   * Model-specific logger for progress and result messages.
   */
  const rl = tagged({
    tag: mergedConfig.label,
    l,
  },);
  /**
   * Authoritative server timestamp; consumed for artifact directory naming so retries collide deterministically.
   */
  const timestamp = await fetchServerTimestamp();

  /**
   * Probes left after filtering against the recent-artifact skip list.
   */
  const probesToRun = probes.filter(
    function notSkipped(probe,): boolean {
      return mergedConfig.skipProbes
        ?.get(mergedConfig.label,)
        ?.has(probe.name,)
        !== true;
    },
  );

  if (probesToRun.length
    < probes
    .length) {
    rl.info(
      `skipping ${
        String(probes.length
          - probesToRun
          .length,)
      } probe(s) with recent results`,
    );
  }
  rl.info(
    `testing with ${String(probesToRun.length,)} probe(s)...`,
  );

  try {
    /**
     * Probe results gathered concurrently; one entry per probe in {@link probesToRun}.
     */
    const results = await Promise.all(
      probesToRun.map(async function runOne(probe,): Promise<ProbeResult> {
        /**
         * Completed probe result; the per-probe `info` log below summarises its mean.
         */
        const result = await runProbe({
          probe,
          config: mergedConfig,
          timestamp,
        },);
        /**
         * Probe-specific logger for result summary.
         */
        const pl = tagged({
          tag: probe.name,
          l: rl,
        },);
        pl.info(
          `=> mean=${
            result
              .meanScore
              .toFixed(2,)
          }`,
        );
        return result;
      },),
    );

    /**
     * Aggregate score across all probes (initial + fix scores treated equally).
     */
    const overallScore = mean(results.flatMap(function extractScores(result,): number[] {
      return collectScores(result,);
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
    return handleRunFailure({
      error,
      mergedConfig,
      timestamp,
    },);
  }
}
