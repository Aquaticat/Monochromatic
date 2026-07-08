/**
 * Usage projection shared types.
 *
 * @module
 */

//region Types

/**
 * Parsed provider usage window sampled from one host data source.
 */
type RateLimitSnapshot = {
  /**
   * Stable key for this sampled window.
   */
  readonly key: string;
  /**
   * Short statusline label shown before rate-limit text.
   *
   * Empty string means the host wants an unlabeled segment.
   */
  readonly label: string;
  /**
   * Reset timestamp in Unix epoch milliseconds.
   */
  readonly resetAtMs: number;
  /**
   * Fixed limiter window duration in seconds.
   */
  readonly windowSeconds: number;
  /**
   * Elapsed-pace multiplier for providers whose quota window regenerates fractionally.
   */
  readonly paceScale: number;
  /**
   * Wall-clock sample time in Unix epoch milliseconds.
   */
  readonly sampledAtMs: number;
  /**
   * Used capacity as a percentage of capacity.
   */
  readonly usedPercent: number;
};

/**
 * Severity names selected by shared rate-limit policy.
 */
type RateLimitSeverity = 'green' | 'yellow' | 'red';

/**
 * Theme hooks used to color rate-limit warning segments.
 */
type RateLimitStyle = {
  /**
   * Style for comfortable remaining-capacity warnings.
   */
  readonly green: (text: string,) => string;
  /**
   * Style for caution remaining-capacity warnings.
   */
  readonly yellow: (text: string,) => string;
  /**
   * Style for critical remaining-capacity or projected-overrun warnings.
   */
  readonly red: (text: string,) => string;
};

/**
 * Formatting result returned after inspecting rate-limit snapshots.
 */
type RateLimitStatus = {
  /**
   * Status text. Empty string means the host should clear this status segment.
   */
  readonly statusText: string;
};

//endregion Types

export type {
  RateLimitSeverity,
  RateLimitSnapshot,
  RateLimitStatus,
  RateLimitStyle,
};
