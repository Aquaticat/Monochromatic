import { createServer, type Server } from "node:net";
import { readdir, readlink, readFile } from "node:fs/promises";

import { log } from "../log.ts";

/** Abstract Unix socket name used for single-instance enforcement. */
const SOCKET_NAME = "\0hall-monitor";

/** Index of the inode field in /proc/net/unix output lines. */
const INODE_FIELD_INDEX = 6;

/** Milliseconds to wait between lock acquisition retries. */
const RETRY_DELAY_MS = 300;

/** Maximum SIGTERM retry attempts before escalating to SIGKILL. */
const SIGTERM_RETRIES = 10;

/** Maximum SIGKILL retry attempts before giving up. */
const SIGKILL_RETRIES = 7;

/** Handle to the lock server, held for the lifetime of the process. */
// oxlint-disable-next-line init-declarations -- assigned in acquireLock() before first use
let lockServer: Server;

/**
 * Returns the lock server instance.
 * Used during shutdown to close the socket.
 *
 * @returns lock server, or undefined if no lock is held
 *
 * @example
 * ```ts
 * getLockServer()?.close();
 * ```
 */
export function getLockServer(): Server {
  return lockServer;
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
  return new Promise(function tryListen(resolve) {
    lockServer = createServer();
    lockServer.on("error", function handleSocketError(err: NodeJS.ErrnoException) {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        log.error(`[lock] Socket error: ${err.message}`);
        resolve(false);
      }
    });
    lockServer.listen(SOCKET_NAME, function onListening() { resolve(true); });
  });
}

/**
 * Finds the PID of the process holding the hall-monitor abstract socket
 * by cross-referencing `/proc/net/unix` inodes with `/proc/{pid}/fd` symlinks.
 *
 * @returns PID of the socket owner, or null if not found
 */
async function findSocketOwnerPid(): Promise<number | null> {
  const unix = await readFile("/proc/net/unix", "utf8");
  const line = unix.split("\n").find(function matchHallMonitor(l) { return l.includes("@hall-monitor"); });
  if (line === undefined) {
    return null;
  }
  const fields = line.trim().split(/\s+/);
  const inode = fields[INODE_FIELD_INDEX];

  for (const pid of await readdir("/proc")) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential /proc traversal; parallel reads would race with process exits
      const fds = await readdir(`/proc/${pid}/fd`);
      for (const fd of fds) {
        // oxlint-disable-next-line no-await-in-loop -- sequential readlink for each fd
        const link = await readlink(`/proc/${pid}/fd/${fd}`);
        if (link === `socket:[${inode}]`) return Number.parseInt(pid, 10);
      }
    } catch {
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
 * @returns when the lock is acquired
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
  const pid = await findSocketOwnerPid();
  if (pid === null) {
    throw new Error("Socket in use but could not find owner PID.");
  }

  log.debug(`[lock] Sending SIGTERM to existing instance (PID ${pid})...`);
  process.kill(pid, "SIGTERM");

  for (let i = 0; i < SIGTERM_RETRIES; i++) {
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- sequential retry loop with delay
    await new Promise(function retryDelay(resolve) { setTimeout(resolve, RETRY_DELAY_MS); });
    // oxlint-disable-next-line no-await-in-loop -- sequential retry loop
    if (await acquireLock()) return;
  }

  log.debug(`[lock] Sending SIGKILL to PID ${pid}...`);
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // process may already be gone
  }

  for (let i = 0; i < SIGKILL_RETRIES; i++) {
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- sequential retry loop with delay
    await new Promise(function retryDelay(resolve) { setTimeout(resolve, RETRY_DELAY_MS); });
    // oxlint-disable-next-line no-await-in-loop -- sequential retry loop
    if (await acquireLock()) return;
  }

  throw new Error("Failed to take over lock after killing existing instance.");
}
