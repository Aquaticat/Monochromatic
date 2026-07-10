import {
  hasShortOption,
  isExactShortOption,
  matchesLongOption,
} from './branch-create-shared.ts';

//region git-checkout option vocabulary

/**
 * Complete long-option vocabulary used to disambiguate git-checkout abbreviations.
 */
const CHECKOUT_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--conflict',
  '--detach',
  '--force',
  '--guess',
  '--ignore-other-worktrees',
  '--ignore-skip-worktree-bits',
  '--inter-hunk-context',
  '--merge',
  '--no-guess',
  '--no-overlay',
  '--no-overwrite-ignore',
  '--no-progress',
  '--no-recurse-submodules',
  '--no-track',
  '--orphan',
  '--ours',
  '--overlay',
  '--overwrite-ignore',
  '--patch',
  '--pathspec-file-nul',
  '--pathspec-from-file',
  '--progress',
  '--quiet',
  '--recurse-submodules',
  '--theirs',
  '--track',
  '--unified',
]);

/**
 * git-checkout long options that explicitly create a new branch.
 */
const CHECKOUT_CREATE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--orphan',
  '--track',
]);

/**
 * git-checkout long options that choose detached or path-restore modes.
 */
const CHECKOUT_NON_GUESS_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--detach',
  '--no-guess',
  '--ours',
  '--patch',
  '--pathspec-from-file',
  '--theirs',
]);

/**
 * git-checkout long options whose separated form consumes next argv token.
 */
const CHECKOUT_VALUE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--conflict',
  '--inter-hunk-context',
  '--orphan',
  '--pathspec-from-file',
  '--unified',
]);

//endregion git-checkout option vocabulary

//region git-checkout option predicates

/**
 * Reports whether git-checkout option explicitly creates a branch. Checks
 * each short form with {@link hasShortOption} and the long forms with
 * {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects `-b`, `-B`, `--orphan`, or `--track` creation.
 *
 * @example
 * ```ts
 * isCheckoutCreateOption('-b');
 * // => true
 * ```
 */
export function isCheckoutCreateOption(arg: string,): boolean {
  return hasShortOption({
    arg,
    option: 'b',
  },)
    || hasShortOption({
      arg,
      option: 'B',
    },)
    || hasShortOption({
      arg,
      option: 't',
    },)
    || matchesLongOption({
      arg,
      canonicalOptions: CHECKOUT_CREATE_LONG_OPTIONS,
      knownOptions: CHECKOUT_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-checkout option prevents remote branch guessing.
 * Checks each short form with {@link hasShortOption} and the long forms with
 * {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects detached, path restore, patch, or no-guess mode.
 *
 * @example
 * ```ts
 * isCheckoutNonGuessOption('--no-guess');
 * // => true
 * ```
 */
export function isCheckoutNonGuessOption(arg: string,): boolean {
  return hasShortOption({
    arg,
    option: 'd',
  },)
    || hasShortOption({
      arg,
      option: 'p',
    },)
    || matchesLongOption({
      arg,
      canonicalOptions: CHECKOUT_NON_GUESS_LONG_OPTIONS,
      knownOptions: CHECKOUT_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-checkout option consumes next argv token. Checks the
 * separated short forms with {@link isExactShortOption} and the separated
 * long forms with {@link matchesLongOption}.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when next token is an option value.
 *
 * @example
 * ```ts
 * checkoutConsumesNextValue('--orphan');
 * // => true
 * ```
 */
export function checkoutConsumesNextValue(arg: string,): boolean {
  if (arg.includes('=',))
    return false;

  return isExactShortOption({
    arg,
    option: 'b',
  },)
    || isExactShortOption({
      arg,
      option: 'B',
    },)
    || isExactShortOption({
      arg,
      option: 'U',
    },)
    || matchesLongOption({
      arg,
      canonicalOptions: CHECKOUT_VALUE_LONG_OPTIONS,
      knownOptions: CHECKOUT_LONG_OPTIONS,
    },);
}

//endregion git-checkout option predicates
