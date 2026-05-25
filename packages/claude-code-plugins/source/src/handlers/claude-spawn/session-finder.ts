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
import { parseHookJson, } from '../../runtime/handler-runtime.ts';
import {
  BY_PID_DIR,
  type PidMapping,
} from './paths.ts';

/**
 * Reads the parent PID of a given process from `/proc/{pid}/status`.
 *
 * @param pid - process id whose parent to look up
 *
 * @returns parent PID, or `null` if `/proc` is unreadable or the entry is missing
 *
 * @example
 * ```ts
 * const parent = readParentPid(1234);
 * ```
 */
function readParentPid(pid: number,): number | null {
  try {
    /** Raw `/proc/<pid>/status` text whose `PPid:` line carries the parent PID. */
    const statusContent = readFileSync(
      `/proc/${String(pid,)}/status`,
      'utf8',
    );
    /** First line beginning with `PPid:`; remains `undefined` on unrecognised status formats. */
    const ppidLine = statusContent.split('\n',)
      .find(function isPpidLine(line,) {
      return line.startsWith('PPid:',);
    },);

    if (ppidLine === undefined)
      return null;

    return Number.parseInt(
      splitWhitespace(ppidLine,)[1]
        ?? '0',
      10,
    );
  }
  catch {
    // Cannot read /proc: platform limitation or process already exited.
    return null;
  }
}

/**
 * Looks up a coordination file for a single PID without walking further.
 *
 * @param pid - process id to query
 *
 * @returns mapping when the file exists and parses, `null` otherwise
 *
 * @example
 * ```ts
 * const mapping = readPidMapping(1234);
 * ```
 */
function readPidMapping(pid: number,): PidMapping | null {
  /** Path under `.by-pid/` where the SessionStart hook would have recorded this PID. */
  const pidFilePath = join(
    BY_PID_DIR,
    String(pid,),
  );
  try {
    /** File contents on disk; parsed below as the mapping JSON. */
    const raw = readFileSync(
      pidFilePath,
      'utf8',
    );
    return parseHookJson<PidMapping>(raw,);
  }
  catch {
    return null;
  }
}

/**
 * Walks up the process tree starting from a given PID, returning the first
 * matching mapping or `null` once the walk reaches PID 1 or `/proc` becomes
 * unreadable.
 *
 * @param pid - PID to start the walk from
 *
 * @returns first matching mapping, or `null`
 *
 * @example
 * ```ts
 * const m = walkProcessTreeFrom(process.ppid);
 * ```
 */
function walkProcessTreeFrom(pid: number,): PidMapping | null {
  if (pid <= 1)
    return null;
  /** Mapping for `pid` itself; short-circuits the recursion when present. */
  const direct = readPidMapping(pid,);
  if (direct !== null)
    return direct;
  /** Parent PID continuing the walk; `null` ends recursion when `/proc` is unreadable. */
  const parentPid = readParentPid(pid,);
  if (parentPid === null)
    return null;
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
 * @returns session identity of calling Claude instance, or `null` if not found
 *
 * @example
 * ```ts
 * const identity = findByProcessTree();
 * if (identity !== null) console.log(identity.sessionId);
 * ```
 */
function findByProcessTree(): PidMapping | null {
  return walkProcessTreeFrom(process.ppid,);
}

/**
 * Scans all `.by-pid/` files and returns the most recently written one.
 *
 * Fallback for when the process tree walk fails, which happens inside the
 * Bash tool sandbox (separate PID namespace, so host PIDs from `.by-pid/`
 * don't appear in `/proc`).
 *
 * @returns session identity from most recent PID file, or `null` if none exist
 *
 * @example
 * ```ts
 * const identity = findByMostRecent();
 * if (identity !== null) console.log(identity.sessionId);
 * ```
 */
function findByMostRecent(): PidMapping | null {
  /** Filenames in `.by-pid/`, or `null` when the directory cannot be read. */
  const entries = (function readByPidDir(): string[] | null {
    try {
      return readdirSync(BY_PID_DIR,);
    }
    catch {
      return null;
    }
  })();

  if (entries === null)
    return null;

  /** Folds the entries to the most recently modified mapping, skipping unreadable files. */
  type NewestMapping = {
    mapping: PidMapping;
    mtime: number;
  } | null;

  /** Accumulator that ends with the latest valid mapping after scanning every entry. */
  const newest = entries.reduce<NewestMapping>(
    function pickNewer(
      current,
      filename,
    ) {
      /** Absolute path to the candidate `.by-pid/` entry being scored. */
      const filePath = join(
        BY_PID_DIR,
        filename,
      );

      try {
        /** Modification time used to rank against the running accumulator. */
        const mtime = statSync(filePath,)
          .mtimeMs;
        /** Raw file contents fed to `parseHookJson` below. */
        const raw = readFileSync(
          filePath,
          'utf8',
        );
        /** Parsed mapping that replaces the accumulator when its `mtime` is newer. */
        const mapping = parseHookJson<PidMapping>(raw,);

        if ((current === null) || (mtime > current
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
    null,
  );

  return newest?.mapping
    ?? null;
}

/**
 * Finds the calling Claude session identity.
 *
 * Tries the process tree walk first (precise, works outside sandbox), then
 * falls back to the most recently modified `.by-pid/` file (works inside
 * sandbox where PIDs don't match the host namespace).
 *
 * @returns session identity, or `null` if no coordination files exist
 *
 * @example
 * ```ts
 * const identity = findCallingSession();
 * if (identity === null) throw new Error('No Claude session found');
 * ```
 */
function findCallingSession(): PidMapping | null {
  return findByProcessTree()
    ?? findByMostRecent();
}

export {
  findByMostRecent,
  findByProcessTree,
  findCallingSession,
};
