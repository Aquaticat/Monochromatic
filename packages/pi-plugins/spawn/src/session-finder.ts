/**
 * Parent Pi session resolution for spawn-pi CLI.
 *
 * @module
 */

import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  byPidDir,
  type Environment,
  type PidMapping,
} from './paths.ts';
import { splitWhitespace, } from '@monochromatic-dev/agent-harnesses-shared-text-scan/ts';

//region Module logger

/**
 * Module logger tagged for spawn-pi parent-session resolution.
 */
const l = tagged({ tag: 'pi-spawn:session-finder', },);

//endregion Module logger

//region Sentinels

/**
 * Sentinel returned when no parent Pi session mapping can be resolved.
 *
 * @example
 * ```typescript
 * if (identity === SESSION_NOT_FOUND) throw new Error('missing parent');
 * ```
 */
const SESSION_NOT_FOUND: unique symbol = Symbol('spawn-pi/session-not-found',);

//endregion Sentinels

//region Procfs scanning

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
async function readParentPid(pid: number,): Promise<number | typeof SESSION_NOT_FOUND> {
  try {
    /**
     * Status file contents for process.
     */
    const statusContent = await readFile(
      `/proc/${String(pid,)}/status`,
      'utf8',
    );
    /**
     * Status line carrying parent process id.
     */
    const ppidLine = statusContent.split('\n',)
      .find(function isPpidLine(line,): boolean {
        return line.startsWith('PPid:',);
      },);

    if (ppidLine === undefined)
      return SESSION_NOT_FOUND;

    /**
     * Parsed parent process id from status line.
     */
    const parentPid = Math.trunc(Number(
      splitWhitespace(ppidLine,)[1]
        ?? '0',
    ),);

    return Number.isFinite(parentPid,)
      ? parentPid
      : SESSION_NOT_FOUND;
  }
  catch (error: unknown) {
    // Procfs status unavailable on this host: no parent to resolve.
    tagged({
      tag: readParentPid.name,
      l,
    },)
      .debug(`Could not read parent pid for ${String(pid,)}: ${String(error,)}`,);
    return SESSION_NOT_FOUND;
  }
}

//endregion Procfs scanning

