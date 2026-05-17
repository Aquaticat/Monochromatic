import {
  readdir,
  readFile,
  readlink,
} from 'node:fs/promises';
import {
  createServer,
  type Server,
} from 'node:net';

import { log, } from '../log.ts';

/** Abstract Unix socket name used for single-instance enforcement. */
const SOCKET_NAME = '\0hall-monitor';

/** Index of the inode field in /proc/net/unix output lines. */
const INODE_FIELD_INDEX = 6;

/** Milliseconds to wait between lock acquisition retries. */
const RETRY_DELAY_MS = 300;

/** Maximum SIGTERM retry attempts before escalating to SIGKILL. */
const SIGTERM_RETRIES = 10;

/** Maximum SIGKILL retry attempts before giving up. */
const SIGKILL_RETRIES = 7;

/** Module-singleton mutable state for the lock-server handle; wrapped so it satisfies no-module-root-let. */
const state: { lockServer: Server | undefined; } = { lockServer: undefined, };

/**
 * Returns the lock server instance.
 * Used during shutdown to close the socket.
 *
 * @returns lock server, or `undefined` if no lock is currently held
 *
 * @example
 * ```ts
 * getLockServer()?.close();
 * ```
 */
export function getLockServer(): Server | undefined {
  return state.lockServer;
}

/**
 * Attempts to acquire the single-instance lock by listening on an abstract Unix socket.
 * Returns `true` if the lock was acquired, `false` if another instance holds it.
 *
 * @returns whether the lock was successfully acquired
 *
 * @example
 * ```ts
 * if (!(await acquireLock())) {
 *   log.error("Another instance is already running.");
 * }
 * ```
 */
export function acquireLock(): Promise<boolean> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping Node.js callback-based Server API
  return new Promise(function tryListen(resolve,) {
    /** Local handle to the freshly created server so listeners can be attached before assigning into `state`. */
    const server = createServer();
    state.lockServer = server;
    server.on(
      'error',
      function handleSocketError(err: NodeJS.ErrnoException,) {
        if (err.code === 'EADDRINUSE')
          resolve(false,);
        else {
          log.error(`[lock] Socket error: ${err.message}`,);
          resolve(false,);
        }
      },
    );
    server.listen(
      SOCKET_NAME,
      function onListening() {
        resolve(true,);
      },
    );
  },);
}

/**
 * Returns true when every character in `s` is an ASCII digit `0`-`9`.
 * Empty string returns false so PID-shape gates do not accept it.
 *
 * @param s - candidate string
 *
 * @returns whether `s` is one or more digits
 */
function isAllDigits(s: string,): boolean {
  if (s.length === 0)
    return false;
  for (const c of s) {
    if ((c < '0') || (c > '9'))
      return false;
  }
  return true;
}

/**
 * Splits `s` on runs of horizontal whitespace, dropping empty leading or
 * trailing tokens; mirrors `.split(/\s+/)` semantics for a trimmed input.
 *
 * @param s - text to split
 *
 * @returns array of non-empty whitespace-separated tokens
 */
function splitOnWhitespace(s: string,): string[] {
  /**
   * Recursive walker accumulating tokens; carries the in-progress token
   * and the completed accumulator so no `let` is needed.
   *
   * @param idx - cursor into `s`
   *
   * @param token - characters accumulated since the last whitespace
   *
   * @param acc - completed tokens so far
   *
   * @returns final token list
   */
  function walk({
    idx,
    token,
    acc,
  }: {
    idx: number;
    token: string;
    acc: readonly string[];
  },): string[] {
    if (idx >= s.length) {
      return token === '' ? [...acc,] : [
        ...acc,
        token,
      ];
    }
    /** Current char; whitespace breaks the in-progress token. */
    const c = s.charAt(idx,);
    if (
      (c === ' ') || (c === '\t') || (c === '\n')
      || (c === '\r') || (c === '\f') || (c === '\v')
    ) {
      return walk({
        idx: idx + 1,
        token: '',
        acc: token === '' ? acc : [
          ...acc,
          token,
        ],
      },);
    }
    return walk({
      idx: idx + 1,
      token: token + c,
      acc,
    },);
  }
  return walk({
    idx: 0,
    token: '',
    acc: [],
  },);
}

