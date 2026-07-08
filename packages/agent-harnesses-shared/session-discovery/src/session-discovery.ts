/**
 * Full calling-session discovery composition.
 *
 * @module
 */

import { findByMostRecent, } from './newest.ts';
import { optionalSessionDiscoveryIo, } from './optional-io.ts';
import { SESSION_NOT_FOUND, } from './sentinels.ts';
import { walkProcessTreeFrom, } from './process-tree.ts';
import type { FindCallingSessionOptions, } from './types.ts';

//region Full discovery

/**
 * Finds parent agent session by process ancestry, then newest mapping fallback.
 *
 * @param startPid - process identifier where discovery starts
 *
 * @param byPidDir - directory containing PID mapping files
 *
 * @param io - optional test IO seam
 *
 * @param parseMapping - host-owned parser for mapping file contents
 *
 * @returns parsed mapping, or {@link SESSION_NOT_FOUND}
 *
 * @example
 * ```ts
 * await findCallingSession({ startPid: process.ppid, byPidDir, parseMapping });
 * ```
 */
async function findCallingSession<TMapping>(
  {
    startPid,
    byPidDir,
    io,
    parseMapping,
  }: FindCallingSessionOptions<TMapping>,
): Promise<TMapping | typeof SESSION_NOT_FOUND> {
  /**
   * Precise process-tree result.
   */
  const fromTree = await walkProcessTreeFrom({
    pid: startPid,
    byPidDir,
    ...optionalSessionDiscoveryIo(io,),
    parseMapping,
  },);

  return fromTree === SESSION_NOT_FOUND
    ? await findByMostRecent({
      byPidDir,
      ...optionalSessionDiscoveryIo(io,),
      parseMapping,
    },)
    : fromTree;
}

//endregion Full discovery

export { findCallingSession, };
