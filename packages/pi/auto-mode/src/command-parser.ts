/**
 * Bash command analysis using `shell-quote` + targeted extraction.
 *
 * Replaces `@aliou/sh` (UNLICENSED, 3 silent gap bugs) with
 * `shell-quote` (MIT, v1.8.3) for quote-aware token splitting.
 *
 * @module
 */

import {
  parse,
  type ParseEntry,
} from 'shell-quote';
import {
  extractParamRefs,
  looksLikePath,
} from './command-refs.ts';
import type {
  BashAnalysis,
  CommandInfo,
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
  /** Fallback result spread into the early-return when `shell-quote` throws on malformed input. */
  const empty: BashAnalysis = {
    parsed: false,
    commands: [],
    isPipeline: false,
    allFiles: [],
    allParamRefs: [],
  };

  /** Param references harvested via regex before parsing so the catch-branch still surfaces them. */
  const preScanRefs = extractParamRefs(cmd,);

  /**
   * Tokens emitted by `shell-quote` for the command.
   *
   * Declared with `let` so the catch branch can leave it empty without
   * needing a separate flag; reassigned inside `try` on successful parse.
   */
  let entries: ParseEntry[] = [];
  try {
    entries = parse(cmd,);
  }
  catch {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }

  /** Accumulator for parsed `CommandInfo` entries; one push per `|`, `&&`, `||`, `;`, `&`, or `;;` boundary. */
  const commands: CommandInfo[] = [];
  /** True once a `|` operator has been seen anywhere in the command; surfaced verbatim on the return. */
  let isPipeline = false;
  /** Word tokens belonging to the command currently being assembled; reset at every command boundary. */
  let currentArgs: string[] = [];
  /** Paths recorded after `>`, `>>`, `<`, `>&`, or `|&` for the current command; reset at every boundary. */
  let currentRedirectTargets: string[] = [];
  /** True for one tick after a redirect operator so the very next string token is captured as the target path. */
  let nextIsRedirectTarget = false;

  for (const entry of entries) {
    if (typeof entry === 'string') {
      if (nextIsRedirectTarget) {
        currentRedirectTargets.push(entry,);
        nextIsRedirectTarget = false;
        continue;
      }
      currentArgs.push(entry,);
      continue;
    }

    if (!('op' in entry))
      continue;
    /** Operator string from the non-word `shell-quote` entry; dispatched on by the branches below. */
    const { op, } = entry;

    if (
      op === '>'
      || op === '>>'
      || op === '<'
      || op === '>&'
      || op === '|&'
    ) {
      nextIsRedirectTarget = true;
      continue;
    }

    if (op === '|') {
      isPipeline = true;
      flushCurrentCommand(
        commands,
        currentArgs,
        currentRedirectTargets,
        preScanRefs,
      );
      currentArgs = [];
      currentRedirectTargets = [];
      nextIsRedirectTarget = false;
      continue;
    }

    if (op === '&&' || op === '||' || op === ';' || op === '&') {
      flushCurrentCommand(
        commands,
        currentArgs,
        currentRedirectTargets,
        preScanRefs,
      );
      currentArgs = [];
      currentRedirectTargets = [];
      nextIsRedirectTarget = false;
      continue;
    }

    if (op === '<(') {
      /* Process substitution: shell-quote emits the inner command as
         a separate `<(...)` op token. We intentionally skip pushing
         it to `currentRedirectTargets` because that field is for file
         path matching, and process substitution is not a file. The
         operand is also dropped from the parent command's args; if a
         future signal needs to flag process substitution as
         suspicious, surface it via a separate field on CommandInfo
         rather than encoding it as a literal filename string. */
      continue;
    }

    if (op === '(' || op === ')' || op === ';;') {
      if (op === ';;') {
        flushCurrentCommand(
          commands,
          currentArgs,
          currentRedirectTargets,
          preScanRefs,
        );
        currentArgs = [];
        currentRedirectTargets = [];
        nextIsRedirectTarget = false;
      }
      continue;
    }
  }

  flushCurrentCommand(
    commands,
    currentArgs,
    currentRedirectTargets,
    preScanRefs,
  );

  /** Union of every path-shaped argument and every redirect target across all commands, in source order. */
  const allFiles = commands.flatMap(
    function collectFiles(c,) {
      return [
        ...c.args.filter(looksLikePath,),
        ...c.redirectTargets,
      ];
    },
  );
  /** Deduplicated param references aggregated across all commands; falls back to the pre-scan set below. */
  const allParamRefs = [...new Set(
    commands.flatMap(
      function collectRefs(c,) {
        return c.paramRefs;
      },
    ),
  ),];

  if (allParamRefs.length === 0 && preScanRefs.length > 0)
    allParamRefs.push(...preScanRefs,);

  return {
    parsed: true,
    commands,
    isPipeline,
    allFiles,
    allParamRefs,
  };
}

//endregion

//region Internal

/**
 * Flush accumulated tokens into a `CommandInfo`.
 *
 * @param commands - the output array to push into
 *
 * @param args - accumulated word tokens for this command
 *
 * @param redirectTargets - accumulated redirect target paths
 *
 * @param paramRefs - pre-scanned variable references
 */
function flushCurrentCommand(
  commands: CommandInfo[],
  args: string[],
  redirectTargets: string[],
  paramRefs: string[],
): void {
  if (args.length === 0 && redirectTargets.length === 0)
    return;

  /** Command name (first word, empty string on redirect-only commands) plus its remaining word arguments. */
  const [name = '', ...cmdArgs] = args;

  commands.push({
    name,
    args: cmdArgs,
    redirectTargets,
    paramRefs: [...paramRefs,],
  },);
}

//endregion

export { analyzeBashCommand, };
