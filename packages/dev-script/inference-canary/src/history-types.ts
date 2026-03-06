/**
 * Shared types for the canary history system.
 */
import type { ConfigSnapshot, StreamTiming, StreamUsage, } from './runner-types.ts';

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
  /** Per-probe pass-1 scores for finer-grained analysis */
  readonly probeScores: Record<string, number>;
  /** Per-probe pass-2 (fix) scores, keyed by probe name. Absent for probes without a fix pass. */
  readonly pass2Scores?: Record<string, number> | undefined;
  /** Whether this run was a failure (API error, timeout, etc.) */
  readonly failed: boolean;
  /** Per-probe individual consistency-run scores (not just the mean) */
  readonly scores?: Record<string, readonly number[]> | undefined;
  /** Per-probe streaming timing from the last consistency run */
  readonly timing?: Record<string, StreamTiming> | undefined;
  /** Per-probe token usage from the last consistency run */
  readonly usage?: Record<string, StreamUsage> | undefined;
  /** Runner configuration snapshot for this run */
  readonly config?: ConfigSnapshot | undefined;
  /** Error message when the run failed */
  readonly error?: string | undefined;
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
  /** Threshold = mean - 2*stddev, floored at 0.3 */
  readonly threshold: number;
  /** Number of historical runs used */
  readonly sampleCount: number;
};
