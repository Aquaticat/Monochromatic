/**
 * Trusted agent temp bash allowances.
 *
 * The `/tmp/agent` root is private agent scratch space when it passes the
 * ownership and mode checks in `temp-read-allowlist.ts`. Bash commands may run
 * helper scripts from that root and hand credentials to those helpers without
 * treating the helper path or project-local dotenv source as user-interrupting
 * signals.
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
 *   filePath: '/tmp/agent/check.ts',
 *   ctx,
 *   trustedAgentTempDirs: ['/tmp/agent'],
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
   * Commands that could hand a credential to a helper path.
   */
  const credentialCommands = analysis
    .commands
    .filter(function commandHasSecretAssignment(command,) {
      return commandContainsSecretAssignment(command,);
    },);
  /**
   * Trusted-helper invocation decisions for credential-bearing commands.
   */
  const helperDecisions = await Promise.all(
    credentialCommands.map(function commandHandsCredentialToTrustedHelper(command,) {
      return commandInvokesTrustedAgentTempHelper({
        command,
        ctx,
        trustedAgentTempDirs,
      },);
    },),
  );
  return helperDecisions.some(Boolean,);
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
  return commandWords(command,)
    .flatMap(
      function wordAssignmentNames(word,) {
        return extractShellAssignmentNames(word,);
      },
    )
    .some(
    function isSecretAssignment(name,) {
      return SECRET_VAR_PATTERN.test(name,);
    },
  );
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
  return [
    command.name,
    ...command
      .envAssignments
      .map(
        function renderAssignment(assignment,) {
          return `${assignment.name}=${assignment.value}`;
        },
      ),
    ...command.args,
  ];
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
     * Direct script-runner argument path decisions.
     */
    const argumentDecisions = await Promise.all(
      command
        .args
        .map(function argumentIsTrustedHelperPath(argument,) {
          return isExistingPathUnderTrustedAgentTemp({
            filePath: argument,
            ctx,
            trustedAgentTempDirs,
          },);
        },),
    );
    return argumentDecisions.some(Boolean,);
  }

  /**
   * Argument indexes for runner words inside wrapper commands.
   */
  const runnerIndexes = [...command
    .args
    .entries(),]
    .filter(function entryHasRunnerArgument(entry,) {
      return TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS.has(entry[1],);
    },)
    .map(function pickEntryIndex(entry,) {
      return entry[0];
    },);
  /**
   * Arguments after runner words that could be helper paths.
   */
  const followingArguments = runnerIndexes.flatMap(function followingArgumentsAfterRunner(index,) {
    return command.args
      .slice(index + 1,);
  },);
  /**
   * Trusted-helper decisions for arguments following runner words.
   */
  const followingArgumentDecisions = await Promise.all(
    followingArguments.map(function followingArgumentIsTrustedHelperPath(followingArgument,) {
      return isExistingPathUnderTrustedAgentTemp({
        filePath: followingArgument,
        ctx,
        trustedAgentTempDirs,
      },);
    },),
  );
  return followingArgumentDecisions.some(Boolean,);
}

//endregion Credential handoff detection

export {
  hasTrustedAgentTempCredentialHandoff,
  isTrustedAgentTempBashPathAllowed,
};
