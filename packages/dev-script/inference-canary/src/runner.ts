/**
 * Runs canary probes against the Anthropic API and scores responses.
 *
 * Uses self-consistency (multiple runs per probe) to distinguish genuine degradation
 * from sampling variance. A single bad answer could be an unlucky sample;
 * consistently bad answers across runs indicate a systemic problem.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
import Anthropic from '@anthropic-ai/sdk';

import type { Probe, } from './probes.ts';

//region Types

/** Result of a single probe execution */
export type ProbeResult = {
  readonly name: string;
  readonly category: Probe['category'];
  /** Scores from each consistency run (length = consistencyRuns) */
  readonly scores: readonly number[];
  /** Mean score across all runs */
  readonly meanScore: number;
  /** Whether all runs agreed (high consistency = reliable signal) */
  readonly consistent: boolean;
  /**
   * Score after a second pass where the model gets its code + linter/type-checker
   * output and tries to fix issues. Undefined if the probe doesn't support it
   * or the first pass produced no diagnostics.
   */
  readonly pass2Score?: number | undefined;
  /**
   * Improvement from pass 1 to pass 2 (pass2Score - meanScore).
   * Positive = model improved; zero/negative = degradation signal.
   */
  readonly fixDelta?: number | undefined;
};

/** Aggregate report across all probes */
export type CanaryReport = {
  readonly model: string;
  readonly timestamp: string;
  readonly results: readonly ProbeResult[];
  /** Overall health score 0-1 */
  readonly overallScore: number;
  /** Per-category scores for targeted diagnosis */
  readonly categoryScores: Record<string, number>;
  /** Whether degradation is likely based on thresholds */
  readonly degradationLikely: boolean;
};

/** Anthropic effort levels for controlling token spend */
export type EffortLevel = 'low' | 'medium' | 'high';

/** Configuration for the canary runner */
export type RunnerConfig = {
  /** Anthropic model ID (or OpenRouter model path) to test */
  readonly model: string;
  /** Number of times to run each probe for consistency checking */
  readonly consistencyRuns: number;
  /** Maximum tokens per probe response (includes thinking budget) */
  readonly maxTokens: number;
  /**
   * Anthropic effort parameter -- controls how eagerly the model spends tokens.
   * With adaptive thinking, this also controls thinking depth.
   * "high" is the default and produces the best results.
   */
  readonly effort: EffortLevel;
  /** Overall score below which degradation is flagged */
  readonly degradationThreshold: number;
  /** API key override (defaults to ANTHROPIC_API_KEY env var) */
  readonly apiKey?: string;
  /** Base URL override for OpenRouter or other API-compatible providers */
  readonly baseURL?: string;
};

//endregion Types

//region Defaults

/** Conservative defaults tuned for quick diagnostics */
export const defaultConfig: RunnerConfig = {
  model: 'claude-sonnet-4-6-20260217',
  consistencyRuns: 2,
  maxTokens: 128_000,
  effort: 'high',
  degradationThreshold: 0.4,
} as const;

//endregion Defaults

//region Runner

/**
 * Sends a single probe to the API and returns the raw text response.
 * @param client - initialized Anthropic SDK client
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @returns raw text response from the model
 */
async function executeProbe(
  client: Anthropic,
  probe: Probe,
  config: RunnerConfig,
): Promise<string> {
  // Streaming required: the SDK mandates it for max_tokens > ~21k to avoid HTTP timeouts.
  // .stream() returns an AsyncIterable; .finalMessage() collects the full response.
  const stream = client.messages.stream({
    model: config.model,
    max_tokens: config.maxTokens,
    system: probe.system,
    messages: [{ role: 'user', content: probe.prompt, }],
    // Adaptive thinking: model decides when and how much to think;
    // effort parameter controls depth. No temperature allowed.
    thinking: { type: 'adaptive', },
    output_config: { effort: config.effort, },
  });
  const message = await stream.finalMessage();

  // With thinking enabled, response has thinking blocks then text blocks.
  // Extract only the text content, skipping thinking blocks.
  const textBlock = message.content.find(
    (block) => block.type === 'text',
  );
  if (textBlock === undefined || textBlock.type !== 'text') {
    return '';
  }
  return textBlock.text;
}

/**
 * Runs a single probe multiple times for consistency checking.
 * @param client - initialized Anthropic SDK client
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @returns scored result with consistency information
 */
