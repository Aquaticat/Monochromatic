/**
 * Trusted temporary allowlist helpers.
 *
 * Owns the policy for deciding whether `/tmp/agent` and `~/temp/agent` are
 * safe for structured read-tool bypasses. `/tmp/agent` alone is also trusted
 * for bash helper execution. Each root must exist, be a real directory owned
 * by the current process user, resolve without symlinks, and have no group or
 * other permission bits.
 *
 * @module
 */

import {
  lstat,
  realpath,
} from 'node:fs/promises';
import {
  join,
  resolve,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { AGENT_TEMP_READ_DIR, } from './constants.ts';

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
 * Tagged logger for the temp-read-allowlist module.
 */
const moduleLogger = tagged({
  tag: 'temp-read-allowlist',
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
 * @param dir - directory considered for read allowlisting
 *
 * @returns whether directory identity, ownership, and mode make read allowlisting safe
 *
 * @example
 * ```typescript
 * const trusted = isTrustedReadAllowlistDir('/tmp/agent');
 * ```
 */
async function isTrustedReadAllowlistDir(
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
      tag: isTrustedReadAllowlistDir.name,
      l: moduleLogger,
    },);
    innerL.debug(`metadata lookup failed for ${dir}: ${String(error,)}`,);
    return false;
  }
}

/**
 * Return {@link AGENT_TEMP_READ_DIR} when {@link isTrustedReadAllowlistDir}
 * finds current filesystem state trusted.
 *
 * @returns singleton allowlist when `/tmp/agent` is private, otherwise empty list
 *
 * @example
 * ```typescript
 * const dirs = agentTempAllowlistedDirs();
 * ```
 */
async function agentTempAllowlistedDirs(): Promise<readonly string[]> {
  if (!(await isTrustedReadAllowlistDir(AGENT_TEMP_READ_DIR,)))
    return [];
  return [AGENT_TEMP_READ_DIR,];
}

/**
 * Return private roots for structured read-tool bypasses. `/tmp/agent` keeps
 * compatibility with trusted bash helpers, while `~/temp/agent` is read-only
 * and never returned by {@link agentTempAllowlistedDirs}.
 *
 * @param home - permits isolated callers to derive the current-user boundary without mutating process env
 *
 * @returns private existing read roots, otherwise an empty list
 *
 * @example
 * ```typescript
 * const dirs = agentTempReadAllowlistedDirs({ home: '/home/user' });
 * ```
 */
async function agentTempReadAllowlistedDirs(
  {
    home = process.env
      .HOME
      ?? '/home',
  }: {
    readonly home?: string;
  } = {},
): Promise<readonly string[]> {
  /**
   * Candidate roots whose current metadata is checked for every read call.
   */
  const candidateDirs = [
    AGENT_TEMP_READ_DIR,
    join(
      home,
      'temp',
      'agent',
    ),
  ];
  /**
   * Per-root trust decisions in the same order as {@link candidateDirs}.
   */
  const trustDecisions = await Promise.all(candidateDirs.map(
    function checkCandidateDir(candidateDir,) {
      return isTrustedReadAllowlistDir(candidateDir,);
    },
  ),);
  return candidateDirs.filter(function keepTrustedReadDir(
    _candidateDir,
    index,
  ) {
    return trustDecisions[index] === true;
  },);
}

export {
  agentTempAllowlistedDirs,
  agentTempReadAllowlistedDirs,
  isTrustedReadAllowlistDir,
};
