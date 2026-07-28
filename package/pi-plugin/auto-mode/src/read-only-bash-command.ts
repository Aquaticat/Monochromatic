/**
 * Command-shape proof for read-only Bash inspection.
 *
 * Keeps command semantics separate from path provenance. Only command families
 * needed by source inspection are accepted; every unknown form fails closed.
 *
 * @module
 */

import { gitIsReadOnly, } from './read-only-git-command.ts';
import type { CommandInfo, } from './types.ts';

//region Command policy

/** Commands with an implemented read-only proof. */
const PROVABLE_READ_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'find',
  'git',
  'paste',
  'printf',
  'rg',
  'sort',
]);

/** ripgrep options that execute an external helper. */
const RIPGREP_EXECUTION_OPTIONS: ReadonlySet<string> = new Set([
  '--hostname-bin',
  '--pre',
  '--pre-glob',
  '--search-zip',
  '-z',
]);

/** GNU find actions that mutate state, execute commands, or write named files. */
const FIND_NON_READ_ACTIONS: ReadonlySet<string> = new Set([
  '-delete',
  '-exec',
  '-execdir',
  '-fls',
  '-fprintf',
  '-fprint',
  '-fprint0',
  '-ok',
  '-okdir',
]);

/** GNU find traversal modes that can follow descendants outside proved roots. */
const FIND_UNBOUNDED_LINK_OPTIONS: ReadonlySet<string> = new Set([
  '-H',
  '-L',
]);

/** GNU sort options that select an explicit output or helper program. */
const SORT_NON_READ_OPTIONS: ReadonlySet<string> = new Set([
  '--compress-program',
  '--output',
  '-o',
]);

/** Shell printf option that assigns variable instead of writing standard output. */
const PRINTF_NON_READ_OPTIONS: ReadonlySet<string> = new Set(['-v',]);

//endregion Command policy

//region Option scanning

/**
 * Check whether argument selects option, including attached option values.
 *
 * @param argument - current command argument
 *
 * @param option - exact short or long option name
 *
 * @returns whether argument uses option
 *
 * @example
 * ```typescript
 * optionMatches({ argument: '--pre=cat', option: '--pre' });
 * ```
 */
function optionMatches(
  {
    argument,
    option,
  }: {
    readonly argument: string;
    readonly option: string;
  },
): boolean {
  if (argument === option)
    return true;
  if (option.startsWith('--',))
    return argument.startsWith(`${option}=`,);
  return (option.length === 2)
    && argument.startsWith(option,)
    && (argument.length > option.length);
}

/**
 * Check arguments against blocked option names.
 *
 * @param args - command arguments
 *
 * @param blockedOptions - options that invalidate read-only proof
 *
 * @returns whether blocked option appears
 *
 * @example
 * ```typescript
 * hasBlockedOption({ args: ['--output=file'], blockedOptions: SORT_NON_READ_OPTIONS });
 * ```
 */
function hasBlockedOption(
  {
    args,
    blockedOptions,
  }: {
    readonly args: readonly string[];
    readonly blockedOptions: ReadonlySet<string>;
  },
): boolean {
  return args.some(function argumentUsesBlockedOption(argument,): boolean {
    for (const option of blockedOptions) {
      if (optionMatches({ argument, option, },))
        return true;
    }
    return false;
  },);
}

//endregion Option scanning

//region Family proofs

/**
 * Prove ripgrep form cannot execute configured helper commands.
 *
 * @param args - ripgrep arguments
 *
 * @returns whether command shape is read-only
 *
 * @example
 * ```typescript
 * ripgrepIsReadOnly(['--line-number', 'needle', '.']);
 * ```
 */
function ripgrepIsReadOnly(
  args: readonly string[],
): boolean {
  if (process.env['RIPGREP_CONFIG_PATH'] !== undefined)
    return false;
  return !hasBlockedOption({
    args,
    blockedOptions: RIPGREP_EXECUTION_OPTIONS,
  },);
}

/**
 * Prove GNU find expression has no mutation, subprocess, named-output, or link-following action.
 *
 * @param args - find arguments
 *
 * @returns whether command shape is read-only
 *
 * @example
 * ```typescript
 * findIsReadOnly(['/repo', '-type', 'f', '-print']);
 * ```
 */
function findIsReadOnly(
  args: readonly string[],
): boolean {
  if (hasBlockedOption({
    args,
    blockedOptions: FIND_NON_READ_ACTIONS,
  },)) {
    return false;
  }
  return !hasBlockedOption({
    args,
    blockedOptions: FIND_UNBOUNDED_LINK_OPTIONS,
  },);
}

/**
 * Prove GNU sort writes only standard output and invokes no compression helper.
 *
 * @param args - sort arguments
 *
 * @returns whether command shape is read-only
 *
 * @example
 * ```typescript
 * sortIsReadOnly([]);
 * ```
 */
function sortIsReadOnly(
  args: readonly string[],
): boolean {
  return !hasBlockedOption({
    args,
    blockedOptions: SORT_NON_READ_OPTIONS,
  },);
}

//endregion Family proofs

//region Public proof

/**
 * Check whether command family has implemented positive read-only proof.
 *
 * @param name - parsed command name
 *
 * @returns whether command should enter read-proof policy
 *
 * @example
 * ```typescript
 * supportsReadOnlyProof('rg');
 * ```
 */
function supportsReadOnlyProof(
  name: string,
): boolean {
  return PROVABLE_READ_ONLY_COMMANDS.has(name,);
}

/**
 * Prove parsed command shape cannot mutate files or execute nested helpers.
 *
 * Path scope and expansion provenance are checked by caller.
 *
 * @param command - parsed command record
 *
 * @returns whether command shape is read-only
 *
 * @example
 * ```typescript
 * commandIsReadOnly(command);
 * ```
 */
function commandIsReadOnly(
  command: CommandInfo,
): boolean {
  if (command.envAssignments.length > 0)
    return false;
  if (command.redirects.some(function redirectWritesFile(redirect,): boolean {
    return redirect.writesFile;
  },)) {
    return false;
  }
  if (command.name === 'rg')
    return ripgrepIsReadOnly(command.args,);
  if (command.name === 'find')
    return findIsReadOnly(command.args,);
  if (command.name === 'sort')
    return sortIsReadOnly(command.args,);
  if (command.name === 'git')
    return gitIsReadOnly(command.args,);
  if (command.name === 'printf') {
    return !hasBlockedOption({
      args: command.args,
      blockedOptions: PRINTF_NON_READ_OPTIONS,
    },);
  }
  return command.name === 'paste';
}

//endregion Public proof

export {
  commandIsReadOnly,
  supportsReadOnlyProof,
};
