import {
  hasShortOption,
  isExactShortOption,
  matchesLongOption,
} from './branch-create-shared.ts';

//region git-switch option vocabulary

/**
 * Complete long-option vocabulary used to disambiguate git-switch abbreviations.
 */
const SWITCH_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--conflict',
  '--create',
  '--detach',
  '--discard-changes',
  '--force',
  '--force-create',
  '--guess',
  '--ignore-other-worktrees',
  '--merge',
  '--no-guess',
  '--no-progress',
  '--no-recurse-submodules',
  '--no-track',
  '--orphan',
  '--progress',
  '--quiet',
  '--recurse-submodules',
  '--track',
]);

/**
 * git-switch long options that explicitly create a new branch.
 */
const SWITCH_CREATE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--create',
  '--force-create',
  '--orphan',
  '--track',
]);

/**
 * git-switch long options that prevent remote branch guessing.
 */
const SWITCH_NON_GUESS_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--detach',
  '--no-guess',
]);

/**
 * git-switch long options whose separated form consumes next argv token.
 */
const SWITCH_VALUE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--conflict',
  '--create',
  '--force-create',
  '--orphan',
]);

//endregion git-switch option vocabulary

//region git-switch option predicates

/**
 * Reports whether git-switch option explicitly creates a branch. Checks each
 * short form with {@link hasShortOption} and the long forms with
 * {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects `-c`, `-C`, `--orphan`, or `--track` creation.
 *
 * @example
 * ```ts
 * isSwitchCreateOption('--create');
 * // => true
 * ```
 */
export function isSwitchCreateOption(arg: string,): boolean {
  return hasShortOption({
    arg,
    option: 'c',
  },)
    || hasShortOption({
      arg,
      option: 'C',
    },)
    || hasShortOption({
      arg,
      option: 't',
    },)
    || matchesLongOption({
      arg,
      canonicalOptions: SWITCH_CREATE_LONG_OPTIONS,
      knownOptions: SWITCH_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-switch option prevents remote branch guessing. Checks
 * the short form with {@link hasShortOption} and the long forms with
 * {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects detached or no-guess mode.
 *
 * @example
 * ```ts
 * isSwitchNonGuessOption('--detach');
 * // => true
 * ```
 */
export function isSwitchNonGuessOption(arg: string,): boolean {
  return hasShortOption({
    arg,
    option: 'd',
  },)
    || matchesLongOption({
      arg,
      canonicalOptions: SWITCH_NON_GUESS_LONG_OPTIONS,
      knownOptions: SWITCH_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-switch option consumes next argv token. Checks the
 * separated short forms with {@link isExactShortOption} and the separated
 * long forms with {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when next token is an option value.
 *
 * @example
 * ```ts
 * switchConsumesNextValue('--create');
 * // => true
 * ```
 */
export function switchConsumesNextValue(arg: string,): boolean {
  if (arg.includes('=',))
    return false;

  return isExactShortOption({
    arg,
    option: 'c',
  },)
    || isExactShortOption({
      arg,
      option: 'C',
    },)
    || matchesLongOption({
      arg,
      canonicalOptions: SWITCH_VALUE_LONG_OPTIONS,
      knownOptions: SWITCH_LONG_OPTIONS,
    },);
}

//endregion git-switch option predicates
