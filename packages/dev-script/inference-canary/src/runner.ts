/**
 * Runs canary probes against an OpenAI-compatible chat completions endpoint.
 *
 * Uses the OpenAI SDK with streaming to get per-chunk timing data, which helps
 * diagnose whether latency is from time-to-first-token, thinking, or generation.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
import OpenAI from 'openai';

import type { Probe, ScoreContext, } from './probes.ts';

//region Types

/** Chat completions message shape */
type ChatMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

/** Timing breakdown for a single API call */
type StreamTiming = {
  /** Milliseconds from request start to first chunk arriving */
  readonly timeToFirstChunkMs: number;
  /** Milliseconds between consecutive chunks (for diagnosing stalls) */
  readonly interChunkMs: readonly number[];
  /** Total wall-clock milliseconds for the full response */
  readonly totalMs: number;
  /** Number of chunks received */
  readonly chunkCount: number;
};

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
  /** Whether this run failed entirely (API error, timeout, etc.) */
  readonly failed: boolean;
  /** Error message if failed */
  readonly error?: string | undefined;
};

/**
 * OpenRouter verbosity levels controlling response detail via output_config.effort.
 * "max" is exclusive to Claude 4.6 Opus/Sonnet; falls back to "high" on other models.
 */
export type VerbosityLevel = 'low' | 'medium' | 'high' | 'max';

/** Configuration for the canary runner */
export type RunnerConfig = {
  /** Model ID (OpenRouter path like "anthropic/claude-sonnet-4.6") */
  readonly model: string;
  /** Number of times to run each probe for consistency checking */
  readonly consistencyRuns: number;
  /** Maximum tokens in the model's response */
  readonly maxTokens: number;
  /**
   * OpenRouter verbosity parameter -- controls output_config.effort on the provider side.
   * "max" available for Claude 4.6 Opus/Sonnet only; falls back to "high" elsewhere.
   */
  readonly verbosity: VerbosityLevel;
  /** Whether to enable adaptive thinking (reasoning) */
  readonly reasoning: boolean;
  /** Overall score below which degradation is flagged */
  readonly degradationThreshold: number;
  /** API key for Authorization header */
  readonly apiKey?: string | undefined;
  /** Base URL for the chat completions endpoint (e.g. "https://openrouter.ai/api/v1") */
  readonly baseURL?: string | undefined;
  /**
   * Set of "model:probeName" strings to skip execution for (e.g. "anthropic/claude-sonnet-4.6:csv-rfc4180").
   * Allows partial re-runs: only skips specific probes that were tested recently.
   */
  readonly skipProbes?: Set<string> | undefined;
};

//endregion Types

//region Defaults

/** Conservative defaults tuned for quick diagnostics */
export const defaultConfig: RunnerConfig = {
  model: 'anthropic/claude-sonnet-4.6',
  consistencyRuns: 2,
  // 16k is plenty for a single-file TypeScript CLI (~200 lines).
  maxTokens: 16_384,
  verbosity: 'low',
  reasoning: true,
  degradationThreshold: 0.4,
} as const;

//endregion Defaults

//region Streaming chat completions

/**
 * Logs a timing summary for a streamed response.
 * @param label - probe/call label for log prefix
 * @param timing - collected timing data
 */
function logTiming(label: string, timing: StreamTiming): void {
  const maxGap = timing.interChunkMs.length > 0
    ? Math.max(...timing.interChunkMs)
    : 0;
  console.log(
    `    [timing:${label}] ttfc=${String(timing.timeToFirstChunkMs)}ms`
    + ` chunks=${String(timing.chunkCount)}`
    + ` maxGap=${String(maxGap)}ms`
    + ` total=${String(timing.totalMs)}ms`,
  );
}

/**
 * Streams a chat completion and collects the full text + per-chunk timing.
 * Uses the OpenAI SDK's streaming interface against an OpenAI-compatible endpoint.
 * @param client - OpenAI SDK client
 * @param messages - conversation messages
 * @param config - runner configuration
 * @param label - label for timing logs
 * @returns collected text and timing breakdown
 */
async function streamCompletion(
  client: OpenAI,
  messages: readonly ChatMessage[],
  config: RunnerConfig,
  label: string,
): Promise<{ text: string; timing: StreamTiming }> {
  const startMs = Date.now();

  // Build extra body params for OpenRouter-specific features.
  // The OpenAI SDK passes unknown keys through via the body spread.
  const extraBody: Record<string, unknown> = {};
  if (config.reasoning) {
    extraBody['reasoning'] = { enabled: true, };
  }
  if (config.verbosity !== 'high') {
    extraBody['verbosity'] = config.verbosity;
  }

  const stream = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    messages: [...messages],
    stream: true,
    ...extraBody,
  });

  const chunks: string[] = [];
  const interChunkMs: number[] = [];
  let firstChunkMs = 0;
  // eslint-disable-next-line prefer-const -- mutated on first chunk arrival
  let lastChunkMs = startMs;
  let chunkCount = 0;

  for await (const chunk of stream) {
    const now = Date.now();
    chunkCount += 1;

    if (chunkCount === 1) {
      firstChunkMs = now - startMs;
    } else {
      interChunkMs.push(now - lastChunkMs);
    }
    lastChunkMs = now;

    const delta = chunk.choices[0]?.delta?.content;
    if (delta !== undefined && delta !== null) {
      chunks.push(delta);
    }
  }

  const totalMs = Date.now() - startMs;
  const timing: StreamTiming = {
    timeToFirstChunkMs: firstChunkMs,
    interChunkMs,
    totalMs,
    chunkCount,
  };

  logTiming(label, timing);

  return { text: chunks.join(''), timing, };
}

