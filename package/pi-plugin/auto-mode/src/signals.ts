/**
 * Main flagger and bash signal detection.
 *
 * Contains shouldFlag (the main entry point) and bashSignals.
 * Path signals are in path-signals.ts, content/text signals in
 * content-signals.ts, and tool event helpers in tool-helpers.ts.
 *
 * @module
 */

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
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
import { classifyReadOnlyBash, } from './read-only-bash-proof.ts';
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
import {
  isBashToolEvent,
  isReadToolEvent,
} from './tool-event.ts';
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
  if (isBashToolEvent(event,)) {
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
  const pathAllowlistedDirs = isReadToolEvent(event,)
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
  /**
   * Positive proof required for modeled inspection families and existing private scratch paths.
   */
  const readOnlyProof = await classifyReadOnlyBash({
    analysis,
    ctx,
    trustedAgentTempDirs,
  },);
  if (readOnlyProof.proven)
    return false;
  if (readOnlyProof.required
    && !allowProjectDotenvCredentialSource) {
    return true;
  }

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
    if (cmd.name === 'chmod') {
      for (const argument of cmd.args) {
        if ((argument === '777')
          || argument.includes('u+s',)
          || argument.includes('g+s',))
          return true;
      }
    }

    if (cmd.name === 'dd') {
      for (const argument of cmd.args) {
        if (argument.startsWith('of=',))
          return true;
      }
    }

    if (cmd.name
      .startsWith('mkfs',))
      return true;
    if (ENV_DUMP_COMMANDS.has(cmd.name,))
      return true;
    if (cmd.name === 'export') {
      for (const argument of cmd.args) {
        if (argument === '-p')
          return true;
      }
    }

    if (INTERPRETER_COMMANDS.has(cmd.name,)
      && hasInlineCode({
      name: cmd.name,
      args: cmd.args,
    },)) {
      return true;
    }

    if (cmd.name === 'docker') {
      for (const argument of cmd.args) {
        if ((argument === '-e') || (argument === '--env-file'))
          return true;
      }
    }
  }

  /**
   * Concurrent path-signal work for every parsed command.
   */
  const commandPathSignalPromises: Promise<boolean>[] = [];
  for (const command of analysis.commands) {
    commandPathSignalPromises[commandPathSignalPromises.length] = (async function commandHasUnallowedPathSignal(): Promise<boolean> {
      /**
       * Path-shaped arguments plus redirect targets.
       */
      const files: string[] = [];
      for (const argument of command.args) {
        if (looksLikePath(argument,))
          files[files.length] = argument;
      }
      for (const redirectTarget of command.redirectTargets)
        files[files.length] = redirectTarget;
      /**
       * Concurrent path decisions for current command's file-like words.
       */
      const fileSignalPromises: Promise<boolean>[] = [];
      for (const filePath of files) {
        fileSignalPromises[fileSignalPromises.length] = (async function fileHasUnallowedPathSignal(): Promise<boolean> {
          if (!(await pathSignals({
            filePath,
            ctx,
          },)))
            return false;
          return !(await isTrustedAgentTempBashPathAllowed({
            filePath,
            ctx,
            trustedAgentTempDirs,
            command,
            allowProjectDotenvCredentialSource,
          },));
        })();
      }
      /**
       * Current command's path decisions after every independent check.
       */
      const fileSignalDecisions = await Promise.all(fileSignalPromises,);
      for (const decision of fileSignalDecisions) {
        if (decision)
          return true;
      }
      return false;
    })();
  }
  /**
   * Per-command path decisions after every independent check.
   */
  const commandPathSignalDecisions = await Promise.all(commandPathSignalPromises,);
  for (const decision of commandPathSignalDecisions) {
    if (decision)
      return true;
  }

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

  if (analysis.isPipeline) {
    for (const command of analysis.commands) {
      if (ENV_DUMP_COMMANDS.has(command.name,))
        return true;
    }
  }

  return false;
}

//endregion

export { hasFlag, } from './bash-helpers.ts';
export {
  bashSignals,
  shouldFlag,
};
