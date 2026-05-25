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
} from '@earendil-works/pi-coding-agent';
import {
  hasFlag,
  hasInlineCode,
  hasNetworkCommand,
  hasRootTarget,
  hasSecretParamRefs,
  hasSensitiveSource,
  isMutatingCommand,
} from './bash-helpers.ts';
import { analyzeBashCommand, } from './command-parser.ts';
import { looksLikePath, } from './command-refs.ts';
import {
  ENV_DUMP_COMMANDS,
  INTERPRETER_COMMANDS,
  PRIVILEGE_COMMANDS,
} from './constants.ts';
import {
  contentSignals,
  textSignals,
} from './content-signals.ts';
import { pathSignals, } from './path-signals.ts';
import {
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
} from './tool-helpers.ts';
import type {
  BashAnalysis,
  JudgeModelConfig,
  SignalContext,
} from './types.ts';

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
 * @returns `true` if the action should be flagged for judge review
 *
 * @example
 * ```typescript
 * const flagged = shouldFlag({ event, ctx: { cwd, home } });
 * ```
 */
function shouldFlag(
  {
    event,
    ctx,
    config,
  }: {
    event: ToolCallEvent;
    ctx: SignalContext;
    config?: MergedConfig;
  },
): boolean {
  if (isToolCallEventType(
    'bash',
    event,
  )) {
    /** Parsed bash AST used to walk individual commands and their redirect targets. */
    const analysis = analyzeBashCommand(event.input
      .command,);
    if (bashSignals({
      analysis,
      ctx,
      ...(config !== undefined ? { config, } : {}),
    },)) {
      return true;
    }
    if (textSignals({
      text: event.input
        .command,
      ...(config !== undefined ? { config, } : {}),
    },)) {
      return true;
    }
    return false;
  }

  /** Path argument extracted from the tool event when one applies (read/write/edit/etc.). */
  const filePath = getFilePath(event,);
  if (
    (filePath !== undefined)
    && (filePath !== '')
      && pathSignals({
      filePath,
      ctx,
    },)
  ) {
    return true;
  }

  /** Free text extracted from the tool event (file body, search query) for content/text signals. */
  const text = extractToolText(event,);
  if ((text !== undefined) && (text !== '')) {
    if (contentSignals(text,))
      return true;
    if (textSignals({
      text,
      ...(config !== undefined ? { config, } : {}),
    },)) {
      return true;
    }
  }

  return false;
}

//endregion

//region Bash signals

/**
 * Check bash command analysis for dangerous patterns.
 *
 * @returns `true` if any bash signal fires
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand("sudo rm -rf /");
 * bashSignals({ analysis, ctx }); // true
 * ```
 */
function bashSignals(
  {
    analysis,
    ctx,
    config,
  }: {
    analysis: BashAnalysis;
    ctx: SignalContext;
    config?: MergedConfig;
  },
): boolean {
  if (!analysis.parsed)
    return true;

  for (const cmd of analysis.commands) {
    if (PRIVILEGE_COMMANDS.has(cmd.name,))
      return true;
    if (isMutatingCommand(cmd.name,)
      && hasFlag({
      args: cmd.args,
      flags: [
        'r',
        'R',
      ],
    },)) {
      return true;
    }
    if ((cmd.name
      === 'rm') && hasFlag({
      args: cmd.args,
      flags: ['f',],
    },)) {
      return true;
    }
    if (hasRootTarget(cmd,))
      return true;
    if ((cmd.name
      === 'chmod') && cmd
      .args
      .includes('777',))
      return true;
    if ((cmd.name
      === 'chmod') && cmd
      .args
      .some(
      function hasSetuid(a,) {
        return a.includes('u+s',)
          || a
          .includes('g+s',);
      },
    )) {
      return true;
    }

    if ((cmd.name
      === 'dd') && cmd
      .args
      .some(
      function hasOfEquals(a,) {
        return a.startsWith('of=',);
      },
    )) {
      return true;
    }

    if (cmd.name
      .startsWith('mkfs',))
      return true;
    if (ENV_DUMP_COMMANDS.has(cmd.name,))
      return true;
    if ((cmd.name
      === 'export') && cmd
      .args
      .includes('-p',))
      return true;

    if (INTERPRETER_COMMANDS.has(cmd.name,)
      && hasInlineCode({
      name: cmd.name,
      args: cmd.args,
    },)) {
      return true;
    }

    /** Path-shaped arguments plus redirect targets, each tested for sensitive paths below. */
    const files = [
      ...cmd.args
        .filter(looksLikePath,),
      ...cmd.redirectTargets,
    ];
    for (const f of files) {
      if (pathSignals({
        filePath: f,
        ctx,
      },)) {
        return true;
      }
    }

    if (
      (cmd.name
        === 'docker')
      && (cmd.args
        .includes('-e',)
        || cmd
        .args
        .includes('--env-file',))
    ) {
      return true;
    }
  }

  if (hasNetworkCommand(analysis,)
    && hasSecretParamRefs(analysis,))
    return true;

  if (
    analysis.isPipeline
      && hasSensitiveSource({
      analysis,
      ctx,
    },)
      && hasNetworkCommand(analysis,)
  ) {
    return true;
  }

  if (analysis.isPipeline
    && analysis
    .commands
    .some(
    function isEnvDump(c,) {
      return ENV_DUMP_COMMANDS.has(c.name,);
    },
  )) {
    return true;
  }

  if (config?.commands
    && matchUserCommands({
    analysis,
    matchers: config.commands,
  },)) {
    return true;
  }

  return false;
}

//endregion

//region User command matching

/**
 * Check if any command matches user-configured matchers.
 *
 * @returns `true` if any command matches
 *
 * @example
 * ```typescript
 * matchUserCommands({ analysis, matchers: ["terraform"] });
 * matchUserCommands({ analysis, matchers: [["docker", "compose"]] });
 * ```
 */
function matchUserCommands(
  {
    analysis,
    matchers,
  }: {
    analysis: BashAnalysis;
    matchers: CommandMatcher[];
  },
): boolean {
  for (const cmd of analysis.commands) {
    for (const matcher of matchers) {
      if ((typeof matcher) === 'string') {
        if (cmd.name
          === matcher)
          return true;
      }
      else {
        if (cmd.name
          !== matcher[0])
          continue;
        /** Argument tokens that must appear after the command name for the matcher to fire. */
        const prefix = matcher.slice(1,);
        if (prefix.every(
          function argMatches(
            sub,
            i,
          ) {
            return cmd.args[i]
              === sub;
          },
        )) {
          return true;
        }
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
