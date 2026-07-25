/**
 * Trusted agent temp bash allowances.
 *
 * Current `~/temp/agent` and historical `/tmp/agent` compatibility roots are
 * private agent scratch space when they pass ownership and mode checks in
 * `temp-allowlist.ts`. Bash commands may run helper scripts from either trusted
 * root and hand credentials to those helpers without treating the helper path
 * or project-local dotenv source as user-interrupting signals.
 *
 * @module
 */

import { SECRET_VAR_PATTERN, } from './constants.ts';
import { extractShellAssignmentNames, } from './shell-assignment.ts';
import { isNonSecretTrustedAgentTempBashPath, } from './trusted-agent-temp-glob-paths.ts';
import {
  isExistingPathUnderTrustedAgentTemp,
  isProjectDotenvCredentialExtractionPath,
} from './trusted-agent-temp-paths.ts';
import type {
  BashAnalysis,
  CommandInfo,
  SignalContext,
} from './types.ts';

//region Constants

/**
 * Commands whose file arguments execute script text.
 *
 * @example
 * ```typescript
 * TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS.has('bun'); // true
 * ```
 */
const TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS = new Set([
  'bash',
  'bun',
  'deno',
  'fish',
  'node',
  'perl',
  'python',
  'python3',
  'ruby',
  'sh',
  'zsh',
] as const,) as Set<string>;

//endregion Constants

//region Public API

/**
 * Check whether bash path signal is allowed by trusted agent temp policy.
 *
 * Delegates to {@link isNonSecretTrustedAgentTempBashPath} for the helper-path
 * check and, when allowed, to {@link isProjectDotenvCredentialExtractionPath}
 * for the dotenv credential handoff check.
 *
 * @param filePath - path token being scored by bash signal scan
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @param allowProjectDotenvCredentialSource - whether command hands secret env
 *   to trusted temp helper
 *
 * @returns whether path signal should be ignored for this bash command
 *
 * @example
 * ```typescript
 * isTrustedAgentTempBashPathAllowed({
 *   filePath: '/account-home/temp/agent/check.ts',
 *   ctx,
 *   trustedAgentTempDirs: ['/account-home/temp/agent'],
 *   allowProjectDotenvCredentialSource: false,
 * }); // true for existing non-secret helper path
 * ```
 */
async function isTrustedAgentTempBashPathAllowed(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
    command,
    allowProjectDotenvCredentialSource,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
    readonly command: CommandInfo;
    readonly allowProjectDotenvCredentialSource: boolean;
  },
): Promise<boolean> {
  if (trustedAgentTempDirs.length
    === 0)
    return false;

  if (await isNonSecretTrustedAgentTempBashPath({
    filePath,
    ctx,
    trustedAgentTempDirs,
  },)) {
    return true;
  }

  return allowProjectDotenvCredentialSource
    && await isProjectDotenvCredentialExtractionPath({
      command,
      filePath,
      ctx,
    },);
}

/**
 * Check whether command hands secret-looking env var to trusted temp helper.
 *
 * Filters commands with {@link commandContainsSecretAssignment} and tests the
 * survivors with {@link commandInvokesTrustedAgentTempHelper}.
 *
 * @param analysis - parsed bash analysis for complete tool command
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether project dotenv sources may feed trusted helper credential
 *
 * @example
 * ```typescript
 * hasTrustedAgentTempCredentialHandoff({ analysis, ctx, trustedAgentTempDirs });
 * ```
 */
