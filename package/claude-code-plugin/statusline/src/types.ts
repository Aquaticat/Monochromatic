/**
 * Claude statusline input types.
 *
 * @module
 */

/**
 * Shape of the JSON payload Claude Code dispatches to the statusline command on stdin.
 */
type StatuslineInput = {
  /**
   * Session transcript JSONL path.
   */
  readonly transcript_path?: string;
  /**
   * Model metadata supplied by Claude Code.
   */
  readonly model?: {
    /**
     * Model identifier.
     */
    readonly id?: string;
    /**
     * Human-readable model display name.
     */
    readonly display_name?: string;
  };
  /**
   * Context-window usage payload supplied by Claude Code.
   */
  readonly context_window?: {
    /**
     * Total context-window size in tokens.
     */
    readonly context_window_size?: number;
    /**
     * Current token usage split by token source.
     */
    readonly current_usage?: {
      /**
       * Input tokens.
       */
      readonly input_tokens?: number;
      /**
       * Output tokens.
       */
      readonly output_tokens?: number;
      /**
       * Cache creation input tokens.
       */
      readonly cache_creation_input_tokens?: number;
      /**
       * Cache read input tokens.
       */
      readonly cache_read_input_tokens?: number;
    };
  };
  /**
   * Claude subscription rate-limit tiers.
   */
  readonly rate_limits?: {
    /**
     * Five-hour rolling session tier.
     */
    readonly five_hour?: RateLimitTier;
    /**
     * Seven-day subscription tier.
     */
    readonly seven_day?: RateLimitTier;
  };
};

/**
 * One rate-limit window as reported in {@link StatuslineInput}.
 */
type RateLimitTier = {
  /**
   * Used capacity percentage.
   */
  readonly used_percentage?: number;
  /**
   * Reset timestamp in epoch seconds.
   */
  readonly resets_at?: number;
};

export type {
  RateLimitTier,
  StatuslineInput,
};
