/**
 * Parent Pi session resolution for spawn-pi CLI.
 *
 * @module
 */

import {
  findByMostRecent as findSharedByMostRecent,
  findCallingSession as findSharedCallingSession,
  readByPidDir as readSharedByPidDir,
  readParentPid as readSharedParentPid,
  readPidMapping as readSharedPidMapping,
  SESSION_NOT_FOUND as SHARED_SESSION_NOT_FOUND,
  walkProcessTreeFrom as walkSharedProcessTreeFrom,
} from '@monochromatic-dev/agent-harness-shared-session-discovery/ts';

import {
  byPidDir,
  type Environment,
  type PidMapping,
} from './paths.ts';

//region Sentinels

/**
 * Sentinel returned when no parent Pi session mapping can be resolved.
 *
 * @example
 * ```typescript
 * if (identity === SESSION_NOT_FOUND) throw new Error('missing parent');
 * ```
 */
const SESSION_NOT_FOUND: typeof SHARED_SESSION_NOT_FOUND = SHARED_SESSION_NOT_FOUND;

//endregion Sentinels

//region Host mapping parser

/**
 * Shared discovery options specialized for Pi spawn PID mapping files.
 */
type PiDiscoveryOptions = {
  /**
   * Directory containing Pi spawn PID mapping files.
   */
  readonly byPidDir: string;
  /**
   * Parser for Pi spawn PID mapping JSON.
   */
  readonly parseMapping: typeof parsePidMapping;
};

/**
 * Builds shared discovery options for a Pi spawn environment.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns shared discovery options for Pi spawn
 *
 * @example
 * ```typescript
 * piDiscoveryOptions({ PI_CODING_AGENT_DIR: '/tmp/pi' });
 * ```
 */
function piDiscoveryOptions(env: Environment = process.env,): PiDiscoveryOptions {
  return {
    byPidDir: byPidDir(env,),
    parseMapping: parsePidMapping,
  };
}

/**
 * Parses Pi spawn PID mapping JSON.
 *
 * @param raw - PID mapping JSON text
 *
 * @returns parsed Pi spawn PID mapping
 *
 * @example
 * ```typescript
 * parsePidMapping('{"sessionId":"s","sessionFile":"/tmp/s.jsonl","cwd":"/repo","extensionPath":"/pkg/index.mjs"}');
 * ```
 */
function parsePidMapping(raw: string,): PidMapping {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi extension.
  return JSON.parse(raw,) as PidMapping;
}

//endregion Host mapping parser

//region Session discovery adapter

/**
 * Reads parent PID from Linux `/proc/{pid}/status`.
 *
 * @param pid - process identifier to inspect.
 *
 * @returns parent PID, or {@link SESSION_NOT_FOUND} when unavailable.
 *
 * @example
 * ```typescript
 * readParentPid(process.pid);
 * ```
 */
function readParentPid(pid: number,): Promise<number | typeof SESSION_NOT_FOUND> {
  return readSharedParentPid({ pid, },);
}

/**
 * Reads PID-to-session mapping for one process id.
 *
 * @param pid - process identifier to map.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns {@link PidMapping}, or {@link SESSION_NOT_FOUND} when absent.
 *
 * @example
 * ```typescript
 * await readPidMapping({ pid: process.pid });
 * ```
 */
function readPidMapping(
  {
    pid,
    env = process.env,
  }: {
    readonly pid: number;
    readonly env?: Environment;
  },
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  return readSharedPidMapping({
    pid,
    ...piDiscoveryOptions(env,),
  },);
}

/**
 * Walks ancestors from a start PID to locate nearest Pi session mapping.
 *
 * @param pid - process identifier where search starts.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns nearest {@link PidMapping}, or {@link SESSION_NOT_FOUND}.
 *
 * @example
 * ```typescript
 * await walkProcessTreeFrom({ pid: process.ppid });
 * ```
 */
function walkProcessTreeFrom(
  {
    pid,
    env = process.env,
  }: {
    readonly pid: number;
    readonly env?: Environment;
  },
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  return walkSharedProcessTreeFrom({
    pid,
    ...piDiscoveryOptions(env,),
  },);
}

/**
 * Reads PID mapping directory entries.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns filenames, or {@link SESSION_NOT_FOUND} when directory is absent.
 *
 * @example
 * ```typescript
 * readByPidDir();
 * ```
 */
function readByPidDir(
  env: Environment = process.env,
): Promise<readonly string[] | typeof SESSION_NOT_FOUND> {
  return readSharedByPidDir(piDiscoveryOptions(env,),);
}

/**
 * Finds newest mapping as fallback for sandboxed process trees.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns newest {@link PidMapping}, or {@link SESSION_NOT_FOUND}.
 *
 * @example
 * ```typescript
 * await findByMostRecent();
 * ```
 */
function findByMostRecent(env: Environment = process.env,): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  return findSharedByMostRecent(piDiscoveryOptions(env,),);
}

/**
 * Finds parent Pi session by process ancestry, then newest mapping fallback.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns parent {@link PidMapping}, or {@link SESSION_NOT_FOUND}.
 *
 * @example
 * ```typescript
 * await findCallingSession();
 * ```
 */
function findCallingSession(
  env: Environment = process.env,
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  return findSharedCallingSession({
    startPid: process.ppid,
    ...piDiscoveryOptions(env,),
  },);
}

//endregion Session discovery adapter

export {
  findByMostRecent,
  findCallingSession,
  readByPidDir,
  readParentPid,
  readPidMapping,
  SESSION_NOT_FOUND,
  walkProcessTreeFrom,
};
