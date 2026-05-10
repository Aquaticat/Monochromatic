/**
 * Main flagger and bash signal detection.
 *
 * Contains shouldFlag (the main entry point), bashSignals,
 * and the MergedConfig type. Path signals are in path-signals.ts,
 * content/text signals in content-signals.ts, and tool event
 * helpers in tool-helpers.ts.
 *
 * @module
 */

import {
  isToolCallEventType,
  type ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { analyzeBashCommand, } from "./command-parser.ts";
import { looksLikePath, } from "./command-refs.ts";
import type {
  BashAnalysis,
  CommandInfo,
  JudgeModelConfig,
  SignalContext,
} from "./types.ts";
import {
  ENV_DUMP_COMMANDS,
  INTERPRETER_COMMANDS,
  INTERPRETER_INLINE_FLAGS,
  LONG_FLAGS,
  MUTATING_COMMANDS,
  NETWORK_COMMANDS,
  PRIVILEGE_COMMANDS,
  SECRET_VAR_PATTERN,
} from "./constants.ts";
import { pathSignals, } from "./path-signals.ts";
import {
  contentSignals,
  textSignals,
} from "./content-signals.ts";
import {
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
} from "./tool-helpers.ts";

//region Public types

/** A command matcher: either a command name or a command prefix. */
export type CommandMatcher = string | string[];

/**
 * Merged config with compiled patterns.
 *
 * Contains all operational settings needed at runtime,
 * built from global and project config layers.
 */
export type MergedConfig = {
  enabled: boolean;
  commands: CommandMatcher[];
  patterns: RegExp[];
  globalInstructions?: string;
  projectInstructions?: string;
  judgeModel: JudgeModelConfig;
  judgeTimeoutMs: number;
};

//endregion

//region Main entry point

/**
 * Should this tool call be sent to the judge?
 *
 * Returns `true` if any signal fires. No reason is propagated.
 *
 * @param event - the tool call event from pi
 *
 * @param ctx - signal context with cwd and home directory
 *
 * @param config - optional merged config with user patterns
 *
 * @returns `true` if the action should be flagged for judge review
 *
 * @example
 * ```typescript
 * const flagged = shouldFlag(event, { cwd, home });
 * ```
 */
function shouldFlag(
  event: ToolCallEvent,
  ctx: SignalContext,
  config?: MergedConfig,
): boolean {
  if (isToolCallEventType(
    "bash",
    event
  )) {
    const analysis = analyzeBashCommand(event.input.command);
    if (bashSignals(
      analysis,
      ctx,
      config
    )) return true;
    if (textSignals(
      event.input.command,
      config
    )) return true;
    return false;
  }

  const filePath = getFilePath(event);
  if (
    filePath !== undefined &&
    filePath !== "" &&
    pathSignals(
      filePath,
      ctx
    )
  ) {
    return true;
  }

  const text = extractToolText(event);
  if (text !== undefined && text !== "") {
    if (contentSignals(text)) return true;
    if (textSignals(
      text,
      config
    )) return true;
  }

  return false;
}

//endregion

//region Bash signals

/**
 * Check bash command analysis for dangerous patterns.
 *
 * @param analysis - parsed bash command analysis
 *
 * @param ctx - signal context with cwd and home directory
 *
 * @param config - optional merged config with user command matchers
 *
 * @returns `true` if any bash signal fires
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand("sudo rm -rf /");
 * bashSignals(analysis, ctx); // true
 * ```
 */
function bashSignals(
  analysis: BashAnalysis,
  ctx: SignalContext,
  config?: MergedConfig,
): boolean {
  if (!analysis.parsed) return true;

  for (const cmd of analysis.commands) {
    if (PRIVILEGE_COMMANDS.has(cmd.name)) return true;
    if (isMutatingCommand(cmd.name) && hasFlag(
      cmd.args,
      "r",
      "R"
    )) return true;
    if (cmd.name === "rm" && hasFlag(
      cmd.args,
      "f"
    )) return true;
    if (hasRootTarget(cmd)) return true;
    if (cmd.name === "chmod" && cmd.args.includes("777")) return true;
    if (cmd.name === "chmod" && cmd.args.some(
      function hasSetuid(a) {
        return a.includes("u+s") || a.includes("g+s");
      },
    )) return true;

    if (cmd.name === "dd" && cmd.args.some(
      function hasOfEquals(a) { return a.startsWith("of="); },
    )) return true;

    if (cmd.name.startsWith("mkfs")) return true;
    if (ENV_DUMP_COMMANDS.has(cmd.name)) return true;
    if (cmd.name === "export" && cmd.args.includes("-p")) return true;

    if (INTERPRETER_COMMANDS.has(cmd.name) && hasInlineCode(
      cmd.name,
      cmd.args
    )) {
      return true;
    }

    const files = [
      ...cmd.args.filter(looksLikePath),
      ...cmd.redirectTargets
    ];
    for (const f of files) {
      if (pathSignals(
        f,
        ctx
      )) return true;
    }

    if (
      cmd.name === "docker" &&
      (cmd.args.includes("-e") || cmd.args.includes("--env-file"))
    ) return true;
  }

  if (hasNetworkCommand(analysis) && hasSecretParamRefs(analysis)) return true;

  if (
    analysis.isPipeline &&
    hasSensitiveSource(
      analysis,
      ctx
    ) &&
    hasNetworkCommand(analysis)
  ) return true;

  if (analysis.isPipeline && analysis.commands.some(
    function isEnvDump(c) { return ENV_DUMP_COMMANDS.has(c.name); },
  )) return true;

  if (config?.commands && matchUserCommands(
    analysis,
    config.commands
  )) {
    return true;
  }

  return false;
}

//endregion

//region Scope and dataflow helpers

/** Check if a command name is a mutating command.
 *
 * @param name - the command name
 *
 * @returns `true` if the command is a mutating command
 */
function isMutatingCommand(
  name: string,
): boolean {
  return MUTATING_COMMANDS.has(name);
}

/**
 * Check if any of the given flags are present in the argument list.
 *
 * Handles `--` end-of-options separator correctly.
 *
 * @param args - the argument list
 *
 * @param flags - the flag characters to check (without `-` prefix)
 *
 * @returns `true` if any of the flags are found
 *
 * @example
 * ```typescript
 * hasFlag(["-rf"], "r", "f"); // true
 * hasFlag(["--", "-f"], "f"); // false
 * ```
 */
function hasFlag(
  args: string[],
  ...flags: string[]
): boolean {
  let pastEndOfOptions = false;
  return args.some(
    function checkArg(a) {
      if (pastEndOfOptions) return false;
      if (a === "--") {
        pastEndOfOptions = true;
        return false;
      }
      if (!a.startsWith("-")) return false;
      if (a.startsWith("--")) {
        return flags.some(
          function matchLongFlag(f) {
            return a === `--${LONG_FLAGS[f] ?? f}`;
          },
        );
      }
      return flags.some(
        function matchShortFlag(f) { return a.includes(f); },
      );
    },
  );
}

/** Check if any target in the command is the root directory.
 *
 * @param cmd - command info with args and redirect targets
 *
 * @returns `true` if a root target is found
 */
function hasRootTarget(
  cmd: Pick<CommandInfo, "args" | "redirectTargets">,
): boolean {
  const allTargets = [
    ...cmd.args,
    ...cmd.redirectTargets
  ];
  return allTargets.some(
    function isRootPath(a) { return a === "/" || a === "/*"; },
  );
}

/** Check if a command has inline code.
 *
 * @param name - the command name
 *
 * @param args - the argument list
 *
 * @returns `true` if the command has inline code
 */
function hasInlineCode(
  name: string,
  args: string[],
): boolean {
  const flags = INTERPRETER_INLINE_FLAGS[name];
  if (flags === undefined) return false;
  if (flags.length === 0) return true;
  return flags.some(
    function flagPresent(f) { return args.includes(f); },
  );
}

/** Check if the analysis contains any network commands.
 *
 * @param analysis - parsed bash command analysis
 *
 * @returns `true` if any network command is found
 */
function hasNetworkCommand(
  analysis: BashAnalysis,
): boolean {
  return analysis.commands.some(
    function isNetworkCmd(c) { return NETWORK_COMMANDS.has(c.name); },
  );
}

/** Check if the analysis contains secret variable references.
 *
 * @param analysis - parsed bash command analysis
 *
 * @returns `true` if any secret variable reference is found
 */
function hasSecretParamRefs(
  analysis: BashAnalysis,
): boolean {
  return analysis.allParamRefs.some(
    function isSecretRef(ref) { return SECRET_VAR_PATTERN.test(ref); },
  );
}

/** Check if the analysis contains sensitive source files.
 *
 * @param analysis - parsed bash command analysis
 *
 * @param ctx - signal context for path checks
 *
 * @returns `true` if any sensitive source is found
 */
function hasSensitiveSource(
  analysis: BashAnalysis,
  ctx: SignalContext,
): boolean {
  return analysis.allFiles.some(
    function isSensitivePath(f) { return pathSignals(
      f,
      ctx
    ); },
  );
}

//endregion

//region User command matching

/**
 * Check if any command matches user-configured matchers.
 *
 * @param analysis - parsed bash command analysis
 *
 * @param matchers - user-configured command matchers
 *
 * @returns `true` if any command matches
 *
 * @example
 * ```typescript
 * matchUserCommands(analysis, ["terraform"]);
 * matchUserCommands(analysis, [["docker", "compose"]]);
 * ```
 */
function matchUserCommands(
  analysis: BashAnalysis,
  matchers: CommandMatcher[],
): boolean {
  for (const cmd of analysis.commands) {
    for (const matcher of matchers) {
      if (typeof matcher === "string") {
        if (cmd.name === matcher) return true;
      }
      else {
        if (cmd.name !== matcher[0]) continue;
        const prefix = matcher.slice(1);
        if (prefix.every(
          function argMatches(
            sub,
            i
          ) { return cmd.args[i] === sub; },
        )) return true;
      }
    }
  }
  return false;
}

//endregion

export {
  bashSignals,
  hasFlag,
  matchUserCommands,
  shouldFlag,
};
