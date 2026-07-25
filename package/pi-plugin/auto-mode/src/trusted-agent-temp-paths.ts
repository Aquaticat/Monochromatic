/**
 * Trusted agent temp path classification helpers.
 *
 * These helpers keep canonical path checks separate from bash command-shape
 * detection. They require existing filesystem targets so missing paths fail
 * closed, and they compare canonical paths so symlink escapes stay guarded.
 *
 * @module
 */

import { realpath, } from 'node:fs/promises';
import * as nodePath from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { SECRET_VAR_PATTERN, } from './constants.ts';
import {
  isUnder,
  pathSignals,
  resolvePath,
} from './path-signals.ts';
import type {
  CommandInfo,
  SignalContext,
} from './types.ts';

//region Logging

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the trusted-agent-temp-paths module.
 */
const moduleLogger = tagged({
  tag: 'trusted-agent-temp-paths',
  l: parentLogger,
},);

//endregion Logging

//region Sentinels

/**
 * Sentinel for paths whose canonical filesystem target cannot be resolved.
 */
const REALPATH_UNAVAILABLE = Symbol('trusted agent temp realpath unavailable for path',);

/**
 * Result from attempting filesystem canonicalisation.
 */
type RealpathResult = string | typeof REALPATH_UNAVAILABLE;

//endregion Sentinels

//region Public API

/**
 * Check whether path is existing non-secret file under trusted agent temp root.
 *
 * Requires {@link isExistingPathUnderTrustedAgentTemp} containment, then
 * requires {@link pathSignals} to find no other location signal.
 *
 * @param filePath - shell path token
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether path is safe to ignore as bash location signal
 *
 * @example
 * ```typescript
 * isExistingNonSecretTrustedAgentTempPath({ filePath, ctx, trustedAgentTempDirs });
 * ```
 */
async function isExistingNonSecretTrustedAgentTempPath(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (!(await isExistingPathUnderTrustedAgentTemp({
    filePath,
    ctx,
    trustedAgentTempDirs,
  },))) {
    return false;
  }

  return !(await pathSignals({
    filePath,
    ctx,
    allowlistedDirs: trustedAgentTempDirs,
  },));
}

/**
 * Check whether path resolves inside trusted agent temp root.
 *
 * Resolves the token with {@link resolvePath}, canonicalises both sides with
 * {@link realpathOrUnavailable}, and compares containment with {@link isUnder}.
 *
 * @param filePath - shell path token
 *
 * @param ctx - path resolution context
 *
 * @param trustedAgentTempDirs - private agent temp roots trusted for helpers
 *
 * @returns whether canonical path stays inside canonical trusted root
 *
 * @example
 * ```typescript
 * isExistingPathUnderTrustedAgentTemp({ filePath, ctx, trustedAgentTempDirs });
 * ```
 */
