/**
 * Timing aggregation and statistics functions for the constrained benchmark runner.
 * Handles median computation, timing collection, and summary formatting.
 */

import type { CountersSnapshot, } from './container-counters.ts';
import type { ContainerBenchResult, } from './run-constrained-utils.ts';

/**
 * Numeric comparator for ascending sort order.
 *
 * @param a - First number
 *
 * @param b - Second number
 *
 * @returns Negative if a \< b, positive if a \> b, zero if equal
 */
function numericAsc(a: number, b: number,): number {
  return a - b;
}

/**
 * Computes the median of a non-empty numeric array.
 *
 * @param values - Array of numbers (must be non-empty)
 *
 * @returns Median value
 *
 * @throws When array is empty
 */
export function median(values: readonly number[],): number {
  if (values.length === 0)
    throw new Error('Cannot compute median of empty array',);
  const sorted = [...values,].toSorted(numericAsc,);
  const mid = Math.floor(sorted.length / 2,);
  // Indices guaranteed in-bounds: length > 0 ensures mid >= 0,
  // and mid < length by construction of Math.floor(length / 2).
  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1];
    const upper = sorted[mid];
    if (lower === undefined || upper === undefined)
      throw new Error('Unexpected undefined in sorted array',);
    return (lower + upper) / 2;
  }
  const midValue = sorted[mid];
  if (midValue === undefined)
    throw new Error('Unexpected undefined in sorted array',);
  return midValue;
}

/**
 * Checks whether a timing entry matches a label exactly or as a prefix.
 *
 * @param labelOrPrefix - Exact label or prefix to match against
 *
 * @param entry - Timing entry to check
 *
 * @returns Whether the entry's label matches
 */
function matchesLabel(labelOrPrefix: string,
  entry: { readonly label: string; },): boolean
{
  return entry.label === labelOrPrefix || entry.label.startsWith(`${labelOrPrefix}-`,);
}

/**
 * Extracts the ms value from a timing entry.
 *
 * @param entry - Timing entry containing ms value
 *
 * @returns Milliseconds value
 */
function extractMs(entry: { readonly ms: number; },): number {
  return entry.ms;
}

/**
 * Collects timing values from all containers for a label or label prefix.
 *
 * @param results - All container bench results
 *
 * @param labelOrPrefix - Exact label match, or prefix for labels like "warm-0", "warm-1", ...
 *
 * @returns Array of ms values across all containers
 */
export function collectTimings(
  results: readonly ContainerBenchResult[],
  labelOrPrefix: string,
): number[] {
  /**
   * Extracts matching ms values from a single container result.
   *
   * @param result - Container benchmark result
   *
   * @returns Array of ms values matching the label or prefix
   */
  function extractMatchingTimings(result: ContainerBenchResult,): number[] {
    return result
      .timings
      .filter(function checkLabel(entry,) {
        return matchesLabel(labelOrPrefix, entry,);
      },)
      .map(function getMs(entry,) {
        return extractMs(entry,);
      },);
  }

  return results.flatMap(function getTimings(result,) {
    return extractMatchingTimings(result,);
  },);
}

/**
 * Formats a summary line for one timing category.
 *
 * @param label - Category name (e.g. "cold", "warm")
 *
 * @param values - All ms values for this category
 *
 * @returns Formatted summary string
 */
export function formatTimingSummary(label: string, values: readonly number[],): string {
  const min = Math.min(...values,);
  const med = median(values,);
  const max = Math.max(...values,);
  /** Pad label to 16 chars for aligned output */
  const LABEL_PAD = 16;
  return `  ${label.padEnd(LABEL_PAD,)} min=${min.toFixed(1,)}ms  median=${
    med.toFixed(1,)
  }ms  max=${max.toFixed(1,)}ms  (n=${String(values.length,)})`;
}

/**
 * Collects counter snapshots from all containers for a label or label prefix,
 * dropping regions that ran without counters.
 *
 * @param results - All container bench results
 *
 * @param labelOrPrefix - Exact label match, or prefix for labels like "warm-0"
 *
 * @returns Counter snapshots across all containers for the category
 */
export function collectCounters(
  results: readonly ContainerBenchResult[],
  labelOrPrefix: string,
): CountersSnapshot[] {
  /**
   * Extracts present counter snapshots from a single container result.
   *
   * @param result - Container benchmark result
   *
   * @returns Non-null snapshots matching the label or prefix
   */
  function extractMatchingCounters(result: ContainerBenchResult,): CountersSnapshot[] {
    return result
      .timings
      .filter(function checkLabel(entry,) {
        return matchesLabel(labelOrPrefix, entry,);
      },)
      .map(function getCounters(entry,) {
        return entry.counters;
      },)
      .filter(function isPresent(snapshot,): snapshot is CountersSnapshot {
        return snapshot !== null;
      },);
  }

  return results.flatMap(function getCountersForResult(result,) {
    return extractMatchingCounters(result,);
  },);
}

/**
 * Formats a counters summary line for one timing category, reporting the median
 * across containers. Indented to sit under its timing summary line.
 *
 * @param snapshots - All counter snapshots for this category
 *
 * @returns Formatted summary string
 */
export function formatCountersSummary(snapshots: readonly CountersSnapshot[],): string {
  /** Median retired instructions across containers for this category. */
  const instructions = median(snapshots.map(function getInstructions(snapshot,) {
    return snapshot.instructions;
  },),);
  /** Median CPU cycles across containers for this category. */
  const cycles = median(snapshots.map(function getCycles(snapshot,) {
    return snapshot.cycles;
  },),);
  /** Median instructions-per-cycle across containers for this category. */
  const ipc = median(snapshots.map(function getIpc(snapshot,) {
    return snapshot.ipc;
  },),);
  /** Indent aligning the counters line under formatTimingSummary's values. */
  const INDENT = 18;
  return `  ${' '.repeat(INDENT,)}instr=${instructions.toLocaleString('en-US',)}  cycles=${
    cycles.toLocaleString('en-US',)
  }  ipc=${ipc.toFixed(2,)}  (n=${String(snapshots.length,)})`;
}
