/**
 * Score implementation for code-generation probes.
 *
 * Extracts code from the model response, launches correctness, lint, perf, and
 * additional container runs in parallel, caches all results, and computes a
 * combined score. Extracted from the probe factory to keep each module under
 * the line limit.
 */
import {
  type ContainerResult,
  runInContainer,
} from '../container.ts';
import {
  l,
  tagged,
} from '../log.ts';
import {
  runInContainerTimed,
  type TimedContainerResult,
} from './perf.ts';
import {
  cacheAdditionalResults,
  computeAdditionalCorrectnesses,
  executeAdditionalRuns,
} from './probe-factory-additional.ts';
import { cacheAndComputePerfMultiplier, } from './probe-factory-run-perf.ts';
import {
  combinedScore,
  lintAndLog,
  tryExtractCode,
} from './scoring.ts';

import type { LintResult, } from '../linter.ts';
import type { ScoreContext, } from '../probes.ts';
import type {
  CodeGenProbeConfig,
  WritableProbeFactoryCaches,
} from './probe-factory-types.ts';

/**
 * Options for {@link scoreImpl}.
 *
 * @example
 * ```ts
 * const options: ScoreImplOptions = {
 *   config: probeConfig,
 *   response: 'raw model text',
 *   context: scoreContext,
 *   caches: probeFactoryCaches,
 * };
 * ```
 */
type ScoreImplOptions = {
  /**
   * Probe configuration with testInput, verify, perfTest, and additionalRuns
   */
  readonly config: CodeGenProbeConfig;
  /**
   * Raw model response text containing a fenced code block
   */
  readonly response: string;
  /**
   * Scoring context with model label, pass, timestamp, and abort signal
   */
  readonly context: ScoreContext;
  /**
   * Shared per-model caches populated for downstream use by buildFixPromptImpl
   */
  readonly caches: WritableProbeFactoryCaches;
};

/**
 * Executes the full scoring pipeline for a code-generation probe.
 *
 * Extracts code from the model response, applies optional source transforms,
 * launches all container runs (correctness, lint, perf, additional) in parallel,
 * caches results for the fix prompt builder, and computes a combined score
 * that gates on correctness and penalizes lint/type/perf issues.
 *
 * @param config - probe configuration with testInput, verify, perfTest, and additionalRuns
 *
 * @param response - raw model response text containing a fenced code block
 *
 * @param context - scoring context with model label, pass, timestamp, and abort signal
 *
 * @param caches - shared per-model caches populated for downstream use by buildFixPromptImpl
 *
 * @returns combined score in [0, 1] range
 *
 * @example
 * ```ts
 * const score = await scoreImpl({ config, response, context, caches });
 * // score in [0, 1]
 * ```
 */
