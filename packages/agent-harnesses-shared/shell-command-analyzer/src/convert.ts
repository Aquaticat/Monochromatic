/**
 * Convert `unbash` nodes to public analyzer command records.
 *
 * @module
 */

import type {
  AssignmentPrefix as UnbashAssignmentPrefix,
  Command as UnbashCommand,
  Redirect as UnbashRedirect,
  RedirectOperator as UnbashRedirectOperator,
  Word as UnbashWord,
} from 'unbash';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';
import type {
  ShellCommandContext,
  ShellCommandInfo,
  ShellEnvAssignment,
  ShellRedirect,
  ShellRedirectKind,
} from './types.ts';

//region Redirect conversion

/**
 * Operators that write output to file-like targets.
 */
const WRITE_FILE_OPERATORS: ReadonlySet<UnbashRedirectOperator> = new Set([
  '>',
  '>>',
  '<>',
  '>|',
  '&>',
  '&>>',
],);

/**
 * Operators that read input from file-like targets.
 */
const READ_FILE_OPERATORS: ReadonlySet<UnbashRedirectOperator> = new Set([
  '<',
  '<>',
],);

/**
 * Operators whose target can be a file descriptor when numeric.
 */
const DESCRIPTOR_OPERATORS: ReadonlySet<UnbashRedirectOperator> = new Set([
  '<&',
  '>&',
],);

/**
 * Operators that carry heredoc or here-string bodies.
 */
const HEREDOC_OPERATORS: ReadonlySet<UnbashRedirectOperator> = new Set([
  '<<',
  '<<-',
  '<<<',
],);

/**
 * Whether target text names a numeric file descriptor.
 *
 * @param target - redirect target text
 *
 * @returns whether target is composed only of decimal digits
 *
 * @example
 * ```ts
 * isNumericDescriptor('2');
 * ```
 */
function isNumericDescriptor(target: string,): boolean {
  if (target.length === 0)
    return false;
  for (const c of target) {
    if ((c < '0') || (c > '9'))
      return false;
  }
  return true;
}

/**
 * Classify redirect target kind.
 *
 * @param operator - redirect operator
 *
 * @param target - redirect target text, when present
 *
 * @returns redirect kind used by callers
 *
 * @example
 * ```ts
 * redirectKind({ operator: '>&', target: '1' });
 * ```
 */
function redirectKind(
  {
    operator,
    target,
  }: {
    readonly operator: UnbashRedirectOperator;
    readonly target?: string;
  },
): ShellRedirectKind {
  if ((operator === '<<') || (operator === '<<-'))
    return 'heredoc';
  if (operator === '<<<')
    return 'hereString';
  if (DESCRIPTOR_OPERATORS.has(operator,) && (target !== undefined)
    && isNumericDescriptor(target,))
    return 'fileDescriptor';
  return 'file';
}

/**
 * Whether redirect writes to a file-like target.
 *
 * @param operator - redirect operator
 *
 * @param kind - redirect target classification
 *
 * @returns whether redirect writes file content
 *
 * @example
 * ```ts
 * redirectWritesFile({ operator: '>', kind: 'file' });
 * ```
 */
function redirectWritesFile(
  {
    operator,
    kind,
  }: {
    readonly operator: UnbashRedirectOperator;
    readonly kind: ShellRedirectKind;
  },
): boolean {
  if (kind !== 'file')
    return false;
  return WRITE_FILE_OPERATORS.has(operator,)
    || (operator === '>&');
}

/**
 * Whether redirect reads from a file-like target.
 *
 * @param operator - redirect operator
 *
 * @param kind - redirect target classification
 *
 * @returns whether redirect reads file content
 *
 * @example
 * ```ts
 * redirectReadsFile({ operator: '<', kind: 'file' });
 * ```
 */
function redirectReadsFile(
  {
    operator,
    kind,
  }: {
    readonly operator: UnbashRedirectOperator;
    readonly kind: ShellRedirectKind;
  },
): boolean {
  if (kind !== 'file')
    return false;
  return READ_FILE_OPERATORS.has(operator,)
    || (operator === '<&');
}

/**
 * Convert one `unbash` redirect to public redirect record.
 *
 * @param redirect - parsed redirect node
 *
 * @returns public redirect record
 *
 * @example
 * ```ts
 * redirectToInfo(redirect);
 * ```
 */
function redirectToInfo(redirect: ForeignBorrowed<UnbashRedirect>,): ShellRedirect {
  /**
   * Parsed target text, when `unbash` produced one.
   */
  const target = redirect.target
    ?.value;
  /**
   * Target classification.
   */
  const kind = redirectKind({
    operator: redirect.operator,
    ...(target === undefined ? {} : { target, }),
  },);

  return {
    operator: redirect.operator,
    ...(target === undefined ? {} : { target, }),
    ...(redirect.fileDescriptor === undefined ? {} : { fileDescriptor: redirect.fileDescriptor, }),
    kind,
    writesFile: redirectWritesFile({
      operator: redirect.operator,
      kind,
    },),
    readsFile: redirectReadsFile({
      operator: redirect.operator,
      kind,
    },),
  };
}

