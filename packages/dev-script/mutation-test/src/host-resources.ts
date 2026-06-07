/**
 * Host resource-budget helpers for mutation orchestration.
 *
 * @example
 * ```ts
 * defaultWorkerCount({ memory: '4g', cpus: '2', pidsLimit: 512, sessionTimeoutSeconds: 3600, workTmpfsSize: '6g' });
 * ```
 */

import {
  availableParallelism,
  totalmem,
} from 'node:os';

import type { ContainerResources, } from './types.ts';

/**
 * Minimum worker count for mutation runs.
 */
const MIN_WORKERS = 1;

/**
 * Conservative upper bound for default parallel containers before explicit tuning.
 */
const DEFAULT_WORKER_CEILING = 2;

/**
 * Bytes in one kibibyte.
 */
const KIBIBYTE = 1_024;

/**
 * Sentinel byte count for unsupported memory strings.
 */
const UNSUPPORTED_MEMORY_BYTES = 0;

/**
 * Parses memory strings used by Podman limits.
 *
 * @param memory - Memory string such as `4g` or `512m`.
 *
 * @returns Approximate byte count, or zero when unit is unsupported.
 *
 * @example
 * ```ts
 * memoryBytes('1g');
 * // 1073741824
 * ```
 */
export function memoryBytes(memory: string,): number {
  /**
   * Lowercase memory string for unit parsing.
   */
  const lower = memory.toLowerCase();
  /**
   * Last-character unit suffix.
   */
  const unit = lower.at(-1,);
  /**
   * Numeric portion before unit suffix.
   */
  const numberPart = lower.slice(
    0,
    -1,
  );
  /**
   * Parsed numeric memory value.
   */
  const value = Number(numberPart,);

  if ((!Number.isFinite(value,)) || (value <= 0))
    return UNSUPPORTED_MEMORY_BYTES;

  if (unit === 'g')
    return value * KIBIBYTE
      * KIBIBYTE
      * KIBIBYTE;

  if (unit === 'm')
    return value * KIBIBYTE
      * KIBIBYTE;

  return UNSUPPORTED_MEMORY_BYTES;
}

/**
 * Chooses default outer container concurrency from CPU and memory budgets.
 *
 * @param resources - Per-container resource limits.
 *
 * @returns Worker count.
 *
 * @example
 * ```ts
 * defaultWorkerCount({ memory: '4g', cpus: '2', pidsLimit: 512, sessionTimeoutSeconds: 3600, workTmpfsSize: '6g' });
 * ```
 */
export function defaultWorkerCount(resources: ContainerResources,): number {
  /**
   * CPU-derived worker count capped conservatively by default.
   */
  const cpuWorkers = Math.max(
    MIN_WORKERS,
    Math.min(
      availableParallelism() - 1,
      DEFAULT_WORKER_CEILING,
    ),
  );
  /**
   * Approximate bytes allowed per mutation container.
   */
  const perFileBytes = memoryBytes(resources.memory,);

  if (perFileBytes === UNSUPPORTED_MEMORY_BYTES)
    return cpuWorkers;

  /**
   * Memory-derived worker count.
   */
  const memoryWorkers = Math.max(
    MIN_WORKERS,
    Math.floor(totalmem() / perFileBytes,),
  );
  return Math.max(
    MIN_WORKERS,
    Math.min(
      cpuWorkers,
      memoryWorkers,
    ),
  );
}
