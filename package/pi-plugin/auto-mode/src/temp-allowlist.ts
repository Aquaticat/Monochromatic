/**
 * Trusted temporary allowlist helpers.
 *
 * Owns the policy for deciding whether current `~/temp/agent` and historical
 * `/tmp/agent` compatibility roots are safe for structured reads and Bash
 * helper execution. Each root must exist, be a real directory owned by current
 * process user, resolve without symlinks, and have no group or other permission
 * bits.
 *
 * @module
 */

import {
  lstat,
  realpath,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { HISTORICAL_AGENT_TEMP_DIR, } from './constants.ts';

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
 * Tagged logger for the temp-allowlist module.
 */
const moduleLogger = tagged({
  tag: 'temp-allowlist',
  l: parentLogger,
},);

/**
 * Permission bits that grant any access to group or other users.
 *
 * @example
 * ```typescript
 * const unsafeBits = GROUP_OR_OTHER_PERMISSION_BITS;
 * ```
 */
const GROUP_OR_OTHER_PERMISSION_BITS = 0o077;

/**
 * Check whether directory is private to current process user.
 *
 * @param dir - directory considered for agent temp trust
 *
 * @returns whether directory identity, ownership, and mode make agent temp access safe
 *
 * @example
 * ```typescript
 * const currentAgentTempDir = join(homedir(), 'temp', 'agent');
 * const trusted = isTrustedAgentTempDir(currentAgentTempDir);
 * ```
 */
async function isTrustedAgentTempDir(
  dir: string,
): Promise<boolean> {
  try {
    /**
     * Filesystem metadata for candidate allowlist root.
     */
    const stats = await lstat(dir,);
    if (!stats.isDirectory())
      return false;
    if ((await realpath(dir,)) !== resolve(dir,))
      return false;
    if (process.getuid === undefined)
      return false;
    if (stats.uid !== process.getuid())
      return false;
    return (stats.mode & GROUP_OR_OTHER_PERMISSION_BITS) === 0;
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name so the handled stat failure stays traceable.
     */
    const innerL = tagged({
      tag: isTrustedAgentTempDir.name,
      l: moduleLogger,
    },);
    innerL.debug(`metadata lookup failed for ${dir}: ${String(error,)}`,);
    return false;
  }
}

/**
 * Return private roots for structured reads and Bash helper execution.
 *
 * Current `~/temp/agent` is preferred. Historical `/tmp/agent` remains trusted
 * for compatibility when it independently passes current filesystem checks.
 *
 * @param home - permits isolated callers to derive current-user boundary without mutating process env
 *
 * @param historicalAgentTempDir - permits isolated callers to replace shared compatibility root
 *
 * @returns private existing agent temp roots, otherwise an empty list
 *
 * @example
 * ```typescript
 * const dirs = agentTempAllowlistedDirs({ home: '/account-home' });
 * ```
 */
async function agentTempAllowlistedDirs(
  {
    home = homedir(),
    historicalAgentTempDir = HISTORICAL_AGENT_TEMP_DIR,
  }: {
    readonly home?: string;
    readonly historicalAgentTempDir?: string;
  } = {},
): Promise<readonly string[]> {
  /**
   * Candidate roots whose current metadata is checked for every relevant tool call.
   */
  const candidateDirs = [
    join(
      home,
      'temp',
      'agent',
    ),
    historicalAgentTempDir,
  ];
  /**
   * Per-root trust decisions in the same order as {@link candidateDirs}.
   */
  const trustDecisions = await Promise.all(candidateDirs.map(
    function checkCandidateDir(candidateDir,) {
      return isTrustedAgentTempDir(candidateDir,);
    },
  ),);
  return candidateDirs.filter(function keepTrustedAgentTempDir(
    _candidateDir,
    index,
  ) {
    return trustDecisions[index] === true;
  },);
}

export {
  agentTempAllowlistedDirs,
  isTrustedAgentTempDir,
};
