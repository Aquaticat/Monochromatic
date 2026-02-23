/**
 * Shared types for the canary history system.
 */

/**
 * ISO 8601 timestamp string, e.g. "2026-02-23T12:00:00.000Z".
 * Template literal narrows the type to strings starting with a year segment,
 * catching obvious non-timestamp values at compile time.
 */
export type ISOTimestamp = `${number}-${string}`;

/**
 * OpenRouter model ID in provider/name format, e.g. "anthropic/claude-sonnet-4.6".
 * Template literal enforces the slash separator, preventing bare model names.
 */
export type OpenRouterModelId = `${string}/${string}`;

/** A single historical run for one model */
export type HistoryEntry = {
  readonly timestamp: ISOTimestamp;
  readonly model: OpenRouterModelId;
  readonly overallScore: number;
  /** Per-probe scores for finer-grained analysis */
  readonly probeScores: Record<string, number>;
  /** Whether this run was a failure (API error, timeout, etc.) */
  readonly failed: boolean;
};

/** Parsed history: just an array of entries, one per JSONL line */
export type HistoryFile = {
  readonly entries: readonly HistoryEntry[];
};

/** Computed threshold for a model based on historical data */
export type ModelThreshold = {
  readonly model: OpenRouterModelId;
  readonly mean: number;
  readonly stddev: number;
  /** Threshold = mean - 2*stddev, floored at 0 */
  readonly threshold: number;
  /** Number of historical runs used */
  readonly sampleCount: number;
};
