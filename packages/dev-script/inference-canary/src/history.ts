/**
 * Historical result storage and statistical threshold computation.
 *
 * Stores per-model canary results as a JSONL file (one JSON object per line).
 * JSONL is ideal for append-only history: appending is a single write, no
 * read-parse-rewrite cycle, and a crash mid-write only loses one line.
 * Uses the history to compute degradation thresholds via mean - 2*stddev,
 * so a model's "normal" variance is accounted for rather than a fixed cutoff.
 */
import { appendFile, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

//region Types

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
type HistoryFile = {
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

//endregion Types

//region File paths

const PACKAGE_DIR = new URL('..', import.meta.url).pathname;
const HISTORY_PATH = join(PACKAGE_DIR, 'canary-history.jsonl');

//endregion File paths

//region Read/write

/**
 * Reads the JSONL history file from disk, parsing each line as a HistoryEntry.
 * Returns an empty history if the file doesn't exist yet.
 * Silently skips malformed lines.
 * @returns parsed history
 */
export async function readHistory(): Promise<HistoryFile> {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf8');
    const entries = raw.split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as HistoryEntry;
        } catch {
          console.log(`[history] skipping malformed line: ${line.slice(0, 80)}`);
          return undefined;
        }
      })
      .filter((entry): entry is HistoryEntry => entry !== undefined);
    return { entries, };
  } catch {
    return { entries: [], };
  }
}

/**
 * Appends new entries to the JSONL history file (one line per entry).
 * @param entries - new entries to add
 */
export async function appendHistory(entries: readonly HistoryEntry[]): Promise<void> {
  const lines = entries.map((entry) => JSON.stringify(entry)).join('\n');
  await appendFile(HISTORY_PATH, `${lines}\n`, 'utf8');
  const existing = await readHistory();
  console.log(`[history] saved ${String(entries.length)} entries (total: ${String(existing.entries.length)})`);
}

//endregion Read/write

//region Threshold computation

/** Minimum samples needed before statistical thresholds are meaningful */
const MIN_SAMPLES = 3;

/** Fallback threshold when insufficient history exists */
const DEFAULT_THRESHOLD = 0.4;

/**
 * Computes a per-model degradation threshold from historical data.
 * Uses mean - 2*stddev for ~95% confidence that a drop below is real.
 * Only considers successful (non-failed) runs.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns computed threshold, or default if insufficient data
 */
export function computeThreshold(model: string, history: HistoryFile): ModelThreshold {
  const modelEntries = history.entries.filter(
    (entry) => entry.model === model && !entry.failed,
  );
  const scores = modelEntries.map((entry) => entry.overallScore);

  if (scores.length < MIN_SAMPLES) {
    return {
      model,
      mean: 0,
      stddev: 0,
      threshold: DEFAULT_THRESHOLD,
      sampleCount: scores.length,
    };
  }

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const threshold = Math.max(0, mean - 2 * stddev);

  return { model, mean, stddev, threshold, sampleCount: scores.length, };
}

/**
 * Finds the most recent successful entry for a model.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns most recent entry timestamp, or undefined if none
 */
export function lastRunTimestamp(model: string, history: HistoryFile): string | undefined {
  const modelEntries = history.entries.filter((entry) => entry.model === model);
  if (modelEntries.length === 0) return undefined;
  return modelEntries[modelEntries.length - 1]?.timestamp;
}

/** 24 hours in milliseconds */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Checks whether a model has been tested within the last 24 hours.
 * @param model - OpenRouter model ID
 * @param history - full history
 * @returns true if recent results exist
 */
export function hasRecentResults(model: string, history: HistoryFile): boolean {
  const lastTs = lastRunTimestamp(model, history);
  if (lastTs === undefined) return false;
  const elapsed = Date.now() - new Date(lastTs).getTime();
  return elapsed < TWENTY_FOUR_HOURS_MS;
}

/**
 * Returns a set of "model:probeName" pairs that were tested within the last 24 hours.
 * Used to skip only specific probes for a model, allowing partial re-runs.
 * @param history - full history
 * @returns set of recent model-probe pairs (e.g. "anthropic/claude-sonnet-4.6:csv-rfc4180")
 */
export function getRecentModelProbePairs(history: HistoryFile): Set<string> {
  const recent = new Set<string>();
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  for (const entry of history.entries) {
    if (entry.failed) continue;
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime < cutoff) continue;

    // Add all probe names from this recent entry
    for (const probeName of Object.keys(entry.probeScores)) {
      recent.add(`${entry.model}:${probeName}`);
    }
  }

  return recent;
}

//endregion Threshold computation
