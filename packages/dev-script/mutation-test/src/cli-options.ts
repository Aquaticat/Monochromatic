/**
 * Host CLI parsing for mutation-test orchestration.
 *
 * @example
 * ```ts
 * parseCliOptions(['--package', 'packages/dev-script/file-enforcer']);
 * ```
 */

import type { CliOptions, } from './types.ts';

/**
 * Default per-container memory limit.
 */
const DEFAULT_MEMORY = '4g';

/**
 * Default per-container CPU share.
 */
const DEFAULT_CPUS = '2';

/**
 * Default per-container process limit.
 */
const DEFAULT_PIDS_LIMIT = 512;

/**
 * Default whole-session safety timeout for one container.
 */
const DEFAULT_SESSION_TIMEOUT_SECONDS = 3600;

/**
 * Default writable work-tree tmpfs size.
 */
const DEFAULT_WORK_TMPFS_SIZE = '6g';

/**
 * Default Stryker per-mutant timeout.
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Converts a string to positive integer.
 *
 * @param options - Raw value and option name.
 *
 * @returns Positive integer.
 *
 * @example
 * ```ts
 * positiveInteger({ value: '2', name: '--workers' });
 * // 2
 * ```
 */
function positiveInteger(options: {
  readonly value: string;
  readonly name: string;
},): number {
  const parsed = Number(options.value,);

  if (!Number.isInteger(parsed,) || parsed <= 0)
    throw new Error(`${options.name} must be a positive integer, received ${options.value}`,);

  return parsed;
}

/**
 * Pops next argument value or throws.
 *
 * @param options - Args, cursor, and option name.
 *
 * @returns Option value.
 *
 * @example
 * ```ts
 * optionValue({ argv: ['--x', 'y'], cursor: 0, name: '--x' });
 * // 'y'
 * ```
 */
function optionValue(options: {
  readonly argv: readonly string[];
  readonly cursor: number;
  readonly name: string;
},): string {
  const value = options.argv[options.cursor + 1];

  if (value === undefined)
    throw new Error(`Missing value for ${options.name}`,);

  return value;
}

/**
 * Parses host CLI options.
 *
 * @param argv - Arguments after executable and script path.
 *
 * @returns Parsed CLI options.
 *
 * @example
 * ```ts
 * parseCliOptions(['--package', 'packages/dev-script/file-enforcer', '--full-suite']);
 * ```
 */
export function parseCliOptions(argv: readonly string[],): CliOptions {
  const sourceFiles: string[] = [];
  let packagePath: string | undefined;
  let fullSuite = false;
  let dryRunOnly = false;
  let workers: number | undefined;
  let memory = DEFAULT_MEMORY;
  let cpus = DEFAULT_CPUS;
  let pidsLimit = DEFAULT_PIDS_LIMIT;
  let sessionTimeoutSeconds = DEFAULT_SESSION_TIMEOUT_SECONDS;
  let workTmpfsSize = DEFAULT_WORK_TMPFS_SIZE;
  let selinuxRelabel = false;
  let skipImageBuild = false;
  let timeoutMS = DEFAULT_TIMEOUT_MS;
  let prioritizePerformanceOverAccuracy = false;
  let cursor = 0;

  while (cursor < argv.length) {
    const arg = argv[cursor];

    if (arg === undefined)
      break;

    if (arg === '--package') {
      packagePath = optionValue({ argv, cursor, name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--full-suite') {
      fullSuite = true;
      cursor += 1;
      continue;
    }

    if (arg === '--dry-run-only') {
      dryRunOnly = true;
      cursor += 1;
      continue;
    }

    if (arg === '--selinux-relabel') {
      selinuxRelabel = true;
      cursor += 1;
      continue;
    }

    if (arg === '--skip-image-build') {
      skipImageBuild = true;
      cursor += 1;
      continue;
    }

    if (arg === '--typescript-performance-mode') {
      prioritizePerformanceOverAccuracy = true;
      cursor += 1;
      continue;
    }

    if (arg === '--workers') {
      workers = positiveInteger({ value: optionValue({ argv, cursor, name: arg, },), name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--memory') {
      memory = optionValue({ argv, cursor, name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--cpus') {
      cpus = optionValue({ argv, cursor, name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--pids-limit') {
      pidsLimit = positiveInteger({ value: optionValue({ argv, cursor, name: arg, },), name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--session-timeout-seconds') {
      sessionTimeoutSeconds = positiveInteger({ value: optionValue({ argv, cursor, name: arg, },), name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--work-tmpfs-size') {
      workTmpfsSize = optionValue({ argv, cursor, name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg === '--timeout-ms') {
      timeoutMS = positiveInteger({ value: optionValue({ argv, cursor, name: arg, },), name: arg, },);
      cursor += 2;
      continue;
    }

    if (arg.startsWith('--',))
      throw new Error(`Unknown option ${arg}`,);

    sourceFiles.push(arg,);
    cursor += 1;
  }

  if (packagePath === undefined)
    throw new Error('Missing --package <package path>',);

  return {
    packagePath,
    sourceFiles,
    fullSuite,
    dryRunOnly,
    workers,
    memory,
    cpus,
    pidsLimit,
    sessionTimeoutSeconds,
    workTmpfsSize,
    selinuxRelabel,
    skipImageBuild,
    timeoutMS,
    prioritizePerformanceOverAccuracy,
  };
}