//endregion Streaming chat completions

//region Runner

/**
 * Creates a new OpenAI client configured for this runner.
 * Each client is local-scoped so it can be garbage collected quickly.
 * @param config - runner configuration
 * @returns configured OpenAI SDK client
 */
function createProbeClient(config: RunnerConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey ?? '',
    baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
  });
}

/**
 * Sends a single probe to the API and returns the raw text response.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @returns raw text response from the model
 */
async function executeProbe(
  probe: Probe,
  config: RunnerConfig,
): Promise<string> {
  const client = createProbeClient(config);
  const messages: ChatMessage[] = [
    { role: 'system', content: probe.system, },
    { role: 'user', content: probe.prompt, },
  ];
  const { text, } = await streamCompletion(client, messages, config, probe.name);
  return text;
}

/** 5 minutes per probe (all consistency runs + fix pass) -- slower inference is unusable */
const PROBE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Core probe logic: runs consistency checks + fix pass.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @returns scored result with consistency information
 */
async function runProbeCore(
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
    lastResponse = await executeProbe(probe, config);
    /** Context for artifact organization */
    const scoreContext = { modelId: config.model, pass: 'initial' as const, };
    // eslint-disable-next-line no-await-in-loop -- score may involve container execution
    scores.push(await probe.score(lastResponse, scoreContext));
    console.log(`  [${probe.name}] run ${String(runIndex + 1)}/${String(config.consistencyRuns)}: score=${String(scores[runIndex])}`);
  }

  const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const consistent = scores.every((score) => score === scores[0]);

  // Second pass: feed diagnostics back and see how many issues the model fixes
  const fixContext = { modelId: config.model, pass: 'fix' as const, };
  const pass2Result = await runSecondPass(probe, config, lastResponse, fixContext);
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
 * Runs a single probe with a 5-minute timeout covering all turns (consistency + fix).
 * If inference is too slow for one probe, there's no point continuing.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @returns scored result, or throws on timeout
 */
async function runProbe(
  probe: Probe,
  config: RunnerConfig,
): Promise<ProbeResult> {
  return Promise.race([
    runProbeCore(probe, config),
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`probe ${probe.name} timed out after 5 minutes`)),
        PROBE_TIMEOUT_MS,
      );
    }),
  ]);
}

/**
 * Runs the second pass: sends the model its code + diagnostics and scores the fix.
 * @param probe - probe that produced the first-pass response
 * @param config - runner configuration
 * @param firstResponse - raw model output from the first pass
 * @param context - score context for artifact organization
 * @returns second-pass score, or undefined if skipped
 */
async function runSecondPass(
  probe: Probe,
  config: RunnerConfig,
  firstResponse: string,
  context: ScoreContext,
): Promise<number | undefined> {
  if (probe.buildFixPrompt === undefined) return undefined;

  const fixPrompt = await probe.buildFixPrompt(firstResponse, context);
  if (fixPrompt === undefined) {
    console.log(`  [${probe.name}] pass2: skipped (no diagnostics to fix)`);
    return undefined;
  }

  console.log(`  [${probe.name}] pass2: sending fix prompt...`);

  try {
    const client = createProbeClient(config);
    // Multi-turn: system + original prompt + model's response + fix request
    const messages: ChatMessage[] = [
      { role: 'system', content: probe.system, },
      { role: 'user', content: probe.prompt, },
      { role: 'assistant', content: firstResponse, },
      { role: 'user', content: fixPrompt, },
    ];

    const { text, } = await streamCompletion(client, messages, config, `${probe.name}:fix`);
    return probe.score(text, context);
  } catch (error) {
    console.log(`  [${probe.name}] pass2: failed: ${String(error)}`);
    return undefined;
  }
}

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
  const timestamp = new Date().toISOString();

  // Filter out probes that were tested recently (have skip entry)
  const probesToRun = probes.filter((probe) => {
    const skipKey = `${mergedConfig.model}:${probe.name}`;
    return !mergedConfig.skipProbes?.has(skipKey);
  });

  if (probesToRun.length < probes.length) {
    const skipped = probes.length - probesToRun.length;
    console.log(`[${mergedConfig.model}] skipping ${String(skipped)} probe(s) with recent results`);
  }

  console.log(`[${mergedConfig.model}] testing with ${String(probesToRun.length)} probe(s)...`);

  try {
    // Fire all probes concurrently -- no retry on errors, they propagate up
    // Each probe creates and destroys its own client to minimize socket lifetime
    const results = await Promise.all(
      probesToRun.map(async (probe) => {
        const result = await runProbe(probe, mergedConfig);
        console.log(`  [${mergedConfig.model}:${probe.name}] => mean=${String(result.meanScore.toFixed(2))}`);
        return result;
      }),
    );

    const overallScore = results.reduce((sum, result) => sum + result.meanScore, 0) / results.length;
    const categoryScores = computeCategoryScores(results);
    const degradationLikely = overallScore < mergedConfig.degradationThreshold;

    return {
      model: mergedConfig.model,
      timestamp,
      results,
      overallScore,
      categoryScores,
      degradationLikely,
      failed: false,
    };
  } catch (error) {
    // No retry -- mark the entire model run as failed
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  [${mergedConfig.model}] FAILED: ${message}`);
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

//endregion Runner
