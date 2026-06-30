/**
 * Conversion from `unbash` command nodes to auto-mode command records.
 *
 * @module
 */

import type {
  AssignmentPrefix as UnbashAssignmentPrefix,
  Command as UnbashCommand,
  Redirect as UnbashRedirect,
  Word as UnbashWord,
} from 'unbash';
import { FILE_REDIRECT_OPERATORS, } from './unbash-command-info-types.ts';
import type {
  CommandInfo,
  EnvAssignment,
} from './types.ts';

/**
 * Convert one simple command node to guardrail command info.
 *
 * Converts the command prefix with {@link assignmentToEnvAssignment}, the
 * suffix with {@link wordToArg}, and the redirects with {@link redirectTargets}.
 *
 * @param command - simple command node
 *
 * @param inheritedRedirects - redirects from wrapping statements
 *
 * @param paramRefs - parameter references pre-scanned from source
 *
 * @returns command info used by bash signals
 *
 * @example
 * ```typescript
 * commandToInfo({ command, inheritedRedirects: [], paramRefs: [] });
 * ```
 */
function commandToInfo(
  {
    command,
    inheritedRedirects,
    paramRefs,
  }: {
    readonly command: UnbashCommand;
    readonly inheritedRedirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
  },
): CommandInfo {
  /**
   * Command redirects plus redirects inherited from a wrapping statement.
   */
  const redirects = [
    ...command.redirects,
    ...inheritedRedirects,
  ];

  return {
    name: command.name
      ?.value
      ?? '',
    envAssignments: command.prefix
      .flatMap(assignmentToEnvAssignment,),
    args: command.suffix
      .flatMap(wordToArg,),
    redirectTargets: redirectTargets(redirects,),
    paramRefs: [...paramRefs,],
  };
}

/**
 * Emit a synthetic command for redirects attached to compound syntax.
 *
 * Computes redirect targets with {@link redirectTargets}.
 *
 * @param redirects - redirects to surface as path signals
 *
 * @param paramRefs - parameter references pre-scanned from source
 *
 * @returns command info carrying redirect targets only
 *
 * @example
 * ```typescript
 * redirectOnlyCommand({ redirects, paramRefs: [] });
 * ```
 */
function redirectOnlyCommand(
  {
    redirects,
    paramRefs,
  }: {
    readonly redirects: readonly UnbashRedirect[];
    readonly paramRefs: readonly string[];
  },
): CommandInfo {
  return {
    name: '',
    envAssignments: [],
    args: [],
    redirectTargets: redirectTargets(redirects,),
    paramRefs: [...paramRefs,],
  };
}

/**
 * Extract redirect targets for path-sensitive operators.
 *
 * Keeps only operators listed in {@link FILE_REDIRECT_OPERATORS}.
 *
 * @param redirects - redirects to inspect
 *
 * @returns target strings for file-like redirects
 *
 * @example
 * ```typescript
 * redirectTargets(redirects);
 * ```
 */
function redirectTargets(
  redirects: readonly UnbashRedirect[],
): string[] {
  return redirects
    .filter(function redirectsToFile(redirect,) {
      return FILE_REDIRECT_OPERATORS.has(redirect.operator,);
    },)
    .flatMap(function targetValue(redirect,) {
      if (redirect.target === undefined)
        return [];
      return [redirect.target
        .value,];
    },);
}

/**
 * Convert one assignment prefix to zero or one environment assignment.
 *
 * Renders the value with {@link assignmentValue}.
 *
 * @param assignment - assignment prefix from `unbash`
 *
 * @returns auto-mode assignment entries
 *
 * @example
 * ```typescript
 * assignmentToEnvAssignment(assignment);
 * ```
 */
function assignmentToEnvAssignment(
  assignment: UnbashAssignmentPrefix,
): EnvAssignment[] {
  if (assignment.name === undefined)
    return [];
  return [{
    name: assignment.name,
    value: assignmentValue(assignment,),
  },];
}

/**
 * Render assignment value text.
 *
 * @param assignment - assignment prefix from `unbash`
 *
 * @returns scalar, array, or empty value text
 *
 * @example
 * ```typescript
 * assignmentValue(assignment);
 * ```
 */
function assignmentValue(
  assignment: UnbashAssignmentPrefix,
): string {
  if (assignment.value !== undefined)
    return assignment.value
      .value;
  if (assignment.array !== undefined) {
    return assignment.array
      .map(function wordValue(word,) {
        return word.value;
      },)
      .join(' ',);
  }
  return '';
}

/**
 * Convert a command suffix word to argument text.
 *
 * @param word - suffix word from `unbash`
 *
 * @returns singleton argument, or empty array for process substitution syntax
 *
 * @example
 * ```typescript
 * wordToArg(word);
 * ```
 */
function wordToArg(
  word: UnbashWord,
): string[] {
  if ((word.parts ?? [])
    .some(function isProcessSubstitution(part,) {
      return part.type === 'ProcessSubstitution';
    },)) {
    return [];
  }
  return [word.value,];
}

export {
  commandToInfo,
  redirectOnlyCommand,
  redirectTargets,
};
