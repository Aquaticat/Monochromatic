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

  /** Tokens emitted by `shell-quote` for the command; `ok` is false when the parse threw. */
  const parsed = tryParseEntries(cmd,);
  if (!parsed.ok) {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }
  /** Successfully-parsed token stream from `shell-quote`, walked below. */
  const { entries, } = parsed;

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

  /** Flush the current-command accumulators into `commands`; no-op when nothing is pending. */
  function flushInto(): void {
    /** Discriminated flush result for the tokens accumulated since the last boundary. */
    const result = flushCurrentCommand({
      args: currentArgs,
      redirectTargets: currentRedirectTargets,
      paramRefs: preScanRefs,
    },);
    if (result.flushed)
      commands.push(result.command,);
  }

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
      flushInto();
      currentArgs = [];
      currentRedirectTargets = [];
      nextIsRedirectTarget = false;
      continue;
    }

    if ((op === '&&') || (op === '||')
      || (op === ';')
      || (op === '&')) {
      flushInto();
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
        flushInto();
        currentArgs = [];
        currentRedirectTargets = [];
        nextIsRedirectTarget = false;
      }
      continue;
    }
  }

  flushInto();

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
 * Build a `CommandInfo` from accumulated tokens.
 *
 * Returns a discriminated result rather than pushing into a passed array,
 * so callers own the accumulator and this stays free of param mutation.
 *
 * @returns `{ flushed: true, command }` for a non-empty command, or
 *   `{ flushed: false }` when there are no tokens to flush
 *
 * @example
 * ```typescript
 * flushCurrentCommand({
 *   args: ['curl', 'https://api.example.com'],
 *   redirectTargets: ['out.txt'],
 *   paramRefs: ['API_KEY'],
 * });
 * ```
 */
function flushCurrentCommand(
  {
    args,
    redirectTargets,
    paramRefs,
  }: {
    readonly args: readonly string[];
    readonly redirectTargets: readonly string[];
    readonly paramRefs: readonly string[];
  },
): {
  flushed: true;
  command: CommandInfo;
} | { flushed: false } {
  if ((args.length
    === 0) && (redirectTargets.length
      === 0))
    return { flushed: false, };

  /** Command name (first word, empty string on redirect-only commands) plus its remaining word arguments. */
  const [name = '', ...cmdArgs] = args;

  return {
    flushed: true,
    command: {
      name,
      args: cmdArgs,
      redirectTargets,
      paramRefs: [...paramRefs,],
    },
  };
}

/**
 * Run `shell-quote.parse` and convert throws to a discriminated result.
 *
 * Pulled out of {@link analyzeBashCommand} so the caller can branch on the
 * `ok` discriminant without holding an empty `let entries` at function root.
 *
 * @param cmd - raw bash command string forwarded to `shell-quote.parse`
 *
 * @returns `{ ok: true, entries }` on success, or `{ ok: false }` when the
 *   parser threw
 *
 * @example
 * ```typescript
 * const parsed = tryParseEntries('echo hi');
 * const entries = parsed.ok ? parsed.entries : [];
 * ```
 */
function tryParseEntries(
  cmd: string,
): {
  ok: true;
  entries: ParseEntry[];
} | { ok: false } {
  try {
    return {
      ok: true,
      entries: parse(cmd,),
    };
  }
  catch {
    return { ok: false, };
  }
}

//endregion

export { analyzeBashCommand, };
