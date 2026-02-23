/**
 * Result types for the canary runner.
 *
 * Configuration types and defaults live in runner-config.ts.
 */
import type { Probe, } from './probes.ts';

export type { RunnerConfig, VerbosityLevel, } from './runner-config.ts';
export { defaultConfig, } from './runner-config.ts';

//region Message and timing types

/** Chat completions message shape */
export type ChatMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

/** Timing breakdown for a single API call */
export type StreamTiming = {
  /** Milliseconds from request start to first chunk arriving */
  readonly timeToFirstChunkMs: number;
  /** Milliseconds between consecutive chunks (for diagnosing stalls) */
  readonly interChunkMs: readonly number[];
  /** Total wall-clock milliseconds for the full response */
  readonly totalMs: number;
  /** Number of chunks received */
  readonly chunkCount: number;
};

//endregion Message and timing types

//region Probe and report result types

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
   * Score after a second pass where the model gets its code + diagnostics and fixes them.
   * Undefined if the probe doesn't support it or the first pass had no diagnostics.
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

//endregion Probe and report result types
