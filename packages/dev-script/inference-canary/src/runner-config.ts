/**
 * Runner configuration types and defaults.
 */
import type { OpenRouterModelId, } from './runner-types.ts';

/**
 * OpenRouter verbosity levels controlling response detail via output_config.effort.
 * "max" is exclusive to Claude 4.6 Opus/Sonnet; falls back to "high" on other models.
 */
export type VerbosityLevel = 'low' | 'medium' | 'high' | 'max';

/** Configuration for the canary runner */
export type RunnerConfig = {
  /** OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6") */
  readonly model: OpenRouterModelId;
  /**
   * Human-readable model label used for dedup, artifact directories, and log prefixes.
   * Must be unique across all model configs tested in a single run.
   */
  readonly label: string;
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
  /** API key for Authorization header */
  readonly apiKey?: string | undefined;
  /** Base URL for the chat completions endpoint (e.g. "https://openrouter.ai/api/v1") */
  readonly baseURL?: string | undefined;
  /**
   * Map from model label to the set of probe names to skip for that model.
   * Allows partial re-runs: only probes tested within the last 24 hours are skipped.
   */
  readonly skipProbes?: ReadonlyMap<string, ReadonlySet<string>> | undefined;
};

/** Conservative defaults tuned for quick diagnostics */
export const defaultConfig: RunnerConfig = {
  model: 'anthropic/claude-sonnet-4.6',
  label: 'Sonnet 4.6',
  consistencyRuns: 2,
  // 128k allows verbose solutions (e.g. character-by-character parsers without regex).
  maxTokens: 128_000,
  verbosity: 'low',
  reasoning: true,
} as const;
