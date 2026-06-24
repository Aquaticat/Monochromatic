import {
  hasShortOption,
  isExactShortOption,
  matchesLongOption,
} from './branch-create-shared.ts';

//region git-branch option vocabulary

/**
 * Complete long-option vocabulary used to disambiguate git-branch long-option abbreviations.
 */
const BRANCH_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--abbrev',
  '--all',
  '--color',
  '--column',
  '--contains',
  '--copy',
  '--create-reflog',
  '--delete',
  '--edit-description',
  '--force',
  '--format',
  '--ignore-case',
  '--list',
  '--merged',
  '--move',
  '--no-abbrev',
  '--no-color',
  '--no-column',
  '--no-contains',
  '--no-create-reflog',
  '--no-merged',
  '--no-track',
  '--omit-empty',
  '--points-at',
  '--quiet',
  '--recurse-submodules',
  '--remotes',
  '--set-upstream',
  '--set-upstream-to',
  '--show-current',
  '--sort',
  '--track',
  '--unset-upstream',
  '--verbose',
]);

/**
 * git-branch long options that put command in list or inspection mode.
 */
const BRANCH_LIST_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--abbrev',
  '--all',
  '--color',
  '--column',
  '--contains',
  '--format',
  '--ignore-case',
  '--list',
  '--merged',
  '--no-abbrev',
  '--no-color',
  '--no-column',
  '--no-contains',
  '--no-merged',
  '--omit-empty',
  '--points-at',
  '--remotes',
  '--show-current',
  '--sort',
  '--verbose',
]);

/**
 * git-branch long options that mutate existing branch metadata without creating a new branch.
 */
const BRANCH_NON_CREATE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--delete',
  '--edit-description',
  '--move',
  '--set-upstream',
  '--set-upstream-to',
  '--unset-upstream',
]);

/**
 * git-branch long options that copy an existing branch to a new branch name.
 */
const BRANCH_COPY_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--copy',
]);

/**
 * git-branch long options whose separated form consumes next argv token.
 */
const BRANCH_VALUE_LONG_OPTIONS: ReadonlySet<string> = new Set([
  '--abbrev',
  '--format',
  '--points-at',
  '--set-upstream-to',
  '--sort',
]);

//endregion git-branch option vocabulary

//region git-branch option predicates

/**
 * Reports whether git-branch option is a list or inspection mode.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg makes positionals branch patterns rather than new branch names.
 */
export function isBranchListModeOption(arg: string,): boolean {
  return hasShortOption({ arg, option: 'a', })
    || hasShortOption({ arg, option: 'i', })
    || hasShortOption({ arg, option: 'l', })
    || hasShortOption({ arg, option: 'r', })
    || hasShortOption({ arg, option: 'v', })
    || matchesLongOption({
      arg,
      canonicalOptions: BRANCH_LIST_LONG_OPTIONS,
      knownOptions: BRANCH_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-branch option mutates existing refs without branch creation.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects delete, move, or upstream-edit mode.
 */
export function isBranchNonCreateModeOption(arg: string,): boolean {
  return hasShortOption({ arg, option: 'd', })
    || hasShortOption({ arg, option: 'D', })
    || hasShortOption({ arg, option: 'm', })
    || hasShortOption({ arg, option: 'M', })
    || hasShortOption({ arg, option: 'u', })
    || matchesLongOption({
      arg,
      canonicalOptions: BRANCH_NON_CREATE_LONG_OPTIONS,
      knownOptions: BRANCH_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-branch option copies existing branch to new branch.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when arg selects copy mode.
 */
export function isBranchCopyModeOption(arg: string,): boolean {
  return hasShortOption({ arg, option: 'c', })
    || hasShortOption({ arg, option: 'C', })
    || matchesLongOption({
      arg,
      canonicalOptions: BRANCH_COPY_LONG_OPTIONS,
      knownOptions: BRANCH_LONG_OPTIONS,
    },);
}

/**
 * Reports whether git-branch option consumes next argv token.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when next token is an option value.
 */
export function branchConsumesNextValue(arg: string,): boolean {
  if (arg.includes('=',))
    return false;

  return isExactShortOption({ arg, option: 'u', })
    || matchesLongOption({
      arg,
      canonicalOptions: BRANCH_VALUE_LONG_OPTIONS,
      knownOptions: BRANCH_LONG_OPTIONS,
    },);
}

//endregion git-branch option predicates