async function hasTrustedAgentTempCredentialHandoff(
  {
    analysis,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (trustedAgentTempDirs.length
    === 0)
    return false;

  /**
   * Concurrent helper checks for credential-bearing commands.
   */
  const helperPromises: Promise<boolean>[] = [];
  for (const command of analysis.commands) {
    if (commandContainsSecretAssignment(command,)) {
      helperPromises[helperPromises.length] = commandInvokesTrustedAgentTempHelper({
        command,
        ctx,
        trustedAgentTempDirs,
      },);
    }
  }
  /**
   * Trusted-helper invocation decisions for credential-bearing commands.
   */
  const helperDecisions = await Promise.all(helperPromises,);
  for (const decision of helperDecisions) {
    if (decision)
      return true;
  }
  return false;
}

//endregion Public API

//region Credential handoff detection

/**
 * Check whether command text contains secret-looking assignment name.
 *
 * Extracts candidate words with {@link commandWords}, names with
 * {@link extractShellAssignmentNames}, and tests each against
 * {@link SECRET_VAR_PATTERN}.
 *
 * @param command - parsed command segment
 *
 * @returns whether any assignment name resembles credential variable
 *
 * @example
 * ```typescript
 * commandContainsSecretAssignment(command); // true for GEMINI_API_KEY=value
 * ```
 */
function commandContainsSecretAssignment(
  command: CommandInfo,
): boolean {
  for (const word of commandWords(command,)) {
    for (const assignmentName of extractShellAssignmentNames(word,)) {
      if (SECRET_VAR_PATTERN.test(assignmentName,))
        return true;
    }
  }
  return false;
}

/**
 * Flatten command name, assignment words, and arguments into searchable words.
 *
 * @param command - parsed command segment
 *
 * @returns word list containing assignment syntax and command arguments
 *
 * @example
 * ```typescript
 * commandWords(command).includes('bun');
 * ```
 */
function commandWords(
  command: CommandInfo,
): readonly string[] {
  /**
   * Rendered command words in shell order.
   */
  const words: string[] = [command.name,];
  for (const assignment of command.envAssignments)
    words[words.length] = `${assignment.name}=${assignment.value}`;
  for (const argument of command.args)
    words[words.length] = argument;
  return words;
}

/**
 * Check whether command executes a helper from trusted agent temp root.
 *
 * Tests the command name and, for {@link TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS}
 * commands, their arguments with {@link isExistingPathUnderTrustedAgentTemp}.
 *
 * @param command - parsed command segment
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether command invokes trusted helper script
 *
 * @example
 * ```typescript
 * commandInvokesTrustedAgentTempHelper({ command, ctx, trustedAgentTempDirs });
 * ```
 */
async function commandInvokesTrustedAgentTempHelper(
  {
    command,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly command: CommandInfo;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (await isExistingPathUnderTrustedAgentTemp({
    filePath: command.name,
    ctx,
    trustedAgentTempDirs,
  },)) {
    return true;
  }

  if (TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS.has(command.name,)) {
    /**
     * Concurrent path checks for direct script-runner arguments.
     */
    const argumentPromises: Promise<boolean>[] = [];
    for (const argument of command.args) {
      argumentPromises[argumentPromises.length] = isExistingPathUnderTrustedAgentTemp({
        filePath: argument,
        ctx,
        trustedAgentTempDirs,
      },);
    }
    /**
     * Direct script-runner argument path decisions.
     */
    const argumentDecisions = await Promise.all(argumentPromises,);
    for (const decision of argumentDecisions) {
      if (decision)
        return true;
    }
    return false;
  }

  /**
   * Concurrent trusted-path checks for arguments after nested runner words.
   */
  const followingArgumentPromises: Promise<boolean>[] = [];
  /**
   * Wrapper command arguments searched for nested runners and helper paths.
   */
  const { args, } = command;
  for (let runnerIndex = 0; runnerIndex < args.length; runnerIndex += 1) {
    /**
     * Possible runner command at current wrapper argument position.
     */
    const runnerArgument = args[runnerIndex];
    if ((runnerArgument === undefined)
      || (!TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS.has(runnerArgument,)))
      continue;
    for (let argumentIndex = runnerIndex + 1; argumentIndex < args.length; argumentIndex += 1) {
      /**
       * Possible helper path after nested runner word.
       */
      const followingArgument = args[argumentIndex];
      if (followingArgument !== undefined) {
        followingArgumentPromises[followingArgumentPromises.length] = isExistingPathUnderTrustedAgentTemp({
          filePath: followingArgument,
          ctx,
          trustedAgentTempDirs,
        },);
      }
    }
  }
  /**
   * Trusted-helper decisions for arguments following runner words.
   */
  const followingArgumentDecisions = await Promise.all(followingArgumentPromises,);
  for (const decision of followingArgumentDecisions) {
    if (decision)
      return true;
  }
  return false;
}

//endregion Credential handoff detection

export {
  hasTrustedAgentTempCredentialHandoff,
  isTrustedAgentTempBashPathAllowed,
};