/**
 * Extract file-like redirect targets.
 *
 * @param redirects - public redirect records
 *
 * @returns target text for file redirects only
 *
 * @example
 * ```ts
 * redirectTargets([redirect]);
 * ```
 */
function redirectTargets(redirects: readonly ShellRedirect[],): string[] {
  return redirects.flatMap(function targetForRedirect(redirect,): string[] {
    if (redirect.kind !== 'file')
      return [];
    if (redirect.target === undefined)
      return [];
    return [redirect.target,];
  },);
}

//endregion Redirect conversion

//region Command conversion

/**
 * Convert word to argument, excluding process substitution placeholders.
 *
 * @param word - suffix word from `unbash`
 *
 * @returns singleton argument, or empty array for process substitution syntax
 *
 * @example
 * ```ts
 * wordToArg(word);
 * ```
 */
function wordToArg(word: ForeignBorrowed<UnbashWord>,): string[] {
  if ((word.parts ?? [])
    .some(function isProcessSubstitution(
      part: ForeignBorrowed<NonNullable<UnbashWord['parts']>[number]>,
    ): boolean {
      return part.type === 'ProcessSubstitution';
    },)) {
    return [];
  }
  return [word.value,];
}

/**
 * Render assignment value text.
 *
 * @param assignment - assignment prefix from `unbash`
 *
 * @returns scalar, array, or empty value text
 *
 * @example
 * ```ts
 * assignmentValue(assignment);
 * ```
 */
function assignmentValue(assignment: ForeignBorrowed<UnbashAssignmentPrefix>,): string {
  if (assignment.value !== undefined)
    return assignment.value
      .value;
  if (assignment.array !== undefined) {
    return assignment.array
      .map(function wordValue(word: ForeignBorrowed<UnbashWord>,): string {
        return word.value;
      },)
      .join(' ',);
  }
  return '';
}

/**
 * Convert one assignment prefix to zero or one environment assignment.
 *
 * @param assignment - assignment prefix from `unbash`
 *
 * @returns analyzer assignment entries
 *
 * @example
 * ```ts
 * assignmentToEnvAssignment(assignment);
 * ```
 */
function assignmentToEnvAssignment(assignment: ForeignBorrowed<UnbashAssignmentPrefix>,): ShellEnvAssignment[] {
  if (assignment.name === undefined)
    return [];
  return [{
    name: assignment.name,
    value: assignmentValue(assignment,),
  },];
}

/**
 * Convert one simple command node to analyzer command info.
 *
 * @param command - simple command node to convert
 *
 * @param inheritedRedirects - redirects inherited from wrapping statements
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @param context - execution context inherited by command
 *
 * @returns command info used by guardrail signal checks
 *
 * @example
 * ```ts
 * commandToInfo({ command, inheritedRedirects: [], paramRefs: [], context });
 * ```
 */
function commandToInfo(
  {
    command,
    inheritedRedirects,
    paramRefs,
    context,
  }: {
    readonly command: ForeignBorrowed<UnbashCommand>;
    readonly inheritedRedirects: readonly ForeignBorrowed<UnbashRedirect>[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): ShellCommandInfo {
  /**
   * Converted redirects from command and surrounding statement.
   */
  const redirects = [
    ...command.redirects,
    ...inheritedRedirects,
  ]
    .map(function mapRedirectToInfo(
      redirect: ForeignBorrowed<UnbashRedirect>,
    ): ShellRedirect {
      return redirectToInfo(redirect,);
    },);

  return {
    name: command.name
      ?.value
      ?? '',
    envAssignments: command.prefix
      .flatMap(assignmentToEnvAssignment,),
    args: command.suffix
      .flatMap(wordToArg,),
    redirects,
    redirectTargets: redirectTargets(redirects,),
    paramRefs: [...paramRefs,],
    context,
  };
}

/**
 * Emit synthetic command for redirects attached to compound syntax.
 *
 * @param redirects - redirects attached to compound syntax
 *
 * @param paramRefs - parameter references pre-scanned from raw source text
 *
 * @param context - execution context inherited by redirect command
 *
 * @returns command info carrying redirect targets only
 *
 * @example
 * ```ts
 * redirectOnlyCommand({ redirects, paramRefs: [], context });
 * ```
 */
function redirectOnlyCommand(
  {
    redirects,
    paramRefs,
    context,
  }: {
    readonly redirects: readonly ForeignBorrowed<UnbashRedirect>[];
    readonly paramRefs: readonly string[];
    readonly context: ShellCommandContext;
  },
): ShellCommandInfo {
  /**
   * Converted redirects from compound syntax.
   */
  const convertedRedirects = redirects.map(function mapRedirectToInfo(redirect,): ShellRedirect {
    return redirectToInfo(redirect,);
  },);
  return {
    name: '',
    envAssignments: [],
    args: [],
    redirects: convertedRedirects,
    redirectTargets: redirectTargets(convertedRedirects,),
    paramRefs: [...paramRefs,],
    context,
  };
}

//endregion Command conversion

export {
  commandToInfo,
  HEREDOC_OPERATORS,
  redirectOnlyCommand,
};
