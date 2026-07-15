/**
 * Process-tree walking for session discovery.
 *
 * @module
 */

import { readPidMapping, } from './mapping.ts';
import { optionalSessionDiscoveryIo, } from './optional-io.ts';
import { readParentPid, } from './procfs.ts';
import { SESSION_NOT_FOUND, } from './sentinels.ts';
import type { WalkProcessTreeOptions, } from './types.ts';

//region Process tree walk

/**
 * Walks ancestors from a start PID to locate nearest session mapping.
 *
 * @param pid - process identifier where search starts
 *
 * @param byPidDir - directory containing PID mapping files
 *
 * @param io - optional test IO seam
 *
 * @param parseMapping - host-owned parser for mapping file contents
 *
 * @returns nearest parsed mapping, or {@link SESSION_NOT_FOUND}
 *
 * @example
 * ```ts
 * await walkProcessTreeFrom({ pid: process.ppid, byPidDir, parseMapping });
 * ```
 */
async function walkProcessTreeFrom<TMapping>(
  {
    pid,
    byPidDir,
    io,
    parseMapping,
  }: WalkProcessTreeOptions<TMapping>,
): Promise<TMapping | typeof SESSION_NOT_FOUND> {
  for (let currentPid = pid; currentPid > 1;) {
    /**
     * Mapping directly attached to current process id.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- next pid depends on current pid's parent.
    const direct = await readPidMapping({
      pid: currentPid,
      byPidDir,
      ...optionalSessionDiscoveryIo(io,),
      parseMapping,
    },);
    if (direct !== SESSION_NOT_FOUND)
      return direct;

    /**
     * Parent process id for next upward step.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- each parent pid is read from current pid.
    const parentPid = await readParentPid({
      pid: currentPid,
      ...optionalSessionDiscoveryIo(io,),
    },);
    if (parentPid === SESSION_NOT_FOUND)
      return SESSION_NOT_FOUND;
    currentPid = parentPid;
  }

  return SESSION_NOT_FOUND;
}

//endregion Process tree walk

export { walkProcessTreeFrom, };