async function runProbe(
  client: Anthropic,
  probe: Probe,
  config: RunnerConfig,
): Promise<ProbeResult> {
  // Consistency runs are sequential to avoid rate limits
  const scores: number[] = [];
  // Keep last response for the second pass
  // eslint-disable-next-line prefer-const -- mutated in loop below
  let lastResponse = '';
  for (
    let runIndex = 0;
    runIndex < config.consistencyRuns;
    runIndex++
  ) {
    // eslint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
    lastResponse = await executeProbe(client, probe, config);
    // eslint-disable-next-line no-await-in-loop -- score may involve container execution
    scores.push(await probe.score(lastResponse));
    console.log(`  [${probe.name}] run ${String(runIndex + 1)}/${String(config.consistencyRuns)}: score=${String(scores[runIndex])}`);
  }

  const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const consistent = scores.every((score) => score === scores[0]);

  // Second pass: feed diagnostics back and see how many issues the model fixes
  const pass2Result = await runSecondPass(client, probe, config, lastResponse);
  if (pass2Result !== undefined) {
    console.log(`  [${probe.name}] pass2: score=${String(pass2Result.toFixed(2))} delta=${String((pass2Result - meanScore).toFixed(2))}`);
  }

  return {
    name: probe.name,
    category: probe.category,
    scores,
    meanScore,
    consistent,
    pass2Score: pass2Result,
    fixDelta: pass2Result !== undefined ? pass2Result - meanScore : undefined,
  };
}

/**
 * Runs the second pass: sends the model its code + diagnostics and scores the fix.
 * @param client - Anthropic SDK client
 * @param probe - probe that produced the first-pass response
 * @param config - runner configuration
 * @param firstResponse - raw model output from the first pass
 * @returns second-pass score, or undefined if skipped
 */
async function runSecondPass(
  client: Anthropic,
  probe: Probe,
  config: RunnerConfig,
  firstResponse: string,
): Promise<number | undefined> {
  if (probe.buildFixPrompt === undefined) return undefined;

  const fixPrompt = await probe.buildFixPrompt(firstResponse);
  if (fixPrompt === undefined) {
    console.log(`  [${probe.name}] pass2: skipped (no diagnostics to fix)`);
    return undefined;
  }

  console.log(`  [${probe.name}] pass2: sending fix prompt...`);

  // Send as a multi-turn conversation: original prompt + response + fix request
  const stream = client.messages.stream({
    model: config.model,
    max_tokens: config.maxTokens,
    system: probe.system,
    messages: [
      { role: 'user', content: probe.prompt, },
      { role: 'assistant', content: firstResponse, },
      { role: 'user', content: fixPrompt, },
    ],
    thinking: { type: 'adaptive', },
    output_config: { effort: config.effort, },
  });
  const message = await stream.finalMessage();
  const textBlock = message.content.find((block) => block.type === 'text');
  if (textBlock === undefined || textBlock.type !== 'text') return undefined;

  return probe.score(textBlock.text);
}

/**
 * Computes per-category mean scores from probe results.
 * @param results - completed probe results
 * @returns mean score per category
 */
/**
 * Computes per-category mean scores from probe results.
 * Dynamically discovers categories from the results rather than hardcoding.
 * @param results - completed probe results
 * @returns mean score per category
 */
function computeCategoryScores(
  results: readonly ProbeResult[],
): Record<string, number> {
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
  const client = new Anthropic({
    ...(mergedConfig.apiKey !== undefined ? { apiKey: mergedConfig.apiKey, } : {}),
    ...(mergedConfig.baseURL !== undefined ? { baseURL: mergedConfig.baseURL, } : {}),
  });

  console.log(`[canary] testing model: ${mergedConfig.model}`);
  console.log(`[canary] consistency runs per probe: ${String(mergedConfig.consistencyRuns)}`);
  console.log(`[canary] degradation threshold: ${String(mergedConfig.degradationThreshold)}`);
  console.log(`[canary] running ${String(probes.length)} probes in parallel...`);
  console.log('');

  // Fire all probes concurrently -- API calls, container execution, and linting
  // all proceed in parallel. Logging interleaves but that's acceptable.
  const results = await Promise.all(
    probes.map(async (probe) => {
      console.log(`[canary] running probe: ${probe.name} (${probe.category})`);
      const result = await runProbe(client, probe, mergedConfig);
      console.log(`  [${probe.name}] => mean=${String(result.meanScore.toFixed(2))} consistent=${String(result.consistent)}`);
      return result;
    }),
  );

  const overallScore = results.reduce((sum, result) => sum + result.meanScore, 0) / results.length;
  const categoryScores = computeCategoryScores(results);
  const degradationLikely = overallScore < mergedConfig.degradationThreshold;

  return {
    model: mergedConfig.model,
    timestamp: new Date().toISOString(),
    results,
    overallScore,
    categoryScores,
    degradationLikely,
  };
}

//endregion Runner