export async function scoreImpl({
  config,
  response,
  context,
  caches,
}: ScoreImplOptions,): Promise<number> {
  /**
   * Probe-specific logger for scoring messages.
   */
  const rl = tagged({
    tag: config.name,
    l: tagged({
      tag: context.label,
      l,
    },),
  },);
  /**
   * Extraction result: source code and whether a fenced block was found
   */
  const extraction = tryExtractCode(response,);
  if (!extraction.fenced) {
    rl.info('no fenced code block found in response',);
    // Still lint the raw response so artifacts are written for debugging,
    // but score is forced to 0 since the model didn't follow the output format.
    await lintAndLog({
      source: extraction.source,
      probeName: config.name,
      context,
    },);
    return 0;
  }

  /**
   * Extracted TypeScript source from the model response
   */
  const rawSource = extraction.source;
  /**
   * Source after probe-level transform, with reject flag for constraint violations
   */
  const transformed = config.transformSource
    !== undefined
    ? config.transformSource(
      rawSource,
      context,
    )
    : {
      reject: false,
      source: rawSource,
    };

  /**
   * Final source to execute in containers
   */
  const { source, } = transformed;

  /**
   * Abort signal from the score context, destructured so the spread guard below has no member chain.
   */
  const {
    signal,
  } = context;
  /**
   * Spread-friendly abort signal; included only when the score context carries one, to satisfy exactOptionalPropertyTypes.
   */
  const signalArg = signal !== undefined ? { signal, } : {};

  // Launch all container runs in parallel: correctness + lint + perf + additional
  /**
   * Main correctness container promise
   */
  const correctnessPromise = runInContainer({
    source,
    stdinData: config.testInput,
    ...signalArg,
  },);
  /**
   * Lint analysis promise
   */
  const lintPromise = lintAndLog({
    source,
    probeName: config.name,
    context,
  },);
  /**
   * Perf container promise (undefined when no perfTest configured)
   */
  const perfPromise = config.perfTest
    !== undefined
    ? runInContainerTimed({
      source,
      input: config.perfTest
        .input,
      ...signalArg,
    },)
    : undefined;
  /**
   * Additional run container promises (empty array when no additional runs)
   */
  const additionalPromise = config.additionalRuns
    !== undefined
    ? executeAdditionalRuns({
      source,
      runs: config.additionalRuns,
      ...signalArg,
    },)
    : undefined;

  /**
   * Correctness container result and lint analysis awaited together so downstream caching and scoring see both.
   */
  const [result, lint,] = await Promise.all([
    correctnessPromise,
    lintPromise,
  ],);
  /**
   * Awaited perf container result; undefined when this probe declares no perf test.
   */
  const perfResult = perfPromise !== undefined ? await perfPromise : undefined;
  /**
   * Awaited additional-run results, in declaration order; undefined when no additional runs are configured.
   */
  const additionalResults = additionalPromise !== undefined
    ? await additionalPromise
    : undefined;

  caches.lint
    .set(
    context.label,
    lint,
  );
  caches.container
    .set(
    context.label,
    result,
  );

  // Cache and verify additional runs
  if ((additionalResults !== undefined) && (config.additionalRuns
    !== undefined)) {
    cacheAdditionalResults({
      results: additionalResults,
      runs: config.additionalRuns,
      containerCaches: caches.additionalContainers,
      verifyCaches: caches.additionalVerify,
      label: context.label,
    },);
  }

  /**
   * Perf score in [0, 1]; multiplied into the combined score so slow runs degrade the full result, not a fraction of it.
   */
  const perfMultiplier = cacheAndComputePerfMultiplier({
    config,
    context,
    caches,
    ...((perfResult !== undefined) ? { perfResult, } : {}),
  },);

  if (transformed.reject) {
    return combinedScore({
      correctness: 0,
      lint,
    },)
      * perfMultiplier;
  }
  if (result.timedOut
    || (result.exitCode
      !== 0)) {
    rl.info(
      `container failed: exit=${String(result.exitCode,)} timedOut=${
        String(result.timedOut,)
      }`,
    );
    return combinedScore({
      correctness: 0,
      lint,
    },)
      * perfMultiplier;
  }

  /**
   * Main-run correctness fraction from the probe's verifier; combined below with additional-run correctness via `Math.min`.
   */
  const { correctness: mainCorrectness, } = config.verify(result,);

  // Combine main and additional run correctness via Math.min;
  // every run must achieve perfect correctness for a non-zero final score
  /**
   * Per-run correctness fractions from additional runs (empty when none configured)
   */
  const additionalCorrectnesses =
    (additionalResults !== undefined) && (config.additionalRuns
      !== undefined)
      ? computeAdditionalCorrectnesses({
        results: additionalResults,
        runs: config.additionalRuns,
        verifyCaches: caches.additionalVerify,
        label: context.label,
        probeName: config.name,
      },)
      : [];

  /**
   * Combined correctness: minimum of main and all additional runs
   */
  const overallCorrectness = Math.min(
    mainCorrectness,
    ...additionalCorrectnesses,
  );
  return combinedScore({
    correctness: overallCorrectness,
    lint,
  },)
    * perfMultiplier;
}
