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
const DEFAULT_SESSION_TIMEOUT_SECONDS = 3_600;

/**
 * Default writable work-tree tmpfs size.
 */
const DEFAULT_WORK_TMPFS_SIZE = '6g';

/**
 * Default Stryker per-mutant timeout.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

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
  /**
   * Numeric value parsed from CLI text.
   */
  const parsed = Number(options.value,);

  if ((!Number.isInteger(parsed,)) || (parsed <= 0))
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
  /**
   * CLI token immediately following option name.
   */
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
  /**
   * Mutable parser state scoped to one CLI parse.
   */
  const state = {
    sourceFiles: [] as string[],
    packagePath: '',
    fullSuite: false,
    dryRunOnly: false,
    workers: 0,
    memory: DEFAULT_MEMORY,
    cpus: DEFAULT_CPUS,
    pidsLimit: DEFAULT_PIDS_LIMIT,
    sessionTimeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
    workTmpfsSize: DEFAULT_WORK_TMPFS_SIZE,
    selinuxRelabel: false,
    skipImageBuild: false,
    timeoutMS: DEFAULT_TIMEOUT_MS,
    prioritizePerformanceOverAccuracy: false,
    cursor: 0,
  };

  while (state.cursor < argv.length) {
    /**
     * Current CLI token under parser cursor.
     */
    const arg = argv[state.cursor];

    if (arg === undefined)
      break;

    if (arg === '--package') {
      state.packagePath = optionValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--full-suite') {
      state.fullSuite = true;
      state.cursor += 1;
      continue;
    }

    if (arg === '--dry-run-only') {
      state.dryRunOnly = true;
      state.cursor += 1;
      continue;
    }

    if (arg === '--selinux-relabel') {
      state.selinuxRelabel = true;
      state.cursor += 1;
      continue;
    }

    if (arg === '--skip-image-build') {
      state.skipImageBuild = true;
      state.cursor += 1;
      continue;
    }

    if (arg === '--typescript-performance-mode') {
      state.prioritizePerformanceOverAccuracy = true;
      state.cursor += 1;
      continue;
    }

    if (arg === '--workers') {
      state.workers = positiveInteger({
        value: optionValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--memory') {
      state.memory = optionValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--cpus') {
      state.cpus = optionValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--pids-limit') {
      state.pidsLimit = positiveInteger({
        value: optionValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--session-timeout-seconds') {
      state.sessionTimeoutSeconds = positiveInteger({
        value: optionValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--work-tmpfs-size') {
      state.workTmpfsSize = optionValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg === '--timeout-ms') {
      state.timeoutMS = positiveInteger({
        value: optionValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
      continue;
    }

    if (arg.startsWith('--',))
      throw new Error(`Unknown option ${arg}`,);

    /**
     * Mutable source file list from parser state.
     */
    const { sourceFiles, } = state;
    sourceFiles.push(arg,);
    state.cursor += 1;
  }

  if (state.packagePath === '')
    throw new Error('Missing --package <package path>',);

  /**
   * Parsed options excluding optional worker override.
   */
  const parsedOptions = {
    packagePath: state.packagePath,
    sourceFiles: state.sourceFiles,
    fullSuite: state.fullSuite,
    dryRunOnly: state.dryRunOnly,
    memory: state.memory,
    cpus: state.cpus,
    pidsLimit: state.pidsLimit,
    sessionTimeoutSeconds: state.sessionTimeoutSeconds,
    workTmpfsSize: state.workTmpfsSize,
    selinuxRelabel: state.selinuxRelabel,
    skipImageBuild: state.skipImageBuild,
    timeoutMS: state.timeoutMS,
    prioritizePerformanceOverAccuracy: state.prioritizePerformanceOverAccuracy,
  } satisfies Omit<CliOptions, 'workers'>;

  if (state.workers === 0)
    return parsedOptions;

  return {
    ...parsedOptions,
    workers: state.workers,
  };
}