//region Mapping reads

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
async function readPidMapping(
  {
    pid,
    env = process.env,
  }: {
    readonly pid: number;
    readonly env?: Environment;
  },
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  try {
    /**
     * Mapping file path for candidate process id.
     */
    const pidFilePath = join(
      byPidDir(env,),
      String(pid,),
    );
    /**
     * Mapping file JSON text.
     */
    const raw = await readFile(
      pidFilePath,
      'utf8',
    );
    /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi extension. */
    /**
     * Parsed PID mapping.
     */
    const mapping = JSON.parse(raw,) as PidMapping;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    return mapping;
  }
  catch (error: unknown) {
    // Absent or unreadable mapping file for this pid: no mapping.
    tagged({
      tag: readPidMapping.name,
      l,
    },)
      .debug(`Could not read pid mapping for ${String(pid,)}: ${String(error,)}`,);
    return SESSION_NOT_FOUND;
  }
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
async function walkProcessTreeFrom(
  {
    pid,
    env = process.env,
  }: {
    readonly pid: number;
    readonly env?: Environment;
  },
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  for (let currentPid = pid; currentPid > 1;) {
    /**
     * Mapping directly attached to current process id.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- Ancestry walk is inherently sequential; each step reads the mapping for the pid resolved by the previous step.
    const direct = await readPidMapping({
      pid: currentPid,
      env,
    },);
    if (direct !== SESSION_NOT_FOUND)
      return direct;

    /**
     * Parent process id for next step upward.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- Ancestry walk is inherently sequential; the next pid depends on this pid's procfs parent.
    const parentPid = await readParentPid(currentPid,);
    if (parentPid === SESSION_NOT_FOUND)
      return SESSION_NOT_FOUND;
    currentPid = parentPid;
  }

  return SESSION_NOT_FOUND;
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
async function readByPidDir(
  env: Environment = process.env,
): Promise<readonly string[] | typeof SESSION_NOT_FOUND> {
  try {
    return await readdir(byPidDir(env,),);
  }
  catch (error: unknown) {
    // Absent mapping directory means no parent session was ever registered.
    tagged({
      tag: readByPidDir.name,
      l,
    },)
      .debug(`Could not read pid mapping directory: ${String(error,)}`,);
    return SESSION_NOT_FOUND;
  }
}

/**
 * PID mapping paired with its file modification time for recency ordering.
 */
type MappingCandidate = {
  /**
   * Mapping parsed from a PID file.
   */
  readonly mapping: PidMapping;
  /**
   * Mapping file modification time in milliseconds.
   */
  readonly mtime: number;
};

/**
 * Reads a single PID mapping file with its modification time.
 *
 * @param filename - mapping file name under PID mapping directory.
 *
 * @param env - {@link Environment} values controlling mapping directory.
 *
 * @returns {@link MappingCandidate}, or {@link SESSION_NOT_FOUND} when unreadable.
 *
 * @example
 * ```typescript
 * await readMappingCandidate({ filename: '123' });
 * ```
 */
async function readMappingCandidate(
  {
    filename,
    env = process.env,
  }: {
    readonly filename: string;
    readonly env?: Environment;
  },
): Promise<MappingCandidate | typeof SESSION_NOT_FOUND> {
  try {
    /**
     * Candidate mapping file path.
     */
    const filePath = join(
      byPidDir(env,),
      filename,
    );
    /**
     * Candidate file stats carrying modification time.
     */
    const stats = await stat(filePath,);
    /**
     * Candidate JSON text.
     */
    const raw = await readFile(
      filePath,
      'utf8',
    );
    /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi extension. */
    /**
     * Candidate mapping parsed from JSON.
     */
    const mapping = JSON.parse(raw,) as PidMapping;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    return {
      mapping,
      mtime: stats.mtimeMs,
    };
  }
  catch (error: unknown) {
    // Candidate vanished or was malformed between listing and read: skip it.
    tagged({
      tag: readMappingCandidate.name,
      l,
    },)
      .debug(`Could not read mapping candidate ${filename}: ${String(error,)}`,);
    return SESSION_NOT_FOUND;
  }
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
async function findByMostRecent(env: Environment = process.env,): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  /**
   * Mapping directory entries to inspect.
   */
  const entries = await readByPidDir(env,);
  if (entries === SESSION_NOT_FOUND)
    return SESSION_NOT_FOUND;

  /**
   * Candidate mappings read concurrently, one slot per directory entry.
   */
  const candidates = await Promise.all(entries.map(
    function readCandidate(filename,): Promise<MappingCandidate | typeof SESSION_NOT_FOUND> {
      return readMappingCandidate({
        filename,
        env,
      },);
    },
  ),);

  /**
   * Newest mapping accumulator.
   */
  type NewestMapping = MappingCandidate | typeof SESSION_NOT_FOUND;

  /**
   * Most recent readable mapping across all PID files.
   */
  const newest = candidates.reduce<NewestMapping>(
    function pickNewer(
      current,
      candidate,
    ): NewestMapping {
      if (candidate === SESSION_NOT_FOUND)
        return current;
      if ((current === SESSION_NOT_FOUND) || (candidate.mtime > current.mtime))
        return candidate;
      return current;
    },
    SESSION_NOT_FOUND,
  );

  return newest === SESSION_NOT_FOUND
    ? SESSION_NOT_FOUND
    : newest.mapping;
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
async function findCallingSession(
  env: Environment = process.env,
): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  /**
   * Precise process-tree result.
   */
  const fromTree = await walkProcessTreeFrom({
    pid: process.ppid,
    env,
  },);

  return fromTree === SESSION_NOT_FOUND
    ? await findByMostRecent(env,)
    : fromTree;
}

//endregion Mapping reads

export {
  findByMostRecent,
  findCallingSession,
  readByPidDir,
  readParentPid,
  readPidMapping,
  SESSION_NOT_FOUND,
  walkProcessTreeFrom,
};
