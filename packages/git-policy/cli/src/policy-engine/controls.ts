/**
 * Wrapper policy control parsing and escape compatibility. @module
 */
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { consumesNextValue, } from '../parser/branch-create-dispatch.ts';
import type { BranchCreationSubcommand, } from '../parser/branch-create-types.ts';
import type { ParsedPolicyControls, } from './types.ts';

/**
 * Wrapper-only continue flag.
 */
const KEEP_GOING_FLAG = '--cli-git-keep-going';
/**
 * Value-taking options whose following token is never wrapper control syntax.
 */
const VALUE_TAKING_OPTIONS: ReadonlySet<string> = new Set([
  '-c',
  '-C',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--attr-source',
  '-m',
  '--message',
  '-F',
  '--file',
  '--author',
  '--date',
  '-e',
  '--exclude',
  '--pathspec-from-file',
]);
/**
 * Legacy policy escape aliases preserved during migration.
 */
const POLICY_ESCAPE_ALIASES: ReadonlyMap<string, string> = new Map([
  [
    '--no-enforce-worktree',
    'linked-worktree-only',
  ],
  [
    '--no-enforce-worktree-branch',
    'branch-worktree-only',
  ],
  [
    '--no-enforce-bulk-add',
    'add-explicit',
  ],
]);

/**
 * Registered policy name projected without callback-bearing declaration.
 */
type RegisteredPolicyName = Readonly<{
  /**
   * Effective policy ID.
   */
  name: string;
}>;

/**
 * Returns escape flag for policy ID.
 *
 * @param policyId - policy receiving one-invocation bypass
 *
 * @returns exact wrapper-only flag
 */
function escapeFlag(policyId: string,): string {
  return `--no-enforce-${policyId}`;
}

/**
 * Narrows branch-creation subcommands for value parsing.
 *
 * @param value - located subcommand
 *
 * @returns whether branch parser owns option vocabulary
 */
function isBranchSubcommand(value: string,): value is BranchCreationSubcommand {
  return (value === 'branch') || (value === 'checkout')
    || (value === 'switch');
}

/**
 * Reports whether option consumes following wrapper token as value.
 *
 * @param arg - current option token
 *
 * @param subcommand - located Git subcommand
 *
 * @param afterSubcommand - whether token belongs to command region
 *
 * @returns whether next token cannot be wrapper control
 */
function optionConsumesNext({
  arg,
  subcommand,
  afterSubcommand,
}: Readonly<{
  arg: string;
  subcommand: string;
  afterSubcommand: boolean;
}>,): boolean {
  if (VALUE_TAKING_OPTIONS.has(arg,))
    return true;
  if (afterSubcommand && (subcommand === 'clean')
    && arg.startsWith('--',)
    && '--exclude'.startsWith(arg,))
    return true;
  return afterSubcommand && isBranchSubcommand(subcommand,)
    && consumesNextValue({
      subcommand,
      arg,
    });
}

/**
 * Parses wrapper controls without treating option values or pathspecs as flags.
 *
 * @param args - exact wrapper arguments
 *
 * @param registeredPolicies - effective registry names
 *
 * @returns controls plus forwardable argument sequence
 *
 * @example
 * ```ts
 * parsePolicyControls({ args: ['--no-enforce-require-root', 'status'], registeredPolicies });
 * ```
 */
export function parsePolicyControls({
  args,
  registeredPolicies,
}: Readonly<{
  args: readonly string[];
  registeredPolicies: readonly RegisteredPolicyName[];
}>,): ParsedPolicyControls {
  /**
   * Escape flags recognized by effective registry.
   */
  const knownEscapeFlags = new Map(registeredPolicies.map(function toEscapeEntry(policy,) {
    return [
      escapeFlag(policy.name,),
      policy.name,
    ] as const;
  },),);
  POLICY_ESCAPE_ALIASES.forEach(function registerAlias(
    policyId,
    flag,
  ) {
    if (registeredPolicies.some(function isRegistered(policy,) {
      return policy.name === policyId;
    },))
      knownEscapeFlags.set(
        flag,
        policyId,
      );
  },);
  /**
   * Located subcommand index for command-specific option arity.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  /**
   * Located subcommand or empty non-option value.
   */
  const subcommand = args[subcommandIndex] ?? '';
  /**
   * Mutable scan isolated inside one synchronous pass.
   */
  return (function collectControls(): ParsedPolicyControls {
    /**
     * Policy IDs bypassed before pathspec separator.
     */
    const escapedPolicyIds = new Set<string>();
    /**
     * Mutable scalar scan state.
     */
    const state = {
      keepGoing: false,
      separatorReached: false,
      previousTakesValue: false,
    };
    /**
     * Arguments retained for real Git.
     */
    const forwardableArgs = args.filter(function retainArgument(
      arg,
      index,
    ) {
      if (state.separatorReached)
        return true;
      if (arg === '--') {
        state.separatorReached = true;
        return true;
      }
      if (state.previousTakesValue) {
        state.previousTakesValue = false;
        return true;
      }
      state.previousTakesValue = optionConsumesNext({
        arg,
        subcommand,
        afterSubcommand: index > subcommandIndex,
      },);
      if (arg === KEEP_GOING_FLAG) {
        state.keepGoing = true;
        return false;
      }
      /**
       * Policy selected by current exact escape flag.
       */
      const escapedPolicyId = knownEscapeFlags.get(arg,);
      if (escapedPolicyId !== undefined) {
        escapedPolicyIds.add(escapedPolicyId,);
        return false;
      }
      return true;
    },);
    return {
      args: forwardableArgs,
      keepGoing: state.keepGoing,
      escapedPolicyIds,
    };
  })();
}
