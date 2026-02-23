/**
 * Shared types for the canary history system.
 */

/** A single historical run for one model */
export type HistoryEntry = {
  readonly timestamp: string;
  readonly model: string;
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
  readonly model: string;
  readonly mean: number;
  readonly stddev: number;
  /** Threshold = mean - 2*stddev, floored at 0 */
  readonly threshold: number;
  /** Number of historical runs used */
  readonly sampleCount: number;
};
