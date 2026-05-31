/**
 * Session identity resolution for the spawn-claude CLI.
 *
 * Finds the calling Claude session by walking the process tree or falling
 * back to the most recently modified PID coordination file.
 *
 * @module
 */

import {
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, } from 'node:path';

import { splitWhitespace, } from '../../lib/text-scan.ts';
import {
  BY_PID_DIR,
  type PidMapping,
} from './paths.ts';

/**
 * Sentinel returned when a session lookup finds nothing: no coordination file,
 * no readable parent PID, or no `.by-pid/` directory.
 *
 * A unique symbol rather than `null`: every finder narrows on identity
 * (`=== SESSION_NOT_FOUND`), so the resolved `PidMapping` never shares a
 * nullish union with "not found".
 */
const SESSION_NOT_FOUND: unique symbol = Symbol('claude-spawn/session-not-found',);

/**
 * Reads the parent PID of a given process from `/proc/{pid}/status`.
 *
 * @param pid - process id whose parent to look up
 *
 * @returns parent PID, or `SESSION_NOT_FOUND` if `/proc` is unreadable or the entry is missing
 *
 * @example
 * ```ts
 * const parent = readParentPid(1234);
 * ```
 */
function readParentPid(pid: number,): number | typeof SESSION_NOT_FOUND {
  try {
    /**
     * Raw `/proc/<pid>/status` text whose `PPid:` line carries the parent PID.
     */
    const statusContent = readFileSync(
      `/proc/${String(pid,)}/status`,
      'utf8',
    );
    /**
     * First line beginning with `PPid:`; remains `undefined` on unrecognised status formats.
     */
    const ppidLine = statusContent.split('\n',)
      .find(function isPpidLine(line,) {
      return line.startsWith('PPid:',);
    },);

    if (ppidLine === undefined)
      return SESSION_NOT_FOUND;

    return Number.parseInt(
      splitWhitespace(ppidLine,)[1]
        ?? '0',
      10,
    );
  }
  catch {
    // Cannot read /proc: platform limitation or process already exited.
    return SESSION_NOT_FOUND;
  }
}

/**
 * Looks up a coordination file for a single PID without walking further.
 *
 * @param pid - process id to query
 *
 * @returns mapping when the file exists and parses, `SESSION_NOT_FOUND` otherwise
 *
 * @example
 * ```ts
 * const mapping = readPidMapping(1234);
 * ```
 */
