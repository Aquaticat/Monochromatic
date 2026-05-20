import { PATHSPEC_SEPARATOR, } from './linked-worktree-constants.ts';

//region Git reset worktree-change policy

/** Reset mode abbreviation accepted by Git's long-option parser. */
type DestructiveResetModePrefix = {
  /** Full destructive reset mode. */
  readonly option: string;
  /** Shortest accepted argv token for this option. */
  readonly shortestAcceptedPrefix: string;
};

/** Reset modes and shortest unique abbreviations that update worktree files. */
const DESTRUCTIVE_RESET_MODE_PREFIXES: readonly DestructiveResetModePrefix[] = [
  {
    option: '--hard',
    shortestAcceptedPrefix: '--h',
  },
  {
    option: '--merge',
    shortestAcceptedPrefix: '--me',
  },
  {
    option: '--keep',
    shortestAcceptedPrefix: '--k',
  },
];

/** Options for comparing an argv token with a destructive reset mode prefix. */
type MatchesDestructiveResetModeOptions = {
  /** Post-subcommand argv token. */
  readonly arg: string;
  /** Destructive reset mode and shortest accepted prefix. */
  readonly mode: DestructiveResetModePrefix;
};

/**
 * Checks whether argv token is accepted by Git as destructive reset mode.
 *
 * Git accepts unique long-option abbreviations, so `--h`, `--me`, and `--k`
 * need the same guard as `--hard`, `--merge`, and `--keep`.
 *
 * @param arg - Post-subcommand argv token.
 *
 * @param mode - Destructive reset mode and shortest accepted prefix.
 *
 * @returns `true` when token resolves to destructive reset mode.
 *
 * @example
 * ```ts
 * matchesDestructiveResetMode({ arg: '--h', mode: { option: '--hard', shortestAcceptedPrefix: '--h' } });
 * // => true
 * ```
 */
function matchesDestructiveResetMode({
  arg,
  mode,
}: MatchesDestructiveResetModeOptions,): boolean {
  return (arg.length >= mode.shortestAcceptedPrefix.length)
    && mode.option.startsWith(arg,);
}

/**
 * Detects destructive reset mode token, including accepted abbreviations.
 *
 * @param arg - Post-subcommand argv token.
 *
 * @returns `true` when token selects a worktree-updating reset mode.
 *
 * @example
 * ```ts
 * isDestructiveResetMode('--h');
 * // => true
 * ```
 */
function isDestructiveResetMode(arg: string,): boolean {
  return DESTRUCTIVE_RESET_MODE_PREFIXES.some(function matchesMode(mode,): boolean {
    return matchesDestructiveResetMode({
      arg,
      mode,
    },);
  },);
}

/**
 * Recursively detects destructive reset modes before pathspec separator.
 *
 * @param postSubcommandArgs - Arguments strictly after `reset` subcommand.
 *
 * @returns `true` when destructive reset mode appears before `--`.
 *
 * @example
 * ```ts
 * resetChangesWorktree(['--hard', 'HEAD~1']);
 * // => true
 * ```
 */
export function resetChangesWorktree(postSubcommandArgs: readonly string[],): boolean {
  /** Current reset argv token. */
  const [arg,] = postSubcommandArgs;

  if ((arg === undefined) || (arg === PATHSPEC_SEPARATOR))
    return false;

  if (isDestructiveResetMode(arg,))
    return true;

  return resetChangesWorktree(postSubcommandArgs.slice(1,),);
}

//endregion Git reset worktree-change policy
