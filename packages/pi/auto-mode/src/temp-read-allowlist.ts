/**
 * Trusted temporary allowlist helpers.
 *
 * Owns the policy for deciding whether `/tmp/agent` is safe to trust for
 * structured read-tool bypasses and bash helper execution. The path must exist,
 * be a directory, be owned by the current process user, and have no group or
 * other permission bits.
 *
 * @module
 */

import { statSync, } from 'node:fs';

import { AGENT_TEMP_READ_DIR, } from './constants.ts';

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
 * @returns whether directory ownership and mode make read allowlisting safe
 *
 * @example
 * ```typescript
 * const trusted = isTrustedReadAllowlistDir('/tmp/agent');
 * ```
 */
function isTrustedReadAllowlistDir(
  dir: string,
): boolean {
  try {
    /**
     * Filesystem metadata for candidate allowlist root.
     */
    const stats = statSync(dir,);
    if (!stats.isDirectory())
      return false;
    if (process.getuid === undefined)
      return false;
    if (stats.uid !== process.getuid())
      return false;
    return (stats.mode & GROUP_OR_OTHER_PERMISSION_BITS) === 0;
  }
  catch {
    return false;
  }
}

/**
 * Return agent temp root when current filesystem state is trusted.
 *
 * @returns singleton allowlist when `/tmp/agent` is private, otherwise empty list
 *
 * @example
 * ```typescript
 * const dirs = agentTempAllowlistedDirs();
 * ```
 */
function agentTempAllowlistedDirs(): readonly string[] {
  if (!isTrustedReadAllowlistDir(AGENT_TEMP_READ_DIR,))
    return [];
  return [AGENT_TEMP_READ_DIR,];
}

/**
 * Return agent temp root for structured read-tool bypass compatibility.
 *
 * @returns singleton allowlist when `/tmp/agent` is private, otherwise empty list
 *
 * @example
 * ```typescript
 * const dirs = agentTempReadAllowlistedDirs();
 * ```
 */
function agentTempReadAllowlistedDirs(): readonly string[] {
  return agentTempAllowlistedDirs();
}

export {
  agentTempAllowlistedDirs,
  agentTempReadAllowlistedDirs,
  isTrustedReadAllowlistDir,
};
