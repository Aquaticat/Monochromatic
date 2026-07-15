/**
 * Git command classification for trusted configuration loading.
 *
 * Fixtures target Git 2.54.0 command documentation.
 *
 * @module
 */
import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * Configuration loading decision.
 */
export type ConfigLoadingDecision = 'load-config' | 'skip-config';
/**
 * Known commands whose documented forms are inspection-only.
 */
const READ_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'annotate',
  'blame',
  'cat-file',
  'count-objects',
  'describe',
  'diff',
  'diff-files',
  'diff-index',
  'diff-tree',
  'for-each-ref',
  'grep',
  'help',
  'log',
  'ls-files',
  'ls-remote',
  'ls-tree',
  'merge-base',
  'name-rev',
  'rev-list',
  'rev-parse',
  'shortlog',
  'show',
  'show-branch',
  'show-ref',
  'status',
  'version',
  'whatchanged',
]);
/**
 * Branch flags that necessarily mutate refs or branch metadata.
 */
const BRANCH_MUTATING_LONG_FLAGS: ReadonlySet<string> = new Set([
  '--copy',
  '--delete',
  '--edit-description',
  '--force',
  '--move',
  '--set-upstream-to',
  '--unset-upstream',
]);
/**
 * Branch short-option letters that necessarily mutate.
 */
const BRANCH_MUTATING_SHORT_FLAGS: ReadonlySet<string> = new Set([
  'c',
  'C',
  'd',
  'D',
  'f',
  'm',
  'M',
]);
/**
 * Branch flags that make following positionals listing patterns.
 */
const BRANCH_LIST_FLAGS: ReadonlySet<string> = new Set([
  '--list',
  '-l',
]);
/**
 * Tag flags that necessarily create, update, or delete refs.
 */
const TAG_MUTATING_LONG_FLAGS: ReadonlySet<string> = new Set([
  '--annotate',
  '--delete',
  '--edit',
  '--force',
  '--sign',
]);
/**
 * Tag short-option letters that necessarily mutate.
 */
const TAG_MUTATING_SHORT_FLAGS: ReadonlySet<string> = new Set([
  'a',
  'd',
  'e',
  'f',
  's',
  'u',
]);
/**
 * Tag flags that make following positionals listing patterns.
 */
const TAG_LIST_FLAGS: ReadonlySet<string> = new Set([
  '--list',
  '-l',
]);
/**
 * Options whose next token is an option value rather than positional input.
 */
const MIXED_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '--column',
  '--color',
  '--contains',
  '--format',
  '--merged',
  '--no-contains',
  '--no-merged',
  '--points-at',
  '--sort',
]);

/**
 * Mixed-command scan result.
 */
type MixedCommandScan = Readonly<{
  /**
   * Whether a mutation flag appears.
   */
  mutating: boolean;
  /**
   * Whether explicit list mode appears.
   */
  listing: boolean;
  /**
   * Positionals outside option values.
   */
  positionalCount: number;
}>;
/**
 * Checks whether clustered short flags contain a mutating letter.
 *
 * @param token - one argv token
 *
 * @param mutatingLetters - action letters for current mixed command
 *
 * @returns whether token is an action-bearing short option
 */
function hasMutatingShortFlag({
  token,
  mutatingLetters,
}: Readonly<{
  token: string;
  mutatingLetters: ReadonlySet<string>;
}>,): boolean {
  if ((!token.startsWith('-',)) || token.startsWith('--',)
    || (token === '-'))
    return false;
  return (function containsMutatingLetter() {
    for (let index = 1; index < token.length; index += 1) {
      if (mutatingLetters.has(token.charAt(index,),))
        return true;
    }
    return false;
  })();
}

/**
 * Scans argument-aware mixed command forms.
 *
 * @param args - tokens after mixed subcommand
 *
 * @param mutatingLongFlags - long action flags
 *
 * @param mutatingShortFlags - short action letters
 *
 * @param listFlags - explicit list-mode flags
 *
 * @returns mutation, listing, and positional facts
 */
function scanMixedCommand({
  args,
  mutatingLongFlags,
  mutatingShortFlags,
  listFlags,
}: Readonly<{
  args: readonly string[];
  mutatingLongFlags: ReadonlySet<string>;
  mutatingShortFlags: ReadonlySet<string>;
  listFlags: ReadonlySet<string>;
}>,): MixedCommandScan {
  /**
   * Mutable linear scanner state isolated to this function.
   */
  const state: {
    afterSeparator: boolean;
    expectsValue: boolean;
    listing: boolean;
    mutating: boolean;
    positionalCount: number;
  } = {
    afterSeparator: false,
    expectsValue: false,
    listing: false,
    mutating: false,
    positionalCount: 0,
  };
  for (const token of args) {
    if (state.afterSeparator) {
      state.positionalCount += 1;
      continue;
    }
    if (token === '--') {
      state.afterSeparator = true;
      continue;
    }
    if (state.expectsValue) {
      state.expectsValue = false;
      continue;
    }
    if (MIXED_VALUE_OPTIONS.has(token,)) {
      state.expectsValue = true;
      continue;
    }
    if (token.startsWith('--',)) {
      /**
       * Long option name without optional inline assignment.
       */
      const assignmentIndex = token.indexOf('=',);
      /**
       * Exact long flag used for classification.
       */
      const optionName = assignmentIndex === (-1)
        ? token
        : token.slice(
          0,
          assignmentIndex,
        );
      state.listing ||= listFlags.has(optionName,);
      state.mutating ||= mutatingLongFlags.has(optionName,);
      continue;
    }
    if (token.startsWith('-',) && (token !== '-')) {
      state.listing ||= listFlags.has(token,);
      state.mutating ||= hasMutatingShortFlag({
        token,
        mutatingLetters: mutatingShortFlags,
      },);
      continue;
    }
    state.positionalCount += 1;
  }
  return state;
}

/**
 * Classifies whether invocation may load trusted repository configuration.
 *
 * Unknown and ambiguous commands fail toward config loading.
 *
 * @param args - exact wrapper arguments
 *
 * @returns trusted-config loading decision
 *
 * @example
 * ```ts
 * classifyConfigLoading(['status']);
 * ```
 */
export function classifyConfigLoading(args: readonly string[],): ConfigLoadingDecision {
  /**
   * Parsed subcommand location after Git globals.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  /**
   * Exact parsed Git subcommand.
   */
  const subcommand = args[subcommandIndex];
  if (subcommand === undefined)
    return 'load-config';
  if (READ_ONLY_COMMANDS.has(subcommand,))
    return 'skip-config';
  if ((subcommand !== 'branch') && (subcommand !== 'tag'))
    return 'load-config';

  /**
   * Argument-aware mixed command facts.
   */
  const scan = subcommand === 'branch'
    ? scanMixedCommand({
      args: args.slice(subcommandIndex + 1,),
      mutatingLongFlags: BRANCH_MUTATING_LONG_FLAGS,
      mutatingShortFlags: BRANCH_MUTATING_SHORT_FLAGS,
      listFlags: BRANCH_LIST_FLAGS,
    },)
    : scanMixedCommand({
      args: args.slice(subcommandIndex + 1,),
      mutatingLongFlags: TAG_MUTATING_LONG_FLAGS,
      mutatingShortFlags: TAG_MUTATING_SHORT_FLAGS,
      listFlags: TAG_LIST_FLAGS,
    },);
  if (scan.mutating)
    return 'load-config';
  if ((scan.positionalCount === 0) || scan.listing)
    return 'skip-config';
  return 'load-config';
}
