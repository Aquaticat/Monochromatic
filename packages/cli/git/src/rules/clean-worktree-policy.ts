import { PATHSPEC_SEPARATOR, } from './linked-worktree-constants.ts';

//region Git clean worktree-change policy

/** Clean option that consumes next argv token as an exclude pattern. */
const CLEAN_SEPARATE_EXCLUDE_OPTION = '-e';

/** Clean long option that consumes next argv token as an exclude pattern. */
const CLEAN_SEPARATE_LONG_EXCLUDE_OPTION = '--exclude';

/** Clean long option prefix that carries exclude pattern in same argv token. */
const CLEAN_GLUED_EXCLUDE_OPTION_PREFIX = '--exclude=';

/** Clean short option that enables dry-run inspection. */
const CLEAN_DRY_RUN_SHORT_OPTION = 'n';

/** Clean long option that enables dry-run inspection. */
const CLEAN_DRY_RUN_LONG_OPTION = '--dry-run';

/** Clean short option that enables interactive deletion. */
const CLEAN_INTERACTIVE_SHORT_OPTION = 'i';

/** Clean long option that enables interactive deletion. */
const CLEAN_INTERACTIVE_LONG_OPTION = '--interactive';

/** Clean short option that consumes the rest of the cluster, or next token, as an exclude pattern. */
const CLEAN_EXCLUDE_SHORT_OPTION = 'e';

/** Accumulated state from scanning `git clean` options. */
type CleanOptionScan = {
  /** Whether `-n` or `--dry-run` appeared before pathspec separator. */
  readonly hasDryRun: boolean;
  /** Whether `-i` or `--interactive` appeared before pathspec separator. */
  readonly hasInteractive: boolean;
};

/** Options for scanning a compact short-option cluster from `git clean`. */
type ScanCleanShortOptionClusterOptions = {
  /** Short-option cluster such as `-ndX` or `-ine`. */
  readonly cluster: string;
  /** Scan state accumulated before this cluster. */
  readonly scan: CleanOptionScan;
};

/** Options for recursively scanning characters inside a `git clean` short-option cluster. */
type ScanCleanShortOptionTextOptions = {
  /** Cluster text without leading dash. */
  readonly optionText: string;
  /** Current character index. */
  readonly index: number;
  /** Scan state accumulated before current character. */
  readonly scan: CleanOptionScan;
};

/** Options for recursively scanning `git clean` post-subcommand arguments. */
type ScanCleanOptionsOptions = {
  /** Arguments strictly after `clean` subcommand. */
  readonly args: readonly string[];
  /** Current argv index. */
  readonly index: number;
  /** Scan state accumulated before current argv token. */
  readonly scan: CleanOptionScan;
};

/** Initial clean option scan before reading any argv token. */
const INITIAL_CLEAN_OPTION_SCAN: CleanOptionScan = {
  hasDryRun: false,
  hasInteractive: false,
};

/**
 * Detects compact short-option clusters such as `-ndX`.
 *
 * @param arg - Post-subcommand argv token.
 *
 * @returns `true` when token is a short-option cluster.
 *
 * @example
 * ```ts
 * isShortOptionCluster('-ndX');
 * // => true
 * ```
 */
function isShortOptionCluster(arg: string,): boolean {
  return arg.startsWith('-',)
    && (!arg.startsWith('--',))
    && (arg.length > 2);
}

/**
 * Scans characters in compact `git clean` short-option text.
 *
 * @param optionText - Cluster text without leading dash.
 *
 * @param index - Character index to inspect.
 *
 * @param scan - Accumulated scan state.
 *
 * @returns Updated clean option scan.
 *
 * @example
 * ```ts
 * scanCleanShortOptionText({ optionText: 'ndX', index: 0, scan: INITIAL_CLEAN_OPTION_SCAN });
 * // => { hasDryRun: true, hasInteractive: false }
 * ```
 */
function scanCleanShortOptionText({
  optionText,
  index,
  scan,
}: ScanCleanShortOptionTextOptions,): CleanOptionScan {
  /** Current short option character. */
  const option = optionText[index];

  if (option === undefined)
    return scan;

  if (option === CLEAN_EXCLUDE_SHORT_OPTION)
    return scan;

  if (option === CLEAN_DRY_RUN_SHORT_OPTION) {
    return scanCleanShortOptionText({
      optionText,
      index: index + 1,
      scan: {
        ...scan,
        hasDryRun: true,
      },
    },);
  }

  if (option === CLEAN_INTERACTIVE_SHORT_OPTION) {
    return scanCleanShortOptionText({
      optionText,
      index: index + 1,
      scan: {
        ...scan,
        hasInteractive: true,
      },
    },);
  }

  return scanCleanShortOptionText({
    optionText,
    index: index + 1,
    scan,
  },);
}

