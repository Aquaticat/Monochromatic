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

import {
  BY_PID_DIR,
  type PidMapping,
} from './paths.ts';

/**
 * Walks up the process tree from the current process to find the Claude
 * session identity by checking each ancestor PID against the `.by-pid/`
 * coordination directory.
 *
 * When invoked via Bash tool, the process tree is:
 *   Claude -> [sandbox?] -> shell -> spawn-claude
 * The SessionStart hook writes `.by-pid/{claudePid}`, so we walk up until we
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
  let pid = process.ppid;

  while (pid > 1) {
    const pidFilePath = join(
      BY_PID_DIR,
      String(pid,),
    );

    try {
      const raw = readFileSync(
        pidFilePath,
        'utf8',
      );
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      return JSON.parse(raw,) as PidMapping;
    }
    catch {
      // No coordination file for this PID: walk up to its parent.
    }

    try {
      const statusContent = readFileSync(
        `/proc/${String(pid,)}/status`,
        'utf8',
      );
      const ppidLine = statusContent.split('\n',).find(function isPpidLine(line,) {
        return line.startsWith('PPid:',);
      },);

      if (ppidLine === undefined)
        return null;

      pid = Number.parseInt(
        ppidLine.split(/\s+/,)[1] ?? '0',
        10,
      );
    }
    catch {
      // Cannot read /proc: platform limitation or process already exited.
      return null;
    }
  }

  return null;
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
  let entries: string[] = [];

  try {
    entries = readdirSync(BY_PID_DIR,);
  }
  catch {
    return null;
  }

  let newest: {
    mapping: PidMapping;
    mtime: number;
  } | null = null;

  for (const filename of entries) {
    const filePath = join(
      BY_PID_DIR,
      filename,
    );

    try {
      const mtime = statSync(filePath,).mtimeMs;
      const raw = readFileSync(
        filePath,
        'utf8',
      );
      /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own SessionStart hook */
      const mapping = JSON.parse(raw,) as PidMapping;

      if (newest === null || mtime > newest.mtime) {
        newest = {
          mapping,
          mtime,
        };
      }
    }
    catch {
      // Skip unreadable files.
    }
  }

  return newest?.mapping ?? null;
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
  return findByProcessTree() ?? findByMostRecent();
}

export {
  findByMostRecent,
  findByProcessTree,
  findCallingSession,
};
