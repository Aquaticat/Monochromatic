/**
 * Bash command analysis using `shell-quote` + targeted extraction.
 *
 * Replaces `@aliou/sh` (UNLICENSED, 3 silent gap bugs) with
 * `shell-quote` (MIT, v1.8.3) for quote-aware token splitting.
 *
 * @module
 */

import {
  type ParseEntry,
  parse,
} from "shell-quote";
import type {
  BashAnalysis,
  CommandInfo,
} from "./types.ts";
import {
  extractParamRefs,
  looksLikePath,
} from "./command-refs.ts";

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
  const empty: BashAnalysis = {
    parsed: false,
    commands: [],
    isPipeline: false,
    allFiles: [],
    allParamRefs: [],
  };

  const preScanRefs = extractParamRefs(cmd);

  let entries: ParseEntry[] = [];
  try {
    entries = parse(cmd);
  }
  catch {
    return {
      ...empty,
      allParamRefs: preScanRefs,
    };
  }

  const commands: CommandInfo[] = [];
  let isPipeline = false;
  let currentArgs: string[] = [];
  let currentRedirectTargets: string[] = [];
  let nextIsRedirectTarget = false;

  for (const entry of entries) {
    if (typeof entry === "string") {
      if (nextIsRedirectTarget) {
        currentRedirectTargets.push(entry);
        nextIsRedirectTarget = false;
        continue;
      }
      currentArgs.push(entry);
      continue;
    }

    if (!("op" in entry)) continue;
    const {op} = entry;

    if (
      op === ">" ||
      op === ">>" ||
      op === "<" ||
      op === ">&" ||
      op === "|&"
    ) {
      nextIsRedirectTarget = true;
      continue;
    }

    if (op === "|") {
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

    if (op === "&&" || op === "||" || op === ";" || op === "&") {
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

    if (op === "<(") {
      currentRedirectTargets.push("$()");
      continue;
    }

    if (op === "(" || op === ")" || op === ";;") {
      if (op === ";;") {
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

  const allFiles = commands.flatMap(
    function collectFiles(c) {
      return [
        ...c.args.filter(looksLikePath),
        ...c.redirectTargets
      ];
    },
  );
  const allParamRefs = [...new Set(
    commands.flatMap(
      function collectRefs(c) { return c.paramRefs; },
    ),
  )];

  if (allParamRefs.length === 0 && preScanRefs.length > 0) {
    allParamRefs.push(...preScanRefs);
  }

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
  if (args.length === 0 && redirectTargets.length === 0) return;

  const [name = "", ...cmdArgs] = args;

  commands.push({
    name,
    args: cmdArgs,
    redirectTargets,
    paramRefs: [...paramRefs],
  });
}

//endregion

export { analyzeBashCommand, };
