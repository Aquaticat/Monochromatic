/**
 * Utility functions for the constrained benchmark runner.
 * Handles process spawning, JSON parsing, and type definitions.
 */

import nanoSpawn from 'nano-spawn';

import type { CountersSnapshot, } from './container-counters.ts';

/** Result shape from bench-in-container.ts */
export type ContainerBenchResult = {
  readonly limits: {
    readonly cpuAffinity: string;
    readonly memoryMax: string;
    readonly cpuAffinityValid: boolean;
    readonly memoryValid: boolean;
  };
  readonly sysbench: { readonly eventsPerSec: number; };
  readonly timings: readonly {
    readonly label: string;
    readonly ms: number;
    readonly counters: CountersSnapshot | null;
  }[];
};

/** Shape of host baseline benchmark results parsed from JSON */
export type HostBenchResult = {
  readonly sysbench: { readonly eventsPerSec: number; };
  readonly serial: { readonly ms: number; };
  readonly parallel: { readonly ms: number; };
  readonly io: { readonly ms: number; readonly filesPerSec: number; };
};

/**
 * Spawns a process, captures stdout. Stderr is captured and only
 * displayed on failure to avoid interleaved output from parallel containers.
 *
 * @param cmd - Command and arguments
 *
 * @param label - Label for error messages and logging
 *
 * @returns Stdout content
 *
 * @throws When the process exits with a non-zero code
 */
export async function runCapture(cmd: readonly string[],
  label: string,): Promise<string>
{
  console.log(`[constrained] ${label}...`,);
  const [command, ...args] = cmd;
  if (command === undefined)
    throw new Error(`Empty command array for ${label}`,);
  const { stdout, } = await nanoSpawn(command, [...args,],);
  return stdout;
}

/**
 * Checks whether a line is non-empty after trimming whitespace.
 *
 * @param line - Line to check
 *
 * @returns Whether the line has non-whitespace content
 */
function isNonEmptyLine(line: string,): boolean {
  return line.trim().length > 0;
}

/** Maximum characters of output to include in error messages */
const ERROR_OUTPUT_PREVIEW_LENGTH = 500;

/**
 * Parses JSON from the last non-empty line of a string.
 * Library console.log calls may precede the structured JSON on stdout.
 *
 * @param output - Full stdout content potentially containing non-JSON prefix lines
 *
 * @returns Parsed JSON value
 *
 * @throws When no valid JSON line is found
 */
export function parseLastJsonLine(output: string,): unknown {
  const lines = output.trim().split('\n',).filter(function checkNonEmpty(line,) {
    return isNonEmptyLine(line,);
  },);
  // Walk backwards to find the JSON line; it starts with '{'
  // let needed: iterating from the end until valid JSON found
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex--) {
    const line = lines[lineIndex];
    if (line !== undefined && line.trim().startsWith('{',))
      return JSON.parse(line,);
  }
  throw new Error(
    `No JSON object found in output:\n${output.slice(0, ERROR_OUTPUT_PREVIEW_LENGTH,)}`,
  );
}

/**
 * Spawns a process with inherited stdout and stderr.
 *
 * @param cmd - Command and arguments
 *
 * @param label - Label for error messages
 *
 * @throws When the process exits with a non-zero code
 */
export async function runInherit(cmd: readonly string[], label: string,): Promise<void> {
  console.log(`[constrained] ${label}...`,);
  const [command, ...args] = cmd;
  if (command === undefined)
    throw new Error(`Empty command array for ${label}`,);
  await nanoSpawn(command, [...args,], {
    stdout: 'inherit',
    stderr: 'inherit',
  },);
}

/**
 * Extracts the sysbench events per second from a container result.
 *
 * @param result - Container benchmark result
 *
 * @returns Events per second value
 */
export function extractSysbenchScore(result: ContainerBenchResult,): number {
  return result.sysbench.eventsPerSec;
}