/**
 * Finds the PID of the process holding the hall-monitor abstract socket
 * by cross-referencing `/proc/net/unix` inodes with `/proc/{pid}/fd` symlinks.
 *
 * @returns PID of the socket owner, or null if not found
 */
async function findSocketOwnerPid(): Promise<number | null> {
  /** Snapshot of `/proc/net/unix` listing every Unix socket on the system. */
  const unix = await readFile(
    '/proc/net/unix',
    'utf8',
  );
  /** First `/proc/net/unix` row whose path matches the hall-monitor abstract socket. */
  const line = unix.split('\n',).find(function matchHallMonitor(l,) {
    return l.includes('@hall-monitor',);
  },);
  if (line === undefined)
    return null;
  /** Whitespace-separated `/proc/net/unix` columns used to extract the inode. */
  const fields = splitOnWhitespace(line.trim(),);
  /** Inode number that links the socket row to a `/proc/{pid}/fd` symlink target. */
  const inode = fields[INODE_FIELD_INDEX];

  for (const pid of await readdir('/proc',)) {
    if (!isAllDigits(pid,))
      continue;
    try {
      /** Open file descriptors of the candidate process; scanned for a matching socket inode. */
      // oxlint-disable-next-line no-await-in-loop -- sequential /proc traversal; parallel reads would race with process exits
      const fds = await readdir(`/proc/${pid}/fd`,);
      for (const fd of fds) {
        /** Resolved fd symlink target; equals `socket:[<inode>]` for socket descriptors. */
        // oxlint-disable-next-line no-await-in-loop -- sequential readlink for each fd
        const link = await readlink(`/proc/${pid}/fd/${fd}`,);
        if (link === `socket:[${inode}]`) {
          return Number.parseInt(
            pid,
            10,
          );
        }
      }
    }
    catch {
      // permission denied or process exited between readdir and readlink
    }
  }
  return null;
}

/**
 * Kills the existing hall-monitor instance and acquires the lock.
 * Sends SIGTERM first, escalates to SIGKILL if the process does not exit
 * within the retry window.
 *
 * @throws when the lock cannot be acquired after killing the existing instance
 *
 * @example
 * ```ts
 * await killExisting();
 * // lock is now held by this process
 * ```
 */
export async function killExisting(): Promise<void> {
  /** PID of the existing hall-monitor instance that must be terminated before the lock is free. */
  const pid = await findSocketOwnerPid();
  if (pid === null)
    throw new Error('Socket in use but could not find owner PID.',);

  log.debug(`[lock] Sending SIGTERM to existing instance (PID ${pid})...`,);
  process.kill(
    pid,
    'SIGTERM',
  );

  for (let i = 0; i < SIGTERM_RETRIES; i++) {
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- sequential retry loop with delay
    await new Promise(function retryDelay(resolve,) {
      setTimeout(
        resolve,
        RETRY_DELAY_MS,
      );
    },);
    // oxlint-disable-next-line no-await-in-loop -- sequential retry loop
    if (await acquireLock())
      return;
  }

  log.debug(`[lock] Sending SIGKILL to PID ${pid}...`,);
  try {
    process.kill(
      pid,
      'SIGKILL',
    );
  }
  catch {
    // process may already be gone
  }

  for (let i = 0; i < SIGKILL_RETRIES; i++) {
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- sequential retry loop with delay
    await new Promise(function retryDelay(resolve,) {
      setTimeout(
        resolve,
        RETRY_DELAY_MS,
      );
    },);
    // oxlint-disable-next-line no-await-in-loop -- sequential retry loop
    if (await acquireLock())
      return;
  }

  throw new Error('Failed to take over lock after killing existing instance.',);
}
