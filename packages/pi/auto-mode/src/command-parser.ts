/**
 * Bash command analysis using `unbash` plus targeted extraction.
 *
 * Uses `unbash` (ISC, v3.0.0) for quote-aware Bash AST parsing while
 * preserving the existing `BashAnalysis` signal shape.
 *
 * @module
 */

import {
  parse,
  type ParseError as UnbashParseError,
  type Script as UnbashScript,
} from 'unbash';
import {
  extractParamRefs,
  looksLikePath,
} from './command-refs.ts';
import { collectCommandInfoFromScript, } from './unbash-command-info.ts';
import type {
  BashAnalysis,
} from './types.ts';

//region Public API

/**
 * Parse a bash command and extract structured signals.
 *
 * On parse failure, returns `parsed: false` with partial
 * results from the pre-scan step.
 *
 * @param cmd - the raw bash command string
 *
 * @returns structured analysis of the command
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand("curl $API_KEY | jq .name > out.txt");
 * // analysis.isPipeline === true
 * ```
 */
function analyzeBashCommand(
  cmd: string,
): BashAnalysis {
  /**
   * Fallback result spread into early returns when `unbash` reports malformed input.
   */
  const empty: BashAnalysis = {
    parsed: false,
    commands: [],
    isPipeline: false,
    allFiles: [],
    allParamRefs: [],
  };

  /**
   * Param references harvested via regex before parsing so the catch-branch still surfaces them.
   */
  const preScanRefs = extractParamRefs(cmd,);

  /**
   * Parsed `unbash` script; `ok` is false when syntax diagnostics or throws occur.
   */
  const parsed = tryParseScript(cmd,);
  if (!parsed.ok) {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }

  /**
   * Command records derived from the `unbash` AST.
   */
  const collection = collectCommandInfoFromScript({
    script: parsed.script,
    paramRefs: preScanRefs,
  },);
  if (collection.hasParseErrors) {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }

  /**
   * Parsed command records in source order.
   */
  const { commands, } = collection;

  /**
   * Union of every path-shaped argument and every redirect target across all commands, in source order.
   */
  const allFiles = commands.flatMap(
    function collectFiles(command,) {
      return [
        ...command.envAssignments
          .map(
            function assignmentValue(assignment,) {
              return assignment.value;
            },
          )
          .filter(
            function assignmentValueLooksLikePath(value,) {
              return looksLikePath(value,);
            },
          ),
        ...command.args
          .filter(
            function argLooksLikePath(arg,) {
              return looksLikePath(arg,);
            },
          ),
        ...command.redirectTargets,
      ];
    },
  );
  /**
   * Deduplicated param references aggregated across all commands; falls back to the pre-scan set below.
   */
  const allParamRefs = [...new Set(
    commands.flatMap(
      function collectRefs(command,) {
        return command.paramRefs;
      },
    ),
  ),];

  if ((allParamRefs.length
    === 0) && (preScanRefs.length
      > 0))
    allParamRefs.push(...preScanRefs,);

  return {
    parsed: true,
    commands,
    isPipeline: collection.isPipeline,
    allFiles,
    allParamRefs,
  };
}

//endregion

//region Internal

/**
 * `unbash` parse result shape with tolerant parser diagnostics attached.
 */
type ParsedUnbashScript = UnbashScript & {
  /**
   * Recoverable parser diagnostics emitted for malformed shell syntax.
   */
  readonly errors?: readonly UnbashParseError[];
};

/**
 * Run `unbash.parse` and convert syntax diagnostics to a discriminated result.
 *
 * `unbash` is tolerant and reports malformed input through `errors` instead
 * of throwing. The guardrail treats either diagnostics or unexpected throws as
 * parse failure so bash signals can conservatively block the command.
 *
 * @param cmd - raw bash command string forwarded to `unbash.parse`
 *
 * @returns `{ ok: true, script }` on success, or `{ ok: false }` on parse failure
 *
 * @example
 * ```typescript
 * const parsed = tryParseScript('echo hi');
 * const script = parsed.ok ? parsed.script : undefined;
 * ```
 */
function tryParseScript(
  cmd: string,
): {
  ok: true;
  script: ParsedUnbashScript;
} | { ok: false } {
  try {
    /**
     * Parsed script with optional tolerant diagnostics.
     */
    const script = parse(cmd,) as ParsedUnbashScript;
    if ((script.errors
      ?.length
      ?? 0) > 0)
      return { ok: false, };
    return {
      ok: true,
      script,
    };
  }
  catch {
    return { ok: false, };
  }
}

//endregion

export { analyzeBashCommand, };