function readPidMapping(pid: number,): PidMapping | typeof SESSION_NOT_FOUND {
  /**
   * Path under `.by-pid/` where the SessionStart hook would have recorded this PID.
   */
  const pidFilePath = join(
    BY_PID_DIR,
    String(pid,),
  );
  try {
    /**
     * File contents on disk; parsed below as the mapping JSON.
     */
    const raw = readFileSync(
      pidFilePath,
      'utf8',
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook
    return JSON.parse(raw,) as PidMapping;
  }
  catch {
    return SESSION_NOT_FOUND;
  }
}

/**
 * Walks up the process tree starting from a given PID, returning the first
 * matching mapping or `SESSION_NOT_FOUND` once the walk reaches PID 1 or
 * `/proc` becomes unreadable.
 *
 * @param pid - PID to start the walk from
 *
 * @returns first matching mapping, or `SESSION_NOT_FOUND`
 *
 * @example
 * ```ts
 * const m = walkProcessTreeFrom(process.ppid);
 * ```
 */
function walkProcessTreeFrom(pid: number,): PidMapping | typeof SESSION_NOT_FOUND {
  if (pid <= 1)
    return SESSION_NOT_FOUND;
  /**
   * Mapping for `pid` itself; short-circuits the recursion when present.
   */
  const direct = readPidMapping(pid,);
  if (direct !== SESSION_NOT_FOUND)
    return direct;
  /**
   * Parent PID continuing the walk; `SESSION_NOT_FOUND` ends recursion when `/proc` is unreadable.
   */
  const parentPid = readParentPid(pid,);
  if (parentPid === SESSION_NOT_FOUND)
    return SESSION_NOT_FOUND;
  return walkProcessTreeFrom(parentPid,);
}

/**
 * Walks up the process tree from the current process to find the Claude
 * session identity by checking each ancestor PID against the `.by-pid/`
 * coordination directory.
 *
 * When invoked via Bash tool, the process tree is:
 *   Claude -\> [sandbox?] -\> shell -\> spawn-claude
 * The SessionStart hook writes `.by-pid/[claudePid]`, so we walk up until we
 * find a matching PID file.
 *
 * @returns session identity of calling Claude instance, or `SESSION_NOT_FOUND` if not found
 *
 * @example
 * ```ts
 * const identity = findByProcessTree();
 * if (identity !== SESSION_NOT_FOUND) console.log(identity.sessionId);
 * ```
 */
function findByProcessTree(): PidMapping | typeof SESSION_NOT_FOUND {
  return walkProcessTreeFrom(process.ppid,);
}

/**
 * Lists the filenames in the `.by-pid/` coordination directory.
 *
 * @returns directory entries, or `SESSION_NOT_FOUND` when the directory is
 *   missing or unreadable
 *
 * @example
 * ```ts
 * const entries = readByPidDir();
 * ```
 */
function readByPidDir(): readonly string[] | typeof SESSION_NOT_FOUND {
  try {
    return readdirSync(BY_PID_DIR,);
  }
  catch {
    return SESSION_NOT_FOUND;
  }
}

/**
 * Scans all `.by-pid/` files and returns the most recently written one.
 *
 * Fallback for when the process tree walk fails, which happens inside the
 * Bash tool sandbox (separate PID namespace, so host PIDs from `.by-pid/`
 * don't appear in `/proc`).
 *
 * @returns session identity from most recent PID file, or `SESSION_NOT_FOUND` if none exist
 *
 * @example
 * ```ts
 * const identity = findByMostRecent();
 * if (identity !== SESSION_NOT_FOUND) console.log(identity.sessionId);
 * ```
 */
function findByMostRecent(): PidMapping | typeof SESSION_NOT_FOUND {
  /**
   * Filenames in `.by-pid/`, or `SESSION_NOT_FOUND` when the directory cannot be read.
   */
  const entries = readByPidDir();

  if (entries === SESSION_NOT_FOUND)
    return SESSION_NOT_FOUND;

  /**
   * Folds the entries to the most recently modified mapping, skipping unreadable files.
   */
  type NewestMapping = {
    mapping: PidMapping;
    mtime: number;
  } | typeof SESSION_NOT_FOUND;

  /**
   * Accumulator that ends with the latest valid mapping after scanning every entry.
   */
  const newest = entries.reduce<NewestMapping>(
    function pickNewer(
      current,
      filename,
    ) {
      /**
       * Absolute path to the candidate `.by-pid/` entry being scored.
       */
      const filePath = join(
        BY_PID_DIR,
        filename,
      );

      try {
        /**
         * Modification time used to rank against the running accumulator.
         */
        const mtime = statSync(filePath,)
          .mtimeMs;
        /**
         * Raw file contents parsed below into the candidate mapping.
         */
        const raw = readFileSync(
          filePath,
          'utf8',
        );
        /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
        /**
         * Parsed mapping that replaces the accumulator when its `mtime` is newer.
         */
        const mapping = JSON.parse(raw,) as PidMapping;
        /* oxlint-enable typescript/no-unsafe-type-assertion */

        if ((current === SESSION_NOT_FOUND) || (mtime > current
          .mtime)) {
          return {
            mapping,
            mtime,
          };
        }
        return current;
      }
      catch {
        // Skip unreadable files.
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
 * Finds the calling Claude session identity.
 *
 * Tries the process tree walk first (precise, works outside sandbox), then
 * falls back to the most recently modified `.by-pid/` file (works inside
 * sandbox where PIDs don't match the host namespace).
 *
 * @returns session identity, or `SESSION_NOT_FOUND` if no coordination files exist
 *
 * @example
 * ```ts
 * const identity = findCallingSession();
 * if (identity === SESSION_NOT_FOUND) throw new Error('No Claude session found');
 * ```
 */
function findCallingSession(): PidMapping | typeof SESSION_NOT_FOUND {
  /**
   * Process-tree walk result; falls through to the most-recent scan when not found.
   */
  const fromTree = findByProcessTree();
  return fromTree === SESSION_NOT_FOUND
    ? findByMostRecent()
    : fromTree;
}

export {
  findByMostRecent,
  findByProcessTree,
  findCallingSession,
  SESSION_NOT_FOUND,
};
