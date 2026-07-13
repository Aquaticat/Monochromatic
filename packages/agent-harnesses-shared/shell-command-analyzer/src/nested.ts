/**
 * Nested shell script extraction for command and process substitutions.
 *
 * @module
 */

import {
  parse,
  type ArithmeticCommandExpansion as UnbashArithmeticCommandExpansion,
  type CommandExpansionPart as UnbashCommandExpansionPart,
  type ProcessSubstitutionPart as UnbashProcessSubstitutionPart,
  type Script as UnbashScript,
} from 'unbash';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ShellCommandContext,
  ShellParseError,
} from './types.ts';
import {
  EMPTY_VISIT_RESULT,
  NO_SCRIPT,
  type ParsedUnbashScript,
  type VisitResult,
} from './internal-types.ts';
import { statementWorkItems, } from './work-items.ts';

//region Logging

/**
 * Logger root for shell-command analyzer.
 */
const parentLogger = tagged({ tag: 'shell-command-analyzer', },);

/**
 * Tagged logger for nested parsing.
 */
const moduleLogger = tagged({
  tag: 'nested',
  l: parentLogger,
},);

//endregion Logging

/**
 * Convert `unbash` parse diagnostics to public diagnostics.
 *
 * @param script - parsed script to inspect
 *
 * @returns parser diagnostics in source order
 *
 * @example
 * ```ts
 * parseErrorsFromScript(script);
 * ```
 */
function parseErrorsFromScript(script: ForeignBorrowed<UnbashScript>,): ShellParseError[] {
  return [
    ...(((script as ParsedUnbashScript).errors) ?? []),
  ]
    .map(function parseError(error,): ShellParseError {
      return {
        message: error.message,
        pos: error.pos,
      };
    },);
}

/**
 * Build synthetic failed parse diagnostics for unexpected parser throws.
 *
 * @returns parse diagnostics containing one generic error
 *
 * @example
 * ```ts
 * failedParseErrors();
 * ```
 */
function failedParseErrors(): ShellParseError[] {
  return [{
    message: 'nested parse failed',
    pos: 0,
  },];
}

/**
 * Resolve nested script from expansion node.
 *
 * @param expansion - expansion containing nested shell source
 *
 * @returns parsed script, parse errors, or sentinel when no source exists
 *
 * @example
 * ```ts
 * scriptFromExpansion(expansion);
 * ```
 */
function scriptFromExpansion(
  expansion:
    | ForeignBorrowed<UnbashArithmeticCommandExpansion>
    | ForeignBorrowed<UnbashCommandExpansionPart>
    | ForeignBorrowed<UnbashProcessSubstitutionPart>,
): {
  readonly script: ParsedUnbashScript;
  readonly parseErrors: readonly ShellParseError[]
} | typeof NO_SCRIPT {
  if (expansion.script !== undefined) {
    return {
      script: expansion.script as ParsedUnbashScript,
      parseErrors: parseErrorsFromScript(expansion.script,),
    };
  }
  if (expansion.inner === undefined)
    return NO_SCRIPT;
  try {
    /**
     * Parsed nested source from expansion.
     */
    const script = parse(expansion.inner,) as ParsedUnbashScript;
    return {
      script,
      parseErrors: parseErrorsFromScript(script,),
    };
  }
  catch (error) {
    /**
     * Sub-logger tagged with helper name so handled parser throws stay traceable.
     */
    const innerLogger = tagged({
      tag: scriptFromExpansion.name,
      l: moduleLogger,
    },);
    innerLogger.debug(`unbash parse threw for nested expansion: ${String(error,)}`,);
    return {
      script: {
        type: 'Script',
        pos: 0,
        end: 0,
        shebang: undefined,
        commands: [],
        errors: failedParseErrors(),
      },
      parseErrors: failedParseErrors(),
    };
  }
}

/**
 * Build script work from command, process, or arithmetic command expansion.
 *
 * @param expansion - expansion node containing nested shell source
 *
 * @param context - execution context inherited by nested commands
 *
 * @returns statement work, feature flags, and nested parse diagnostics
 *
 * @example
 * ```ts
 * visitExpansion({ expansion, context });
 * ```
 */
function visitExpansion(
  {
    expansion,
    context,
  }: {
    readonly expansion:
      | ForeignBorrowed<UnbashArithmeticCommandExpansion>
      | ForeignBorrowed<UnbashCommandExpansionPart>
      | ForeignBorrowed<UnbashProcessSubstitutionPart>;
    readonly context: ShellCommandContext;
  },
): VisitResult {
  /**
   * Parsed nested script, or sentinel when no source is available.
   */
  const nested = scriptFromExpansion(expansion,);
  if (nested === NO_SCRIPT) {
    return {
      ...EMPTY_VISIT_RESULT,
      flags: {
        ...EMPTY_VISIT_RESULT.flags,
        hasCommandSubstitution: expansion.type !== 'ProcessSubstitution',
        hasProcessSubstitution: expansion.type === 'ProcessSubstitution',
      },
    };
  }
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: statementWorkItems({
      statements: nested.script
        .commands,
      context,
    },),
    flags: {
      ...EMPTY_VISIT_RESULT.flags,
      hasCommandSubstitution: expansion.type !== 'ProcessSubstitution',
      hasProcessSubstitution: expansion.type === 'ProcessSubstitution',
    },
    parseErrors: nested.parseErrors,
  };
}

export {
  parseErrorsFromScript,
  visitExpansion,
};
