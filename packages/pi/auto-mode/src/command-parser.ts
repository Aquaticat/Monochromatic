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

  /** Tokens emitted by `shell-quote` for the command; `null` when the parse threw. */
  const entries = tryParseEntries(cmd,);
  if (entries === null) {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }

  /** Accumulator for parsed `CommandInfo` entries; one push per `|`, `&&`, `||`, `;`, `&`, or `;;` boundary. */
  const commands: CommandInfo[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- sequential parser state mutated across loop iterations (isPipeline latch, current-command accumulators, redirect-target latch) */
  /** True once a `|` operator has been seen anywhere in the command; surfaced verbatim on the return. */
  let isPipeline = false;
  /** Word tokens belonging to the command currently being assembled; reset at every command boundary. */
  let currentArgs: string[] = [];
  /** Paths recorded after `>`, `>>`, `<`, `>&`, or `|&` for the current command; reset at every boundary. */
  let currentRedirectTargets: string[] = [];
  /** True for one tick after a redirect operator so the very next string token is captured as the target path. */
  let nextIsRedirectTarget = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (const entry of entries) {
    if ((typeof entry) === 'string') {
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
      (op === '>')
      || (op === '>>')
        || (op === '<')
        || (op === '>&')
        || (op === '|&')
    ) {
      nextIsRedirectTarget = true;
      continue;
    }

    if (op === '|') {
      isPipeline = true;
      flushCurrentCommand({
        commands,
        args: currentArgs,
        redirectTargets: currentRedirectTargets,
        paramRefs: preScanRefs,
      },);
      currentArgs = [];
      currentRedirectTargets = [];
      nextIsRedirectTarget = false;
      continue;
    }

    if ((op === '&&') || (op === '||')
      || (op === ';')
      || (op === '&')) {
      flushCurrentCommand({
        commands,
        args: currentArgs,
        redirectTargets: currentRedirectTargets,
        paramRefs: preScanRefs,
      },);
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

    if ((op === '(') || (op === ')')
      || (op === ';;')) {
      if (op === ';;') {
        flushCurrentCommand({
          commands,
          args: currentArgs,
          redirectTargets: currentRedirectTargets,
          paramRefs: preScanRefs,
        },);
        currentArgs = [];
        currentRedirectTargets = [];
        nextIsRedirectTarget = false;
      }
      continue;
    }
  }

  flushCurrentCommand({
    commands,
    args: currentArgs,
    redirectTargets: currentRedirectTargets,
    paramRefs: preScanRefs,
  },);

  /** Union of every path-shaped argument and every redirect target across all commands, in source order. */
  const allFiles = commands.flatMap(
    function collectFiles(c,) {
      return [
        ...c.args
          .filter(looksLikePath,),
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

  if ((allParamRefs.length
    === 0) && (preScanRefs.length
      > 0))
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
 * @example
 * ```typescript
 * flushCurrentCommand({
 *   commands: cmdAcc,
 *   args: ['curl', 'https://api.example.com'],
 *   redirectTargets: ['out.txt'],
 *   paramRefs: ['API_KEY'],
 * });
 * ```
 */
function flushCurrentCommand(
  {
    commands,
    args,
    redirectTargets,
    paramRefs,
  }: {
    commands: CommandInfo[];
    args: string[];
    redirectTargets: string[];
    paramRefs: string[];
  },
): void {
  if ((args.length
    === 0) && (redirectTargets.length
      === 0))
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

/**
 * Run `shell-quote.parse` and convert throws to `null`.
 *
 * Pulled out of {@link analyzeBashCommand} so the caller can branch on the
 * sentinel without holding an empty `let entries` at function root.
 *
 * @param cmd - raw bash command string forwarded to `shell-quote.parse`
 *
 * @returns the parsed entries, or `null` when the parser threw
 *
 * @example
 * ```typescript
 * const entries = tryParseEntries('echo hi') ?? [];
 * ```
 */
function tryParseEntries(
  cmd: string,
): ParseEntry[] | null {
  try {
    return parse(cmd,);
  }
  catch {
    return null;
  }
}

//endregion

export { analyzeBashCommand, };