/**
 * Scans compact `git clean` short-option cluster.
 *
 * @param cluster - Short-option cluster such as `-ndX` or `-ine`.
 *
 * @param scan - Accumulated scan state.
 *
 * @returns Updated clean option scan.
 *
 * @example
 * ```ts
 * scanCleanShortOptionCluster({ cluster: '-ndX', scan: INITIAL_CLEAN_OPTION_SCAN });
 * // => { hasDryRun: true, hasInteractive: false }
 * ```
 */
function scanCleanShortOptionCluster({
  cluster,
  scan,
}: ScanCleanShortOptionClusterOptions,): CleanOptionScan {
  return scanCleanShortOptionText({
    optionText: cluster.slice(1,),
    index: 0,
    scan,
  },);
}

/**
 * Recursively scans `git clean` options before pathspec separator.
 *
 * @param args - Arguments strictly after `clean` subcommand.
 *
 * @param index - Current argv index.
 *
 * @param scan - Accumulated scan state.
 *
 * @returns Dry-run and interactive option presence.
 *
 * @example
 * ```ts
 * scanCleanOptions({ args: ['-ndX'], index: 0, scan: INITIAL_CLEAN_OPTION_SCAN });
 * // => { hasDryRun: true, hasInteractive: false }
 * ```
 */
function scanCleanOptions({
  args,
  index,
  scan,
}: ScanCleanOptionsOptions,): CleanOptionScan {
  /** Current post-subcommand argv token. */
  const arg = args[index];

  if ((arg === undefined) || (arg === PATHSPEC_SEPARATOR))
    return scan;

  if ((arg === CLEAN_SEPARATE_EXCLUDE_OPTION) || (arg === CLEAN_SEPARATE_LONG_EXCLUDE_OPTION)) {
    return scanCleanOptions({
      args,
      index: index + 2,
      scan,
    },);
  }

  if (arg.startsWith(CLEAN_GLUED_EXCLUDE_OPTION_PREFIX,)) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan,
    },);
  }

  if (arg === CLEAN_DRY_RUN_LONG_OPTION) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan: {
        ...scan,
        hasDryRun: true,
      },
    },);
  }

  if (arg === CLEAN_INTERACTIVE_LONG_OPTION) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan: {
        ...scan,
        hasInteractive: true,
      },
    },);
  }

  if (arg === `-${CLEAN_DRY_RUN_SHORT_OPTION}`) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan: {
        ...scan,
        hasDryRun: true,
      },
    },);
  }

  if (arg === `-${CLEAN_INTERACTIVE_SHORT_OPTION}`) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan: {
        ...scan,
        hasInteractive: true,
      },
    },);
  }

  if (isShortOptionCluster(arg,)) {
    return scanCleanOptions({
      args,
      index: index + 1,
      scan: scanCleanShortOptionCluster({
        cluster: arg,
        scan,
      },),
    },);
  }

  return scanCleanOptions({
    args,
    index: index + 1,
    scan,
  },);
}

/**
 * Determines whether a `git clean` invocation may remove files.
 *
 * Git clean documentation says `--dry-run`/`-n` does not remove anything and
 * `--interactive`/`-i` can enter a clean command loop that deletes selected
 * paths, so interactive form remains guarded even when dry-run also appears.
 *
 * @param postSubcommandArgs - Arguments strictly after `clean` subcommand.
 *
 * @returns `true` when invocation can change worktree filesystem state.
 *
 * @example
 * ```ts
 * cleanChangesWorktree(['-ndX']);
 * // => false
 * ```
 */
export function cleanChangesWorktree(postSubcommandArgs: readonly string[],): boolean {
  /** Dry-run and interactive flags discovered before pathspec separator. */
  const scan = scanCleanOptions({
    args: postSubcommandArgs,
    index: 0,
    scan: INITIAL_CLEAN_OPTION_SCAN,
  },);

  return scan.hasInteractive || (!scan.hasDryRun);
}

//endregion Git clean worktree-change policy
