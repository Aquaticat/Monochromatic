/**
 * Runner configuration types and defaults.
 */
import type { OpenRouterModelId, } from './runner-types.ts';

/**
 * OpenRouter verbosity levels controlling response detail via output_config.effort.
 * "max" is exclusive to Claude 4.6 Opus/Sonnet; falls back to "high" on other models.
 */
export type VerbosityLevel = 'low' | 'medium' | 'high' | 'max';

/**
 * Configuration for the canary runner
 */
export type RunnerConfig = {
  /**
   * OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6")
   */
  readonly model: OpenRouterModelId;
  /**
   * Human-readable model label used for dedup, artifact directories, and log prefixes.
   * Must be unique across all model configs tested in a single run.
   */
  readonly label: string;
  /**
   * Number of times to run each probe for consistency checking
   */
  readonly consistencyRuns: number;
  /**
   * Maximum tokens in the model's response
   */
  readonly maxTokens: number;
  /**
   * OpenRouter verbosity parameter; controls output_config.effort on the provider side.
   * "max" available for Claude 4.6 Opus/Sonnet only; falls back to "high" elsewhere.
   */
  readonly verbosity: VerbosityLevel;
  /**
   * Whether to enable adaptive thinking (reasoning)
   */
  readonly reasoning: boolean;
  /**
   * API key for Authorization header
   */
  readonly apiKey?: string;
  /**
   * Base URL for the chat completions endpoint (e.g. "https://openrouter.ai/api/v1")
   */
  readonly baseURL?: string;
  /**
   * Map from model label to the set of probe names to skip for that model.
   * Allows partial re-runs: only probes tested within the last 24 hours are skipped.
   */
  readonly skipProbes?: ReadonlyMap<string, ReadonlySet<string>>;
};

/**
 * Per-field overrides merged onto {@link defaultConfig} by {@link runCanary}.
 *
 * Every field is explicitly optional because a caller may override any subset and
 * let the rest fall back to defaults. Spelled out field-by-field rather than via
 * `Partial<RunnerConfig>`: under `exactOptionalPropertyTypes`, `Partial` reopens
 * the holes the strict-optional config closes, and the no-optional-escape rule
 * bans it. The genuinely-optional-everywhere shape of an override patch is the one
 * case where every property legitimately carries `?:`.
 */
export type RunnerConfigOverrides = {
  /**
   * OpenRouter model ID override; defaults to {@link defaultConfig}'s model when absent.
   */
  readonly model?: OpenRouterModelId;
  /**
   * Model label override used for dedup, artifact directories, and log prefixes.
   */
  readonly label?: string;
  /**
   * Consistency-run count override; controls how many times each probe repeats.
   */
  readonly consistencyRuns?: number;
  /**
   * Response token ceiling override.
   */
  readonly maxTokens?: number;
  /**
   * Verbosity override forwarded to `output_config.effort`.
   */
  readonly verbosity?: VerbosityLevel;
  /**
   * Adaptive-thinking toggle override.
   */
  readonly reasoning?: boolean;
  /**
   * API key override for the Authorization header.
   */
  readonly apiKey?: string;
  /**
   * Chat-completions endpoint base URL override.
   */
  readonly baseURL?: string;
  /**
   * Per-model skip list override, enabling partial re-runs that reuse recent artifacts.
   */
  readonly skipProbes?: ReadonlyMap<string, ReadonlySet<string>>;
};

/**
 * Conservative defaults tuned for quick diagnostics
 */
export const defaultConfig: RunnerConfig = {
  model: 'anthropic/claude-sonnet-4.6',
  label: 'Sonnet 4.6',
  consistencyRuns: 2,
  // 128k allows verbose solutions (e.g. character-by-character parsers without regex).
  maxTokens: 128_000,
  verbosity: 'low',
  reasoning: true,
} as const;
