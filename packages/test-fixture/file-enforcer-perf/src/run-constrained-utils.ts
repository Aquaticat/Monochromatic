/**
 * Utility functions for the constrained benchmark runner.
 * Handles process spawning, JSON parsing, and timing aggregation.
 */

import nanoSpawn from 'nano-spawn';

/** Result shape from bench-in-container.ts */
export type ContainerBenchResult = {
  readonly limits: {
    readonly cpuAffinity: string;
    readonly memoryMax: string;
    readonly cpuAffinityValid: boolean;
    readonly memoryValid: boolean;
  };
  readonly sysbench: { readonly eventsPerSec: number };
  readonly timings: readonly { readonly label: string; readonly ms: number }[];
};

/**
 * Spawns a process, captures stdout. Stderr is captured and only
 * displayed on failure to avoid interleaved output from parallel containers.
 * @param cmd - Command and arguments
 * @param label - Label for error messages and logging
 * @returns Stdout content
 * @throws When the process exits with a non-zero code
 */
export async function runCapture(cmd: readonly string[], label: string): Promise<string> {
  console.log(`[constrained] ${label}...`);
  const [command, ...args] = cmd;
  const { stdout } = await nanoSpawn(command!, [...args]);
  return stdout;
}

/**
 * Parses JSON from the last non-empty line of a string.
 * Library console.log calls may precede the structured JSON on stdout.
 * @param output - Full stdout content potentially containing non-JSON prefix lines
 * @returns Parsed JSON value
 * @throws When no valid JSON line is found
 */
export function parseLastJsonLine(output: string): unknown {
  const lines = output.trim().split('\n').filter((line) => line.trim().length > 0);
  // Walk backwards to find the JSON line -- it starts with '{'
  // let needed: iterating from the end until valid JSON found
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex] as string;
    if (line.trim().startsWith('{')) {
      return JSON.parse(line);
    }
  }
  throw new Error(`No JSON object found in output:\n${output.slice(0, 500)}`);
}

/**
 * Spawns a process with inherited stdout and stderr.
 * @param cmd - Command and arguments
 * @param label - Label for error messages
 * @throws When the process exits with a non-zero code
 */
export async function runInherit(cmd: readonly string[], label: string): Promise<void> {
  console.log(`[constrained] ${label}...`);
  const [command, ...args] = cmd;
  await nanoSpawn(command!, [...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
}

/**
 * Computes the median of a non-empty numeric array.
 * @param values - Array of numbers (must be non-empty)
 * @returns Median value
 * @throws When array is empty
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute median of empty array');
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Indices guaranteed in-bounds: length > 0 ensures mid >= 0,
  // and mid < length by construction of Math.floor(length / 2).
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

/**
 * Collects timing values from all containers for a label or label prefix.
 * @param results - All container bench results
 * @param labelOrPrefix - Exact label match, or prefix for labels like "warm-0", "warm-1", ...
 * @returns Array of ms values across all containers
 */
export function collectTimings(
  results: readonly ContainerBenchResult[],
  labelOrPrefix: string,
): number[] {
  return results.flatMap((result) =>
    result.timings
      .filter((entry) => entry.label === labelOrPrefix || entry.label.startsWith(`${labelOrPrefix}-`))
      .map((entry) => entry.ms),
  );
}

/**
 * Formats a summary line for one timing category.
 * @param label - Category name (e.g. "cold", "warm")
 * @param values - All ms values for this category
 * @returns Formatted summary string
 */
export function formatTimingSummary(label: string, values: readonly number[]): string {
  const min = Math.min(...values);
  const med = median(values);
  const max = Math.max(...values);
  /** Pad label to 16 chars for aligned output */
  const LABEL_PAD = 16;
  return `  ${label.padEnd(LABEL_PAD)} min=${min.toFixed(1)}ms  median=${med.toFixed(1)}ms  max=${max.toFixed(1)}ms  (n=${String(values.length)})`;
}
