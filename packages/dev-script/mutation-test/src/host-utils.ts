/**
 * Host-side utility helpers for mutation orchestration.
 *
 * @example
 * ```ts
 * reportNameForSource('src/a.ts');
 * ```
 */

import { access, } from 'node:fs/promises';
import {
  availableParallelism,
  totalmem,
} from 'node:os';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

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
const KIBIBYTE = 1024;

/**
 * Finds repository root by walking upward to `pnpm-workspace.yaml`.
 *
 * @param start - Starting directory.
 *
 * @returns Absolute repository root.
 *
 * @example
 * ```ts
 * await findRepoRoot(process.cwd());
 * ```
 */
export async function findRepoRoot(start: string,): Promise<string> {
  let current = resolve(start,);

  while (true) {
    try {
      await access(join(current, 'pnpm-workspace.yaml',),);
      return current;
    }
    catch {
      const parent = dirname(current,);

      if (parent === current)
        throw new Error(`Could not find pnpm-workspace.yaml from ${start}`,);

      current = parent;
    }
  }
}

/**
 * Parses memory strings used by Podman limits.
 *
 * @param memory - Memory string such as `4g` or `512m`.
 *
 * @returns Approximate byte count, or undefined when unit is unsupported.
 *
 * @example
 * ```ts
 * memoryBytes('1g');
 * // 1073741824
 * ```
 */
export function memoryBytes(memory: string,): number | undefined {
  const lower = memory.toLowerCase();
  const unit = lower.at(-1,);
  const numberPart = lower.slice(0, -1,);
  const value = Number(numberPart,);

  if (!Number.isFinite(value,) || value <= 0)
    return undefined;

  if (unit === 'g')
    return value * KIBIBYTE * KIBIBYTE * KIBIBYTE;

  if (unit === 'm')
    return value * KIBIBYTE * KIBIBYTE;

  return undefined;
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
  const cpuWorkers = Math.max(
    MIN_WORKERS,
    Math.min(availableParallelism() - 1, DEFAULT_WORKER_CEILING,),
  );
  const perFileBytes = memoryBytes(resources.memory,);

  if (perFileBytes === undefined)
    return cpuWorkers;

  const memoryWorkers = Math.max(
    MIN_WORKERS,
    Math.floor(totalmem() / perFileBytes,),
  );
  return Math.max(
    MIN_WORKERS,
    Math.min(cpuWorkers, memoryWorkers,),
  );
}

/**
 * Converts a source file path into a unique JSON report filename.
 *
 * @param sourceFile - Package-relative source file.
 *
 * @returns Report filename under the host reports directory.
 *
 * @example
 * ```ts
 * reportNameForSource('src/io/glob.ts');
 * // 'src__io__glob.ts.json'
 * ```
 */
export function reportNameForSource(sourceFile: string,): string {
  return `${sourceFile.split('/',).join('__',)}.json`;
}

/**
 * Resolves source files requested by CLI against dynamic package selection.
 *
 * @param options - All dynamically selected files and CLI filters.
 *
 * @returns Source files to mutate.
 *
 * @example
 * ```ts
 * resolveRequestedSources({ allSources: ['src/a.ts'], requested: [] });
 * ```
 */
export function resolveRequestedSources(options: {
  readonly allSources: readonly string[];
  readonly requested: readonly string[];
},): readonly string[] {
  if (options.requested.length === 0)
    return options.allSources;

  const allowed = new Set(options.allSources,);
  const missing = options.requested.filter(function notAllowed(source,): boolean {
    return !allowed.has(source,);
  },);

  if (missing.length > 0)
    throw new Error(`Requested mutation sources are not production sources: ${missing.join(', ',)}`,);

  return options.requested;
}

/**
 * Runs async work with bounded concurrency while preserving item order.
 *
 * @param options - Items, worker count, and worker function.
 *
 * @returns Results in input order.
 *
 * @example
 * ```ts
 * await runBounded({ items: [1], concurrency: 1, worker: async ({ item }) => item });
 * ```
 */
export async function runBounded<Item, Result>(options: {
  readonly items: readonly Item[];
  readonly concurrency: number;
  readonly worker: (options: { readonly item: Item; readonly index: number; }) => Promise<Result>;
},): Promise<readonly Result[]> {
  const results: (Result | undefined)[] = new Array(options.items.length,);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < options.items.length) {
      const index = cursor;
      cursor += 1;
      const item = options.items[index];

      if (item === undefined)
        throw new Error(`Missing work item at index ${String(index,)}`,);

      results[index] = await options.worker({ item, index, },);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(options.concurrency, options.items.length,), },
    async function startWorker(): Promise<void> {
      await runWorker();
    },
  ),);

  return results.map(function requireResult(result, index,): Result {
    if (result === undefined)
      throw new Error(`Missing result at index ${String(index,)}`,);

    return result;
  },);
}