async function isExistingPathUnderTrustedAgentTemp(
  {
    filePath,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (filePath === '')
    return false;

  /**
   * Canonical target path for command token.
   */
  const canonicalPath = await realpathOrUnavailable(resolvePath({
    filePath,
    cwd: ctx.cwd,
  },),);
  if (canonicalPath === REALPATH_UNAVAILABLE)
    return false;

  /**
   * Concurrent canonicalization and containment work for trusted roots.
   */
  const containmentPromises: Promise<boolean>[] = [];
  for (const trustedDir of trustedAgentTempDirs) {
    containmentPromises[containmentPromises.length] = (async function trustedDirContainsPath(): Promise<boolean> {
      /**
       * Canonical trusted root used to block symlink escapes.
       */
      const canonicalTrustedDir = await realpathOrUnavailable(nodePath.resolve(
        ctx.cwd,
        trustedDir,
      ),);
      return (canonicalTrustedDir !== REALPATH_UNAVAILABLE)
        && isUnder({
          resolved: canonicalPath,
          dir: canonicalTrustedDir,
        },);
    })();
  }
  /**
   * Trusted-root containment decisions for current canonical path.
   */
  const containmentDecisions = await Promise.all(containmentPromises,);
  for (const containsPath of containmentDecisions) {
    if (containsPath)
      return true;
  }
  return false;
}

/**
 * Check whether command path is project dotenv credential extraction source.
 *
 * Requires a `grep` command with an argument matching {@link SECRET_VAR_PATTERN},
 * then requires {@link isExistingProjectDotenvPath} for the path token.
 *
 * @param command - parsed command segment containing path token
 *
 * @param filePath - shell path token
 *
 * @param ctx - path resolution context
 *
 * @returns whether grep reads credential name from project dotenv file
 *
 * @example
 * ```typescript
 * isProjectDotenvCredentialExtractionPath({ command, filePath: '.env.local', ctx });
 * ```
 */
async function isProjectDotenvCredentialExtractionPath(
  {
    command,
    filePath,
    ctx,
  }: {
    readonly command: CommandInfo;
    readonly filePath: string;
    readonly ctx: SignalContext;
  },
): Promise<boolean> {
  if (command.name
    !== 'grep')
    return false;

  /**
   * Secret-looking arguments proving grep selects credential names.
   */
  const secretNameArguments: string[] = [];
  for (const argument of command.args) {
    if (SECRET_VAR_PATTERN.test(argument,))
      secretNameArguments[secretNameArguments.length] = argument;
  }
  if (secretNameArguments.length === 0)
    return false;
  return await isExistingProjectDotenvPath({
    filePath,
    ctx,
  },);
}

//endregion Public API

//region Dotenv paths

/**
 * Check whether path is existing project-local dotenv file.
 *
 * Resolves the token with {@link resolvePath}, checks cwd containment with
 * {@link isUnder}, and checks the basename with {@link isDotenvBasename}.
 *
 * @param filePath - shell path token
 *
 * @param ctx - path resolution context
 *
 * @returns whether path is `.env` or `.env.*` inside project cwd
 *
 * @example
 * ```typescript
 * isExistingProjectDotenvPath({ filePath: '.env.local', ctx });
 * ```
 */
async function isExistingProjectDotenvPath(
  {
    filePath,
    ctx,
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
  },
): Promise<boolean> {
  /**
   * Canonical source path to ensure missing files fail closed.
   */
  const canonicalPath = await realpathOrUnavailable(resolvePath({
    filePath,
    cwd: ctx.cwd,
  },),);
  if (canonicalPath === REALPATH_UNAVAILABLE)
    return false;

  /**
   * Canonical project root to keep home dotfiles and sibling repos blocked.
   */
  const canonicalCwd = await realpathOrUnavailable(ctx.cwd,);
  if (canonicalCwd === REALPATH_UNAVAILABLE)
    return false;

  return isUnder({
    resolved: canonicalPath,
    dir: canonicalCwd,
  },)
    && isDotenvBasename(nodePath.basename(canonicalPath,),);
}

/**
 * Check whether basename is project dotenv filename.
 *
 * @param basename - final path segment
 *
 * @returns whether basename is `.env` or starts with `.env.`
 *
 * @example
 * ```typescript
 * isDotenvBasename('.env.local'); // true
 * isDotenvBasename('id_rsa'); // false
 * ```
 */
function isDotenvBasename(
  basename: string,
): boolean {
  return (basename === '.env')
    || basename.startsWith('.env.',);
}

//endregion Dotenv paths

//region Realpath

/**
 * Resolve filesystem path to canonical target without throwing.
 *
 * @param path - filesystem path to canonicalise
 *
 * @returns canonical path or sentinel when path is missing or inaccessible
 *
 * @example
 * ```typescript
 * realpathOrUnavailable('/account-home/temp/agent');
 * ```
 */
async function realpathOrUnavailable(
  path: string,
): Promise<RealpathResult> {
  try {
    return await realpath(path,);
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name so the handled realpath failure stays traceable.
     */
    const innerL = tagged({
      tag: realpathOrUnavailable.name,
      l: moduleLogger,
    },);
    innerL.debug(`realpath failed for ${path}: ${String(error,)}`,);
    return REALPATH_UNAVAILABLE;
  }
}

//endregion Realpath

export {
  isExistingNonSecretTrustedAgentTempPath,
  isExistingPathUnderTrustedAgentTemp,
  isProjectDotenvCredentialExtractionPath,
};
