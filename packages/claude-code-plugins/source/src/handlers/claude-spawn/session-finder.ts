/**
 * Session identity resolution for the spawn-claude CLI.
 *
 * Finds the calling Claude session by walking the process tree or falling
 * back to the most recently modified PID coordination file.
 *
 * @module
 */

import {
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { splitWhitespace, } from '@monochromatic-dev/agent-harnesses-shared-text-scan/ts';
import {
  BY_PID_DIR,
  type PidMapping,
} from './paths.ts';

/**
 * Sentinel returned when a session lookup finds nothing: no coordination file,
 * no readable parent PID, or no `.by-pid/` directory.
 *
 * A unique symbol rather than `null`: every finder narrows on identity
 * (`=== SESSION_NOT_FOUND`), so the resolved {@link PidMapping} never shares a
 * nullish union with "not found".
 */
const SESSION_NOT_FOUND: unique symbol = Symbol('claude-spawn/session-not-found',);

/**
 * Reads the parent PID of a given process from `/proc/{pid}/status`.
 *
 * @param pid - process id whose parent to look up
 *
 * @returns parent PID, or {@link SESSION_NOT_FOUND} if `/proc` is unreadable or the entry is missing
 *
 * @example
 * ```ts
 * const parent = readParentPid(1234);
 * ```
 */
async function readParentPid(pid: number,): Promise<number | typeof SESSION_NOT_FOUND> {
  try {
    /**
     * Raw `/proc/<pid>/status` text whose `PPid:` line carries the parent PID.
     */
    const statusContent = await readFile(
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

    return Math.trunc(Number(
      splitWhitespace(ppidLine,)[1]
        ?? '0',
    ),);
  }
  catch (_error: unknown) {
    // Cannot read /proc: platform limitation or process already exited.
    return SESSION_NOT_FOUND;
  }
}

/**
 * Looks up a coordination file for a single PID without walking further.
 *
 * @param pid - process id to query
 *
 * @returns mapping when the file exists and parses, {@link SESSION_NOT_FOUND} otherwise
 *
 * @example
 * ```ts
 * const mapping = readPidMapping(1234);
 * ```
 */
async function readPidMapping(pid: number,): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
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
    const raw = await readFile(
      pidFilePath,
      'utf8',
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook
    return JSON.parse(raw,) as PidMapping;
  }
  catch (_error: unknown) {
    return SESSION_NOT_FOUND;
  }
}

/**
 * Walks up the process tree starting from a given PID, returning the first
 * matching mapping or {@link SESSION_NOT_FOUND} once the walk reaches PID 1 or
 * `/proc` becomes unreadable.
 *
 * @param pid - PID to start the walk from
 *
 * @returns first matching mapping, or {@link SESSION_NOT_FOUND}
 *
 * @example
 * ```ts
 * const m = walkProcessTreeFrom(process.ppid);
 * ```
 */
async function walkProcessTreeFrom(pid: number,): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  if (pid <= 1)
    return SESSION_NOT_FOUND;
  /**
   * Mapping for `pid` itself; short-circuits the process-tree walk when present.
   */
  const direct = await readPidMapping(pid,);
  if (direct !== SESSION_NOT_FOUND)
    return direct;
  /**
   * Parent PID continuing the walk; {@link SESSION_NOT_FOUND} ends when `/proc` is unreadable.
   */
  const parentPid = await readParentPid(pid,);
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
 * @returns session identity of calling Claude instance, or {@link SESSION_NOT_FOUND} if not found
 *
 * @example
 * ```ts
 * const identity = findByProcessTree();
 * if (identity !== SESSION_NOT_FOUND) console.log(identity.sessionId);
 * ```
 */
function findByProcessTree(): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  return walkProcessTreeFrom(process.ppid,);
}

/**
 * Lists the filenames in the `.by-pid/` coordination directory.
 *
 * @returns directory entries, or {@link SESSION_NOT_FOUND} when the directory is
 *   missing or unreadable
 *
 * @example
 * ```ts
 * const entries = readByPidDir();
 * ```
 */
async function readByPidDir(): Promise<readonly string[] | typeof SESSION_NOT_FOUND> {
  try {
    return await readdir(BY_PID_DIR,);
  }
  catch (_error: unknown) {
    return SESSION_NOT_FOUND;
  }
}

/**
 * Candidate mapping paired with file modification time for fallback ranking.
 */
type NewestMapping = {
  readonly mapping: PidMapping;
  readonly mtime: number;
} | typeof SESSION_NOT_FOUND;

/**
 * Reads and scores one `.by-pid/` entry for most-recent fallback lookup.
 *
 * @param filename - directory entry name under {@link BY_PID_DIR}
 *
 * @returns mapping with modification time, or {@link SESSION_NOT_FOUND} when unreadable
 */
async function readNewestCandidate(filename: string,): Promise<NewestMapping> {
  /**
   * Absolute path to the candidate `.by-pid/` entry being scored.
   */
  const filePath = join(
    BY_PID_DIR,
    filename,
  );

  try {
    /**
     * File metadata and contents read concurrently for the candidate mapping.
     */
    const [stats, raw,] = await Promise.all([
      stat(filePath,),
      readFile(
        filePath,
        'utf8',
      ),
    ],);
    /* oxlint-disable typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
    /**
     * Parsed mapping that can replace the accumulator when its `mtime` is newer.
     */
    const mapping = JSON.parse(raw,) as PidMapping;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    return {
      mapping,
      mtime: stats.mtimeMs,
    };
  }
  catch (_error: unknown) {
    // Skip unreadable files.
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
 * @returns session identity from most recent PID file, or {@link SESSION_NOT_FOUND} if none exist
 *
 * @example
 * ```ts
 * const identity = await findByMostRecent();
 * if (identity !== SESSION_NOT_FOUND) console.log(identity.sessionId);
 * ```
 */
async function findByMostRecent(): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  /**
   * Filenames in `.by-pid/`, or {@link SESSION_NOT_FOUND} when the directory cannot be read.
   */
  const entries = await readByPidDir();

  if (entries === SESSION_NOT_FOUND)
    return SESSION_NOT_FOUND;

  /**
   * Candidate mappings for every entry; unreadable files become the sentinel.
   */
  const candidates = await Promise.all(
    entries.map(function readEntry(filename,): Promise<NewestMapping> {
      return readNewestCandidate(filename,);
    },),
  );
  /**
   * Accumulator that ends with the latest valid mapping after scanning every entry.
   */
  const newest = candidates.reduce<NewestMapping>(
    function chooseNewer(
      current,
      candidate,
    ) {
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
 * Finds the calling Claude session identity.
 *
 * Tries the process tree walk first (precise, works outside sandbox), then
 * falls back to the most recently modified `.by-pid/` file (works inside
 * sandbox where PIDs don't match the host namespace).
 *
 * @returns session identity, or {@link SESSION_NOT_FOUND} if no coordination files exist
 *
 * @example
 * ```ts
 * const identity = findCallingSession();
 * if (identity === SESSION_NOT_FOUND) throw new Error('No Claude session found');
 * ```
 */
async function findCallingSession(): Promise<PidMapping | typeof SESSION_NOT_FOUND> {
  /**
   * Process-tree walk result; falls through to the most-recent scan when not found.
   */
  const fromTree = await findByProcessTree();
  return fromTree === SESSION_NOT_FOUND
    ? await findByMostRecent()
    : fromTree;
}

export {
  findByMostRecent,
  findByProcessTree,
  findCallingSession,
  SESSION_NOT_FOUND,
};
