/**
 * Management-command grammar replacing the `@optique/core` facade.
 *
 * @module
 */
import {
  ARGV_REFUSED,
  type ArgvSpec,
  tryParseArgv,
} from './parser/argv.ts';

/**
 * Management grammar rejected the invocation, and no action can be taken.
 */
export const MANAGEMENT_REFUSED: unique symbol = Symbol(
  'wrapper subcommand matched none of trust, untrust, status, check, or fix',
);

/**
 * Complete management grammar surfaced when an invocation is rejected.
 */
export const MANAGEMENT_USAGE: string = [
  'Usage: git cli-git trust [--yes]',
  '       git cli-git untrust',
  '       git cli-git status',
  '       git cli-git check [--all] [--policy <id>]... [-- <pathspec>...]',
  '       git cli-git fix [--all] [--policy <id>]... [-- <pathspec>...]',
].join('\n',);

/**
 * One resolved management action.
 */
export type ManagementAction =
  | Readonly<{
    /**
     * Trust command granting consent to current config bytes.
     */
    command: 'trust';
    /**
     * Whether consent was given noninteractively.
     */
    yes: boolean;
  }>
  | Readonly<{
    /**
     * Untrust command revoking stored consent.
     */
    command: 'untrust';
  }>
  | Readonly<{
    /**
     * Status command reporting stored consent state.
     */
    command: 'status';
  }>
  | Readonly<{
    /**
     * Direct policy command over an explicit scope.
     */
    command: 'check' | 'fix';
    /**
     * Whether complete repository scope was selected.
     */
    all: boolean;
    /**
     * Selected policy filter in first-occurrence order.
     */
    policies: readonly string[];
    /**
     * Positional pathspec scope, in encounter order.
     */
    pathspecs: readonly string[];
  }>;

/**
 * Declared surface of the `trust` command.
 */
const TRUST_SPEC: ArgvSpec = {
  flags: { yes: { names: ['--yes',], }, },
  valueOptions: {},
};

/**
 * Declared surface of the `check` and `fix` commands.
 */
const DIRECT_SPEC: ArgvSpec = {
  flags: { all: { names: ['--all',], }, },
  valueOptions: { policies: { names: ['--policy',], }, },
};

/**
 * Declared surface of commands taking no option.
 */
const BARE_SPEC: ArgvSpec = {
  flags: {},
  valueOptions: {},
};

/**
 * Parses management arguments into one resolved action.
 *
 * Dispatches on the leading command name rather than trying every grammar in
 * turn, so an invocation naming two commands is rejected for naming an unknown
 * option rather than for an ambiguity the caller never expressed.
 *
 * @param args - complete management arguments, command name first
 *
 * @returns resolved action, or refusal sentinel
 *
 * @example
 * ```ts
 * parseManagementArgs(['trust', '--yes']);
 * // => { command: 'trust', yes: true }
 * ```
 */
export function parseManagementArgs(args: readonly string[],): ManagementAction | typeof MANAGEMENT_REFUSED {
  /**
   * Leading command name selecting one grammar.
   */
  const [name,] = args;
  /**
   * Arguments after command name.
   */
  const rest = args.slice(1,);
  if ((name === 'untrust') || (name === 'status')) {
    /**
     * Parsed bare-command region, rejecting any option.
     */
    const parsed = tryParseArgv({
      args: rest,
      spec: BARE_SPEC,
    },);
    if ((parsed === ARGV_REFUSED) || (parsed.unknownOptions
      .length
      > 0)
      || (parsed.positionals
        .length
        > 0))
      return MANAGEMENT_REFUSED;
    return { command: name, };
  }
  if (name === 'trust') {
    /**
     * Parsed trust region.
     */
    const parsed = tryParseArgv({
      args: rest,
      spec: TRUST_SPEC,
    },);
    if ((parsed === ARGV_REFUSED) || (parsed.unknownOptions
      .length
      > 0)
      || (parsed.positionals
        .length
        > 0))
      return MANAGEMENT_REFUSED;
    return {
      command: 'trust',
      yes: (parsed.flagCounts
        .yes
        ?? 0)
        > 0,
    };
  }
  if ((name === 'check') || (name === 'fix')) {
    /**
     * Parsed direct-command region.
     */
    const parsed = tryParseArgv({
      args: rest,
      spec: DIRECT_SPEC,
    },);
    if ((parsed === ARGV_REFUSED) || (parsed.unknownOptions
      .length
      > 0))
      return MANAGEMENT_REFUSED;
    return {
      command: name,
      all: (parsed.flagCounts
        .all
        ?? 0)
        > 0,
      // Deduplicated filter preserving first occurrence order.
      policies: [...new Set(parsed.optionValues
        .policies,),],
      pathspecs: parsed.positionals,
    };
  }
  return MANAGEMENT_REFUSED;
}
