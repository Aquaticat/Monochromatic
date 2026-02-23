/**
 * Runner configuration types and defaults.
 */

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
   * Set of "model:probeName" strings to skip execution for.
   * Allows partial re-runs: only skips specific probes tested recently.
   */
  readonly skipProbes?: Set<string> | undefined;
};

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
