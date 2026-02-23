/**
 * Core probe type definitions shared between simple and code-gen probes.
 */

/**
 * Context passed to score and buildFixPrompt so generated artifacts
 * can be organized by model and pass (initial vs fix).
 */
export type ScoreContext = {
  /** Full OpenRouter model ID (e.g. "anthropic/claude-sonnet-4.6") */
  readonly modelId: string;
  /** Which pass produced this response */
  readonly pass: 'initial' | 'fix';
};

/** Single canary probe with prompt, expected behavior, and scoring function */
export type Probe = {
  /** Human-readable label for reporting */
  readonly name: string;
  /** Which degradation axis this probe targets */
  readonly category: 'simple' | 'code-gen';
  /** System prompt sent alongside the user message */
  readonly system: string;
  /** User message that forms the probe */
  readonly prompt: string;
  /**
   * Scores the model response on a 0-1 scale.
   * Async to support container execution for code-gen probes.
   * @param response - raw model output text
   * @param context - model identity and pass info for artifact organization
   * @returns score between 0 (complete failure) and 1 (perfect)
   */
  readonly score: (response: string, context: ScoreContext) => number | Promise<number>;
  /**
   * Generates a follow-up prompt for a second pass where the model gets its
   * code back with linter/type-checker output and tries to fix issues.
   * Returns undefined to skip the second pass (e.g. when there's nothing to fix).
   * @param response - raw model output from the first pass
   * @param context - model identity and pass info for artifact organization
   * @returns follow-up user message, or undefined to skip
   */
  readonly buildFixPrompt?: (response: string, context: ScoreContext) => string | undefined | Promise<string | undefined>;
  /**
   * Whether this probe involves long-running execution (e.g. real async delays).
   * Slow probes are excluded by default; pass --slow to include them.
   */
  readonly slow?: boolean;
};
