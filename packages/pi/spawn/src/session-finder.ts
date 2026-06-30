/**
 * Parent Pi session resolution for spawn-pi CLI.
 *
 * @module
 */

import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, } from 'node:path';

import {
  byPidDir,
  type Environment,
  type PidMapping,
} from './paths.ts';
import { splitWhitespace, } from './text-scan.ts';

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
function readParentPid(pid: number,): number | typeof SESSION_NOT_FOUND {
  try {
    /**
     * Status file contents for process.
     */
    const statusContent = readFileSync(
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
    const parentPid = Number.parseInt(
      splitWhitespace(ppidLine,)[1]
        ?? '0',
      10,
    );

    return Number.isFinite(parentPid,)
      ? parentPid
      : SESSION_NOT_FOUND;
  }
  catch {
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
 * readPidMapping({ pid: process.pid });
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
): PidMapping | typeof SESSION_NOT_FOUND {
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
    const raw = readFileSync(
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
  catch {
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
 * walkProcessTreeFrom({ pid: process.ppid });
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
): PidMapping | typeof SESSION_NOT_FOUND {
  for (let currentPid = pid; currentPid > 1;) {
    /**
     * Mapping directly attached to current process id.
     */
    const direct = readPidMapping({
      pid: currentPid,
      env,
    },);
    if (direct !== SESSION_NOT_FOUND)
      return direct;

    /**
     * Parent process id for next step upward.
     */
    const parentPid = readParentPid(currentPid,);
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
function readByPidDir(env: Environment = process.env,): readonly string[] | typeof SESSION_NOT_FOUND {
  try {
    return readdirSync(byPidDir(env,),);
  }
  catch {
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
 * findByMostRecent();
 * ```
 */
function findByMostRecent(env: Environment = process.env,): PidMapping | typeof SESSION_NOT_FOUND {
  /**
   * Mapping directory entries to inspect.
   */
  const entries = readByPidDir(env,);
  if (entries === SESSION_NOT_FOUND)
    return SESSION_NOT_FOUND;

  /**
   * Newest mapping accumulator.
   */
  type NewestMapping = {
    readonly mapping: PidMapping;
    readonly mtime: number;
  } | typeof SESSION_NOT_FOUND;

  /**
   * Most recent readable mapping across all PID files.
   */
  const newest = entries.reduce<NewestMapping>(
    function pickNewer(
      current,
      filename,
    ): NewestMapping {
      try {
        /**
         * Candidate mapping file path.
         */
        const filePath = join(
          byPidDir(env,),
          filename,
        );
        /**
         * Candidate modification time used for ordering.
         */
        const mtime = statSync(filePath,)
          .mtimeMs;
        /**
         * Candidate JSON text.
         */
        const raw = readFileSync(
          filePath,
          'utf8',
        );
        /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted JSON file written by spawn-pi extension. */
        /**
         * Candidate mapping parsed from JSON.
         */
        const mapping = JSON.parse(raw,) as PidMapping;
        /* oxlint-enable typescript/no-unsafe-type-assertion */

        if ((current === SESSION_NOT_FOUND) || (mtime > current.mtime)) {
          return {
            mapping,
            mtime,
          };
        }
        return current;
      }
      catch {
        return current;
      }
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
 * findCallingSession();
 * ```
 */
function findCallingSession(env: Environment = process.env,): PidMapping | typeof SESSION_NOT_FOUND {
  /**
   * Precise process-tree result.
   */
  const fromTree = walkProcessTreeFrom({
    pid: process.ppid,
    env,
  },);

  return fromTree === SESSION_NOT_FOUND
    ? findByMostRecent(env,)
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
