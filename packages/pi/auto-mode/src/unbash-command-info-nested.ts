/**
 * Nested shell script extraction for `unbash` command-info traversal.
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
import { statementWorkItems, } from './unbash-command-info-items.ts';
import {
  EMPTY_VISIT_RESULT,
  NO_SCRIPT,
  type ParsedUnbashScript,
  type VisitResult,
} from './unbash-command-info-types.ts';

/**
 * Build script work from command, process, or arithmetic command expansion.
 *
 * Resolves the nested script with {@link scriptFromExpansion}, builds work
 * with {@link statementWorkItems}, and checks diagnostics with
 * {@link scriptHasErrors}.
 *
 * @param expansion - expansion containing nested shell source
 *
 * @returns statement work and nested parse diagnostics
 *
 * @example
 * ```typescript
 * visitExpansion(expansion);
 * ```
 */
function visitExpansion(
  expansion:
    | UnbashArithmeticCommandExpansion
    | UnbashCommandExpansionPart
    | UnbashProcessSubstitutionPart,
): VisitResult {
  /**
   * Parsed nested script, or sentinel when no source is available.
   */
  const script = scriptFromExpansion(expansion,);
  if (script === NO_SCRIPT)
    return EMPTY_VISIT_RESULT;
  return {
    ...EMPTY_VISIT_RESULT,
    workItems: statementWorkItems(script.commands,),
    hasParseErrors: scriptHasErrors(script,),
  };
}

/**
 * Resolve nested script from an expansion node.
 *
 * Falls back to {@link failedNestedScript} when `unbash.parse` throws.
 *
 * @param expansion - expansion containing nested shell source
 *
 * @returns parsed script or sentinel
 *
 * @example
 * ```typescript
 * scriptFromExpansion(expansion);
 * ```
 */
function scriptFromExpansion(
  expansion:
    | UnbashArithmeticCommandExpansion
    | UnbashCommandExpansionPart
    | UnbashProcessSubstitutionPart,
): ParsedUnbashScript | typeof NO_SCRIPT {
  if (expansion.script !== undefined)
    return expansion.script as ParsedUnbashScript;
  if (expansion.inner === undefined)
    return NO_SCRIPT;
  try {
    return parse(expansion.inner,) as ParsedUnbashScript;
  }
  catch {
    return failedNestedScript();
  }
}

/**
 * Build synthetic failed parse result for unexpected nested parser throws.
 *
 * @returns parse result containing one diagnostic
 *
 * @example
 * ```typescript
 * failedNestedScript();
 * ```
 */
function failedNestedScript(): ParsedUnbashScript {
  return {
    type: 'Script',
    pos: 0,
    end: 0,
    shebang: undefined,
    commands: [],
    errors: [{
      message: 'nested parse failed',
      pos: 0,
    },],
  };
}

/**
 * Check for tolerant parse diagnostics on a script.
 *
 * @param script - script to inspect
 *
 * @returns whether parse diagnostics are present
 *
 * @example
 * ```typescript
 * scriptHasErrors(script);
 * ```
 */
function scriptHasErrors(
  script: UnbashScript,
): boolean {
  return (((script as ParsedUnbashScript).errors
    ?.length
    ?? 0) > 0);
}

export {
  scriptHasErrors,
  visitExpansion,
};
