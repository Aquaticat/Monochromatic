/**
 * Main flagger and bash signal detection.
 *
 * Contains shouldFlag (the main entry point) and bashSignals.
 * Path signals are in path-signals.ts, content/text signals in
 * content-signals.ts, and tool event helpers in tool-helpers.ts.
 *
 * @module
 */

import {
  isToolCallEventType,
  type ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
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
  hasTrustedAgentTempCredentialHandoff,
  isTrustedAgentTempBashPathAllowed,
} from './trusted-agent-temp-bash.ts';
import {
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
} from './tool-helpers.ts';
import type {
  BashAnalysis,
  SignalContext,
} from './types.ts';

//region Main entry point

/**
 * Should this tool call be sent to the judge?
 *
 * Returns `true` if any signal fires. No reason is propagated. Bash calls go
 * through {@link analyzeBashCommand} and {@link bashSignals}; other tool
 * calls are checked with {@link getFilePath} and {@link pathSignals} for
 * location, then {@link extractToolText}, {@link contentSignals}, and
 * {@link textSignals} for body text.
 *
 * @returns `true` if the action should be flagged for judge review
 *
 * @example
 * ```typescript
 * const flagged = shouldFlag({ event, ctx: { cwd, home } });
 * const skillRead = shouldFlag({
 *   event,
 *   ctx: { cwd, home },
 *   readAllowlistedDirs: ["/home/user/.agents/skills/example"],
 * });
 * ```
 */
async function shouldFlag(
  {
    event,
    ctx,
    readAllowlistedDirs = [],
    bashAllowlistedDirs = [],
  }: {
    readonly event: ForeignBorrowed<ToolCallEvent>;
    readonly ctx: SignalContext;
    /**
     * Directories whose contents are safe for read-tool skill activation.
     */
    readonly readAllowlistedDirs?: readonly string[];
    /**
     * Private agent temp directories trusted for bash helper execution.
     */
    readonly bashAllowlistedDirs?: readonly string[];
  },
): Promise<boolean> {
  if (isToolCallEventType(
    'bash',
    event,
  )) {
    /**
     * Parsed bash AST used to walk individual commands and their redirect targets.
     */
    const analysis = analyzeBashCommand(event.input
      .command,);
    if (await bashSignals({
      analysis,
      ctx,
      trustedAgentTempDirs: bashAllowlistedDirs,
    },)) {
      return true;
    }
    if (textSignals({
      text: event.input
        .command,
    },)) {
      return true;
    }
    return false;
  }

  /**
   * Path argument extracted from the tool event when one applies (read/write/edit/etc.).
   */
  const filePath = getFilePath(event,);
  /**
   * Skill directory allowlist applied only to read-tool activation, not writes or shell commands.
   */
  const pathAllowlistedDirs = isToolCallEventType(
    'read',
    event,
  )
    ? readAllowlistedDirs
    : [];
  if (
    (filePath !== '')
      && await pathSignals({
      filePath,
      ctx,
      allowlistedDirs: pathAllowlistedDirs,
    },)
  ) {
    return true;
  }

  /**
   * Free text extracted from the tool event (file body, search query) for content/text signals.
   */
  const text = extractToolText(event,);
  if (text !== '') {
    if (contentSignals(text,))
      return true;
    if (textSignals({ text, },)) {
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
 * Checks {@link hasTrustedAgentTempCredentialHandoff} for dotenv-to-helper
 * handoffs, then per command: {@link PRIVILEGE_COMMANDS},
 * {@link isMutatingCommand} and {@link hasFlag}, {@link hasRootTarget},
 * {@link ENV_DUMP_COMMANDS}, {@link INTERPRETER_COMMANDS} and
 * {@link hasInlineCode}. Path-shaped words found with {@link looksLikePath}
 * are tested with {@link pathSignals} and excused by
 * {@link isTrustedAgentTempBashPathAllowed}. Finally checks
 * {@link hasNetworkCommand} combined with {@link hasSecretParamRefs} or
 * {@link hasSensitiveSource}.
 *
 * @returns `true` if any bash signal fires
 *
 * @example
 * ```typescript
 * const analysis = analyzeBashCommand("sudo rm -rf /");
 * bashSignals({ analysis, ctx }); // true
 * ```
 */
async function bashSignals(
  {
    analysis,
    ctx,
    trustedAgentTempDirs = [],
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
    /**
     * Private agent temp directories trusted for bash helper execution.
     */
    readonly trustedAgentTempDirs?: readonly string[];
  },
): Promise<boolean> {
  if (!analysis.parsed)
    return true;

  /**
   * Whether this command can read project dotenv only to feed trusted temp helper credentials.
   */
  const allowProjectDotenvCredentialSource = await hasTrustedAgentTempCredentialHandoff({
    analysis,
    ctx,
    trustedAgentTempDirs,
  },);

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
      === 'chmod')
      && cmd
      .args
      .includes('777',))
      return true;
    if ((cmd.name
      === 'chmod')
      && cmd
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
      === 'dd')
      && cmd
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
      === 'export')
      && cmd
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

  /**
   * Whether any path-shaped command word has a signal not covered by trusted temp policy.
   */
  const commandPathSignalDecisions = await Promise.all(
    analysis
      .commands
      .map(async function commandHasUnallowedPathSignal(cmd,) {
        /**
         * Path-shaped arguments plus redirect targets, each tested for sensitive paths below.
         */
        const files = [
          ...cmd.args
            .filter(function pathShapedArgument(argument,) {
              return looksLikePath(argument,);
            },),
          ...cmd.redirectTargets,
        ];
        /**
         * Path signal decisions for this command's file-like words.
         */
        const fileSignalDecisions = await Promise.all(
          files.map(async function fileHasUnallowedPathSignal(f,) {
            if (!(await pathSignals({
              filePath: f,
              ctx,
            },))) {
              return false;
            }
            return !(await isTrustedAgentTempBashPathAllowed({
              filePath: f,
              ctx,
              trustedAgentTempDirs,
              command: cmd,
              allowProjectDotenvCredentialSource,
            },));
          },),
        );
        return fileSignalDecisions.some(Boolean,);
      },),
  );
  if (commandPathSignalDecisions.some(Boolean,))
    return true;

  if (hasNetworkCommand(analysis,)
    && hasSecretParamRefs(analysis,))
    return true;

  if (
    analysis.isPipeline
      && await hasSensitiveSource({
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

  return false;
}

//endregion

export { hasFlag, } from './bash-helpers.ts';
export {
  bashSignals,
  shouldFlag,
};
