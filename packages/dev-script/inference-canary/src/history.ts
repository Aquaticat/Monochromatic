/**
 * Canary history types and statistics.
 *
 * Re-exports types and statistical functions used by the inference-canary-viewer.
 * The runner no longer reads or writes a history file -- artifacts are the source of truth.
 */
export type { HistoryEntry, HistoryFile, ModelThreshold, } from './history-types.ts';
export { computeThreshold, lastRunTimestamp, hasRecentResults, getRecentModelProbePairs, } from './history-stats.ts';
